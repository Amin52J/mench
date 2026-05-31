/**
 * `GameRoom` Durable Object — server-authoritative loop for one online game.
 *
 * Responsibilities (`api-design.mdc`, phase 4.2):
 * - WebSocket fan-in / fan-out for all connected clients in the room.
 * - Assign seats on `join`; reject without a valid `joinCode`.
 * - Validate `intent` against the shared rules engine (`@game/rules`) before
 *   advancing state. Illegal intents → `error`, no `seq` bump.
 * - 30-second turn deadline for human seats via `state.storage.setAlarm()`;
 *   expiry forfeits the active seat through the engine.
 * - CPU seats: server generates `roll` / `move` / `forfeit` intents using the
 *   shared AI (`@game/ai`) with a tiny think delay.
 *
 * Phase 4.1 stub routes (`/init`, `/hello`, `/state`, `/echo`) are preserved
 * so the existing HTTP smoke test from phase 4.1 still passes.
 */

import {
  activeColor,
  activeSeatKind,
  applyIntent,
  IllegalIntentError,
  type GameIntent,
  type GameState,
} from '@game/rules';
import { createGame } from '@game/rules';
import { chooseMove } from '@game/ai';
import type { PlayerColor, PlayerKind } from '@game/types';

import {
  DEFAULT_ONLINE_SEATS,
  TURN_TIMER_SECONDS,
  parseClientMessage,
  type ClientMessage,
  type PublicGameState,
  type SeatAssignment,
  type ServerErrorCode,
  type ServerMessage,
} from '@game/online/protocol.ts';

/** Re-export so phase 4.1 callers that imported `RoomIntent` keep compiling. */
export type RoomIntent = GameIntent;

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

interface LegacyStub {
  message: string;
  echoCount: number;
  lastEcho: unknown;
}

interface ConnectionInfo {
  readonly id: string;
  /** Seat assignment after a successful `join`. `null` while spectating. */
  seat: SeatAssignment | null;
  displayName: string | null;
}

interface RoomMeta {
  readonly roomId: string;
  readonly joinCode: string;
  readonly seats: ReadonlyArray<{
    readonly color: PlayerColor;
    readonly kind: PlayerKind;
    /** Whether the seat is currently claimed by a connected client. */
    claimed: boolean;
  }>;
}

/** Per-intent rate cap to absorb misbehaving clients (`api-design.mdc`). */
const INTENT_RATE_PER_SECOND = 10;
/** CPU "think" delay before its intent is auto-played (matches local feel). */
const CPU_THINK_DELAY_MS = 450;

// ---------------------------------------------------------------------------
// Durable Object
// ---------------------------------------------------------------------------

export class GameRoom implements DurableObject {
  private meta: RoomMeta | null = null;
  private game: GameState | null = null;
  private seq = 0;
  /** Epoch ms after which the current turn auto-skips, or `null` if disabled. */
  private turnDeadline: number | null = null;
  private readonly connections = new Map<WebSocket, ConnectionInfo>();
  private readonly intentTimestamps = new WeakMap<WebSocket, number[]>();
  private cpuTimer: ReturnType<typeof setTimeout> | null = null;
  /** Legacy stub state preserved for phase 4.1 routes. */
  private legacyStub: LegacyStub = {
    message: 'hello',
    echoCount: 0,
    lastEcho: undefined,
  };

  constructor(private readonly ctx: DurableObjectState) {}

  // -------------------------------------------------------------------------
  // HTTP entry — routes both phase-4.1 stubs and the phase-4.2 WS upgrade.
  // -------------------------------------------------------------------------

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Phase 4.1 init — sets room metadata and creates the initial game.
    if (path.endsWith('/init') && request.method === 'POST') {
      const body = (await request.json()) as { joinCode: string; roomId: string };
      await this.initRoom(body.roomId, body.joinCode);
      return Response.json({ ok: true, roomId: body.roomId, joinCode: body.joinCode });
    }

    if (path.endsWith('/hello')) {
      return Response.json({
        message: this.legacyStub.message,
        roomId: this.meta?.roomId ?? '',
        joinCode: this.meta?.joinCode ?? '',
      });
    }

    if (path.endsWith('/state') && request.method === 'GET') {
      await this.ensureLoaded();
      return Response.json({
        state: {
          message: this.legacyStub.message,
          roomId: this.meta?.roomId ?? '',
          joinCode: this.meta?.joinCode ?? '',
          echoCount: this.legacyStub.echoCount,
          lastEcho: this.legacyStub.lastEcho,
        },
      });
    }

    if (path.endsWith('/echo') && request.method === 'POST') {
      const payload: unknown = await request.json().catch(() => ({}));
      this.legacyStub = {
        ...this.legacyStub,
        echoCount: this.legacyStub.echoCount + 1,
        lastEcho: payload,
      };
      await this.persistLegacyStub();
      return Response.json({
        state: {
          message: this.legacyStub.message,
          roomId: this.meta?.roomId ?? '',
          joinCode: this.meta?.joinCode ?? '',
          echoCount: this.legacyStub.echoCount,
          lastEcho: this.legacyStub.lastEcho,
        },
      });
    }

    // Phase 4.2 — WebSocket upgrade.
    if (path.endsWith('/ws')) {
      const upgrade = request.headers.get('Upgrade');
      if (upgrade?.toLowerCase() !== 'websocket') {
        return new Response('Expected websocket', { status: 426 });
      }
      await this.ensureLoaded();
      return this.acceptWebSocket();
    }

    return new Response('Not found', { status: 404 });
  }

  // -------------------------------------------------------------------------
  // Alarm — fires when the active human turn deadline expires.
  // -------------------------------------------------------------------------

  async alarm(): Promise<void> {
    await this.ensureLoaded();
    if (this.game === null) return;
    if (this.turnDeadline === null) return;
    if (Date.now() < this.turnDeadline) {
      // Stale alarm (deadline pushed forward); rearm.
      this.armTurnTimer();
      return;
    }
    this.applyServerIntent({ type: 'forfeit' }, 'timer');
  }

  // -------------------------------------------------------------------------
  // Bootstrap helpers
  // -------------------------------------------------------------------------

  private async initRoom(roomId: string, joinCode: string): Promise<void> {
    this.meta = {
      roomId,
      joinCode,
      seats: DEFAULT_ONLINE_SEATS.map((seat) => ({ ...seat, claimed: false })),
    };
    this.game = createGame({
      players: DEFAULT_ONLINE_SEATS.map((s) => s.color),
      seatKinds: DEFAULT_ONLINE_SEATS.map((s) => s.kind),
    });
    this.seq = 0;
    this.armTurnTimer();
    this.scheduleCpuIfNeeded();
    await this.persistMeta();
  }

  private async ensureLoaded(): Promise<void> {
    if (this.meta !== null && this.game !== null) return;
    const stored = await this.ctx.storage.get<{
      meta?: RoomMeta;
      legacy?: LegacyStub;
    }>('roomMeta');
    if (stored?.meta) {
      this.meta = {
        ...stored.meta,
        seats: stored.meta.seats.map((s) => ({ ...s, claimed: false })),
      };
    }
    if (stored?.legacy) {
      this.legacyStub = stored.legacy;
    }
    if (this.meta !== null && this.game === null) {
      // Re-create the engine; the DO loses in-memory state across hibernation.
      this.game = createGame({
        players: this.meta.seats.map((s) => s.color),
        seatKinds: this.meta.seats.map((s) => s.kind),
      });
      this.armTurnTimer();
      this.scheduleCpuIfNeeded();
    }
  }

  private async persistMeta(): Promise<void> {
    await this.ctx.storage.put('roomMeta', {
      meta: this.meta,
      legacy: this.legacyStub,
    });
  }

  private async persistLegacyStub(): Promise<void> {
    await this.persistMeta();
  }

  // -------------------------------------------------------------------------
  // WebSocket plumbing
  // -------------------------------------------------------------------------

  private acceptWebSocket(): Response {
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];

    server.accept();
    const info: ConnectionInfo = {
      id: crypto.randomUUID(),
      seat: null,
      displayName: null,
    };
    this.connections.set(server, info);

    server.addEventListener('message', (event) => {
      this.handleMessage(server, event.data).catch((error) => {
        console.error('GameRoom message error', error);
        this.sendError(server, 'bad_message', 'internal error');
      });
    });

    const cleanup = (): void => {
      const conn = this.connections.get(server);
      if (conn?.seat) {
        // Free the seat on disconnect; phase 4.3 will add reconnect grace.
        const seat = this.meta?.seats[conn.seat.seatIndex];
        if (seat) seat.claimed = false;
      }
      this.connections.delete(server);
    };
    server.addEventListener('close', cleanup);
    server.addEventListener('error', cleanup);

    return new Response(null, { status: 101, webSocket: client });
  }

  private async handleMessage(socket: WebSocket, raw: unknown): Promise<void> {
    if (typeof raw !== 'string') {
      this.sendError(socket, 'bad_message', 'expected text frame');
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      this.sendError(socket, 'bad_message', 'invalid JSON');
      return;
    }
    const msg = parseClientMessage(parsed);
    if (msg === null) {
      this.sendError(socket, 'bad_message', 'unrecognized payload');
      return;
    }
    await this.dispatch(socket, msg);
  }

  private async dispatch(socket: WebSocket, msg: ClientMessage): Promise<void> {
    if (this.meta === null || this.game === null) {
      this.sendError(socket, 'bad_message', 'room not initialised');
      return;
    }
    const conn = this.connections.get(socket);
    if (!conn) return;

    switch (msg.type) {
      case 'ping':
        this.send(socket, { type: 'pong' });
        return;

      case 'join': {
        if (msg.joinCode !== this.meta.joinCode) {
          this.sendError(socket, 'bad_join_code', 'join code does not match');
          return;
        }
        if (conn.seat !== null) {
          this.send(socket, {
            type: 'welcome',
            roomId: this.meta.roomId,
            seat: conn.seat,
            state: this.publicState(),
            seq: this.seq,
          });
          return;
        }
        const seatIndex = this.meta.seats.findIndex(
          (s) => s.kind === 'human' && !s.claimed,
        );
        if (seatIndex < 0) {
          this.sendError(socket, 'room_full', 'all human seats taken');
          return;
        }
        const seat = this.meta.seats[seatIndex]!;
        seat.claimed = true;
        const assignment: SeatAssignment = {
          seatIndex,
          color: seat.color,
          kind: seat.kind,
        };
        conn.seat = assignment;
        conn.displayName = msg.displayName ?? null;
        this.send(socket, {
          type: 'welcome',
          roomId: this.meta.roomId,
          seat: assignment,
          state: this.publicState(),
          seq: this.seq,
        });
        return;
      }

      case 'intent': {
        if (conn.seat === null) {
          this.sendError(socket, 'not_joined', 'send join before intent');
          return;
        }
        if (!this.checkRate(socket)) {
          this.sendError(socket, 'rate_limited', 'too many intents');
          return;
        }
        const expected = activeColor(this.game);
        if (expected !== conn.seat.color) {
          this.sendError(socket, 'not_your_turn', `it is ${expected}'s turn`);
          return;
        }
        this.applyServerIntent(msg.intent, 'client', socket);
        return;
      }
    }
  }

  // -------------------------------------------------------------------------
  // Intent application + broadcast
  // -------------------------------------------------------------------------

  private applyServerIntent(
    intent: GameIntent,
    origin: 'client' | 'cpu' | 'timer',
    sender?: WebSocket,
  ): void {
    if (this.game === null) return;
    let next: GameState;
    try {
      next = applyIntent(this.game, intent);
    } catch (error) {
      if (error instanceof IllegalIntentError && sender) {
        this.sendError(sender, 'illegal_intent', error.message);
      } else if (!(error instanceof IllegalIntentError)) {
        console.error(`GameRoom ${origin} intent crashed`, error);
      }
      return;
    }
    this.game = next;
    this.seq += 1;
    this.armTurnTimer();
    this.broadcastState();
    this.scheduleCpuIfNeeded();
  }

  private broadcastState(): void {
    if (this.game === null) return;
    const payload: ServerMessage = {
      type: 'state',
      state: this.publicState(),
      seq: this.seq,
    };
    for (const socket of this.connections.keys()) {
      this.send(socket, payload);
    }
  }

  private publicState(): PublicGameState {
    if (this.game === null) {
      throw new Error('publicState called before game initialised');
    }
    const remaining =
      this.turnDeadline === null
        ? 0
        : Math.max(0, Math.ceil((this.turnDeadline - Date.now()) / 1000));
    return {
      ...this.game,
      turnDeadline: this.turnDeadline,
      turnSecondsRemaining: remaining,
    };
  }

  // -------------------------------------------------------------------------
  // Turn timer (server-authoritative)
  // -------------------------------------------------------------------------

  private armTurnTimer(): void {
    if (this.game === null) {
      this.turnDeadline = null;
      void this.ctx.storage.deleteAlarm();
      return;
    }
    if (this.game.winner !== null || activeSeatKind(this.game) !== 'human') {
      this.turnDeadline = null;
      void this.ctx.storage.deleteAlarm();
      return;
    }
    this.turnDeadline = Date.now() + TURN_TIMER_SECONDS * 1000;
    void this.ctx.storage.setAlarm(this.turnDeadline);
  }

  // -------------------------------------------------------------------------
  // CPU driver
  // -------------------------------------------------------------------------

  private scheduleCpuIfNeeded(): void {
    if (this.cpuTimer !== null) {
      clearTimeout(this.cpuTimer);
      this.cpuTimer = null;
    }
    if (this.game === null) return;
    if (this.game.winner !== null) return;
    if (activeSeatKind(this.game) !== 'cpu') return;

    const snapshot = this.game;
    this.cpuTimer = setTimeout(() => {
      this.cpuTimer = null;
      if (this.game !== snapshot) return; // state moved on — bail.
      this.runCpuTurn();
    }, CPU_THINK_DELAY_MS);
  }

  private runCpuTurn(): void {
    if (this.game === null) return;
    if (activeSeatKind(this.game) !== 'cpu') return;
    if (this.game.phase === 'roll') {
      const die = randomDie();
      this.applyServerIntent({ type: 'roll', die }, 'cpu');
      return;
    }
    const move = chooseMove(this.game);
    if (move === null) {
      this.applyServerIntent({ type: 'forfeit' }, 'cpu');
      return;
    }
    this.applyServerIntent({ type: 'move', piece: move.piece }, 'cpu');
  }

  // -------------------------------------------------------------------------
  // Misc helpers
  // -------------------------------------------------------------------------

  private send(socket: WebSocket, payload: ServerMessage): void {
    try {
      socket.send(JSON.stringify(payload));
    } catch (error) {
      console.error('GameRoom send failed', error);
    }
  }

  private sendError(socket: WebSocket, code: ServerErrorCode, message: string): void {
    this.send(socket, { type: 'error', code, message });
  }

  private checkRate(socket: WebSocket): boolean {
    const now = Date.now();
    const stamps = (this.intentTimestamps.get(socket) ?? []).filter(
      (t) => now - t < 1000,
    );
    if (stamps.length >= INTENT_RATE_PER_SECOND) return false;
    stamps.push(now);
    this.intentTimestamps.set(socket, stamps);
    return true;
  }
}

/** Server-side die roll. Math.random is fine for v1; CSPRNG not required. */
function randomDie(): 1 | 2 | 3 | 4 | 5 | 6 {
  return (1 + Math.floor(Math.random() * 6)) as 1 | 2 | 3 | 4 | 5 | 6;
}
