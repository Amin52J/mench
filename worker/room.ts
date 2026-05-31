/**
 * `GameRoom` Durable Object — server-authoritative online room.
 *
 * Phase 4.3 adds a host-authoritative lobby (setup sync, start game), reconnect
 * grace, and host promotion on leave (`api-design.mdc`, `product.mdc`).
 */

import {
  activeColor,
  activeSeatKind,
  applyIntent,
  IllegalIntentError,
  isGameOver,
  withSeatKind,
  type GameIntent,
  type GameState,
} from '@game/rules';
import { createGame } from '@game/rules';
import { chooseMove } from '@game/ai';
import type { PlayerColor, PlayerKind } from '@game/types';
import { PLAYER_COLORS, turnTimerApplies } from '@game/types';

import {
  DEFAULT_ONLINE_SETUP,
  RECONNECT_GRACE_MS,
  TURN_TIMER_SECONDS,
  parseClientMessage,
  type ClientMessage,
  type LobbySeatView,
  type LobbyState,
  type OnlinePlayerCount,
  type PublicGameState,
  type RoomNotice,
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
  readonly resumeToken: string;
  seat: SeatAssignment | null;
  displayName: string | null;
}

interface SeatSlot {
  readonly color: PlayerColor;
  kind: PlayerKind;
  claimed: boolean;
  connectionId: string | null;
  displayName: string | null;
  resumeToken: string | null;
  graceUntil: number | null;
  disconnected: boolean;
}

interface RoomMeta {
  readonly roomId: string;
  readonly joinCode: string;
  playerCount: OnlinePlayerCount;
  seats: SeatSlot[];
  hostConnectionId: string | null;
  /** When the host socket drops, promote only after this instant. */
  hostGraceUntil: number | null;
  hostResumeToken: string | null;
  started: boolean;
}

/** Per-intent rate cap to absorb misbehaving clients (`api-design.mdc`). */
const INTENT_RATE_PER_SECOND = 10;
const CPU_THINK_DELAY_MS = 450;

// ---------------------------------------------------------------------------
// Durable Object
// ---------------------------------------------------------------------------

export class GameRoom implements DurableObject {
  private meta: RoomMeta | null = null;
  private game: GameState | null = null;
  private seq = 0;
  private turnDeadline: number | null = null;
  private readonly connections = new Map<WebSocket, ConnectionInfo>();
  private readonly intentTimestamps = new WeakMap<WebSocket, number[]>();
  private cpuTimer: ReturnType<typeof setTimeout> | null = null;
  private legacyStub: LegacyStub = {
    message: 'hello',
    echoCount: 0,
    lastEcho: undefined,
  };

  constructor(private readonly ctx: DurableObjectState) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

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
      await this.persistMeta();
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

  async alarm(): Promise<void> {
    await this.ensureLoaded();
    if (this.meta === null) return;

    const now = Date.now();
    let seatsChanged = false;
    for (const seat of this.meta.seats) {
      if (seat.graceUntil !== null && now >= seat.graceUntil) {
        this.clearSeatReservation(seat);
        seatsChanged = true;
      }
    }
    if (seatsChanged) {
      await this.onSeatReservationsChanged();
    }

    if (
      this.meta.hostGraceUntil !== null &&
      now >= this.meta.hostGraceUntil &&
      !this.isHostConnected()
    ) {
      this.meta.hostGraceUntil = null;
      this.promoteHostOrClose();
    }

    if (this.game === null) return;
    if (this.turnDeadline === null) return;
    if (Date.now() < this.turnDeadline) {
      this.armTurnTimer();
      return;
    }
    this.playTimerTurn();
  }

  private async initRoom(roomId: string, joinCode: string): Promise<void> {
    this.meta = {
      roomId,
      joinCode,
      playerCount: DEFAULT_ONLINE_SETUP.playerCount,
      seats: buildSeatSlots(DEFAULT_ONLINE_SETUP.playerCount, DEFAULT_ONLINE_SETUP.seats),
      hostConnectionId: null,
      hostGraceUntil: null,
      hostResumeToken: null,
      started: false,
    };
    this.game = null;
    this.seq = 0;
    this.turnDeadline = null;
    await this.persistMeta();
  }

  private async ensureLoaded(): Promise<void> {
    if (this.meta !== null) return;
    const stored = await this.ctx.storage.get<{
      meta?: RoomMeta;
      legacy?: LegacyStub;
    }>('roomMeta');
    if (stored?.meta) {
      this.meta = {
        ...stored.meta,
        hostGraceUntil: stored.meta.hostGraceUntil ?? null,
        hostResumeToken: stored.meta.hostResumeToken ?? null,
        seats: stored.meta.seats.map((s) => ({ ...s })),
      };
    }
    if (stored?.legacy) {
      this.legacyStub = stored.legacy;
    }
    if (this.meta?.started && this.game === null) {
      this.game = createGameFromMeta(this.meta, this.connections);
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

  private acceptWebSocket(): Response {
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];

    server.accept();
    const info: ConnectionInfo = {
      id: crypto.randomUUID(),
      resumeToken: crypto.randomUUID(),
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
      this.handleDisconnect(server);
    };
    server.addEventListener('close', cleanup);
    server.addEventListener('error', cleanup);

    return new Response(null, { status: 101, webSocket: client });
  }

  private handleDisconnect(socket: WebSocket): void {
    const conn = this.connections.get(socket);
    if (!conn || this.meta === null) {
      this.connections.delete(socket);
      return;
    }

    const wasHost = conn.id === this.meta.hostConnectionId;
    if (wasHost) {
      this.meta.hostGraceUntil = Date.now() + RECONNECT_GRACE_MS;
    }
    if (conn.seat) {
      const seatIndex = conn.seat.seatIndex;
      const slot = this.meta.seats[seatIndex];
      if (slot) {
        slot.disconnected = true;
        slot.graceUntil = Date.now() + RECONNECT_GRACE_MS;
      }
      if (this.meta.started && this.game !== null && slot?.kind === 'human') {
        this.substituteSeatWithCpu(seatIndex, slot.displayName);
      }
    }
    conn.seat = null;
    this.connections.delete(socket);

    void this.persistMeta().then(() => this.onSeatReservationsChanged());
  }

  private isHostConnected(): boolean {
    if (this.meta?.hostConnectionId === null) return false;
    return [...this.connections.values()].some(
      (c) => c.id === this.meta!.hostConnectionId,
    );
  }

  private async onSeatReservationsChanged(): Promise<void> {
    if (this.meta === null) return;
    this.expireGraceSeats();
    if (this.meta.started) {
      this.broadcastState();
    } else {
      this.broadcastLobby();
    }
  }

  private expireGraceSeats(): void {
    if (this.meta === null) return;
    const now = Date.now();
    for (const seat of this.meta.seats) {
      if (seat.graceUntil !== null && now >= seat.graceUntil) {
        this.clearSeatReservation(seat);
      }
    }
  }

  private clearSeatReservation(seat: SeatSlot): void {
    seat.claimed = false;
    seat.connectionId = null;
    seat.displayName = null;
    seat.resumeToken = null;
    seat.graceUntil = null;
    seat.disconnected = false;
  }

  private promoteHostOrClose(): void {
    if (this.meta === null) return;
    const candidates = [...this.connections.values()]
      .filter((c) => c.seat?.kind === 'human')
      .sort((a, b) => (a.seat?.seatIndex ?? 99) - (b.seat?.seatIndex ?? 99));
    const next = candidates[0];
    if (!next) {
      this.closeRoom('host_left');
      return;
    }
    this.meta.hostConnectionId = next.id;
    this.meta.hostResumeToken = next.resumeToken;
    this.meta.hostGraceUntil = null;
    this.broadcastLobby();
  }

  private closeRoom(reason: string): void {
    const payload: ServerMessage = { type: 'room_closed', reason };
    for (const socket of this.connections.keys()) {
      this.send(socket, payload);
      try {
        socket.close(1000, reason);
      } catch {
        /* ignore */
      }
    }
    this.connections.clear();
    if (this.meta) {
      this.meta.started = true;
    }
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
    if (this.meta === null) {
      this.sendError(socket, 'bad_message', 'room not initialised');
      return;
    }
    const conn = this.connections.get(socket);
    if (!conn) return;

    switch (msg.type) {
      case 'ping':
        this.send(socket, { type: 'pong' });
        return;

      case 'join':
        await this.handleJoin(socket, conn, msg);
        return;

      case 'update_setup':
        this.handleUpdateSetup(socket, conn, msg);
        return;

      case 'start_game':
        this.handleStartGame(socket, conn);
        return;

      case 'intent':
        this.handleIntent(socket, conn, msg);
        return;
    }
  }

  private async handleJoin(
    socket: WebSocket,
    conn: ConnectionInfo,
    msg: Extract<ClientMessage, { type: 'join' }>,
  ): Promise<void> {
    if (msg.joinCode.toUpperCase() !== this.meta!.joinCode.toUpperCase()) {
      this.sendError(socket, 'bad_join_code', 'join code does not match');
      return;
    }

    this.expireGraceSeats();

    if (conn.seat !== null) {
      this.sendWelcome(socket, conn);
      return;
    }

    if (msg.resumeToken) {
      const resumed = this.tryResumeSeat(conn, msg.resumeToken, msg.displayName ?? null);
      if (resumed) {
        if (msg.resumeToken === this.meta!.hostResumeToken) {
          this.meta!.hostConnectionId = conn.id;
          this.meta!.hostGraceUntil = null;
        }
        this.sendWelcome(socket, conn);
        if (this.meta!.started) {
          this.broadcastState();
        } else {
          this.broadcastLobby();
        }
        return;
      }
    }

    if (this.meta!.hostConnectionId === null) {
      this.meta!.hostConnectionId = conn.id;
      this.meta!.hostResumeToken = conn.resumeToken;
    }

    const seatIndex = this.findJoinableSeatIndex();
    if (seatIndex < 0) {
      this.sendError(socket, 'room_full', 'no human seats available');
      return;
    }

    const slot = this.meta!.seats[seatIndex]!;
    if (slot.kind !== 'human') {
      this.sendError(socket, 'room_full', 'seat is not joinable');
      return;
    }

    this.assignSeat(conn, slot, seatIndex, msg.displayName ?? null);
    await this.persistMeta();
    this.sendWelcome(socket, conn);
    this.broadcastLobby();
  }

  private tryResumeSeat(
    conn: ConnectionInfo,
    resumeToken: string,
    displayName: string | null,
  ): boolean {
    if (this.meta === null) return false;
    const now = Date.now();
    const seatIndex = this.meta.seats.findIndex(
      (s) =>
        s.resumeToken === resumeToken &&
        s.graceUntil !== null &&
        now < s.graceUntil,
    );
    if (seatIndex < 0) return false;
    const slot = this.meta.seats[seatIndex]!;
    slot.disconnected = false;
    slot.graceUntil = null;
    this.assignSeat(conn, slot, seatIndex, displayName ?? slot.displayName);
    if (this.meta.started && this.game !== null) {
      this.restoreSeatToHuman(seatIndex, slot.displayName);
    }
    return true;
  }

  private assignSeat(
    conn: ConnectionInfo,
    slot: SeatSlot,
    seatIndex: number,
    displayName: string | null,
  ): void {
    slot.claimed = true;
    slot.connectionId = conn.id;
    slot.displayName = displayName;
    slot.resumeToken = conn.resumeToken;
    slot.disconnected = false;
    slot.graceUntil = null;
    conn.displayName = displayName;
    conn.seat = {
      seatIndex,
      color: slot.color,
      kind: slot.kind,
    };
  }

  private findJoinableSeatIndex(): number {
    if (this.meta === null) return -1;
    for (let i = 0; i < this.meta.playerCount; i++) {
      const slot = this.meta.seats[i]!;
      if (slot.kind === 'human' && !slot.claimed) return i;
    }
    return -1;
  }

  private handleUpdateSetup(
    socket: WebSocket,
    conn: ConnectionInfo,
    msg: Extract<ClientMessage, { type: 'update_setup' }>,
  ): void {
    if (this.meta === null) return;
    if (this.meta.started) {
      this.sendError(socket, 'not_lobby', 'game already started');
      return;
    }
    if (conn.id !== this.meta.hostConnectionId) {
      this.sendError(socket, 'not_host', 'only the host can change setup');
      return;
    }
    if (msg.seats.length !== msg.playerCount) {
      this.sendError(socket, 'bad_message', 'seats length must match playerCount');
      return;
    }

    this.meta.playerCount = msg.playerCount;
    const nextSlots = buildSeatSlots(msg.playerCount, msg.seats);
    for (let i = 0; i < nextSlots.length; i++) {
      const prev = this.meta.seats[i];
      const next = nextSlots[i]!;
      if (prev?.claimed && prev.connectionId) {
        if (next.kind === 'human') {
          next.claimed = true;
          next.connectionId = prev.connectionId;
          next.displayName = prev.displayName;
          next.resumeToken = prev.resumeToken;
          next.graceUntil = prev.graceUntil;
          next.disconnected = prev.disconnected;
        } else {
          this.evictSeatToHumanOrSpectate(prev.connectionId);
        }
      }
    }
    this.meta.seats = nextSlots;
    void this.persistMeta();
    this.broadcastLobby();
  }

  /** Player lost a seat because the host marked it CPU — re-seat or drop to spectator. */
  private evictSeatToHumanOrSpectate(connectionId: string): void {
    for (const [socket, conn] of this.connections) {
      if (conn.id !== connectionId) continue;
      conn.seat = null;
      const seatIndex = this.findJoinableSeatIndex();
      if (seatIndex >= 0 && this.meta !== null) {
        this.assignSeat(conn, this.meta.seats[seatIndex]!, seatIndex, conn.displayName);
      }
      this.sendWelcome(socket, conn);
      return;
    }
    this.releaseConnectionSeat(connectionId);
  }

  /** Drop stale claims on CPU slots; re-seat humans who lost a slot to setup changes. */
  private syncSeatClaimsFromConnections(): void {
    if (this.meta === null) return;
    for (let i = 0; i < this.meta.seats.length; i++) {
      const slot = this.meta.seats[i]!;
      if (slot.kind !== 'human') {
        slot.claimed = false;
        slot.connectionId = null;
        continue;
      }
      const conn = [...this.connections.values()].find((c) => c.seat?.seatIndex === i);
      if (conn?.seat) {
        slot.claimed = true;
        slot.connectionId = conn.id;
        slot.displayName = conn.displayName;
        slot.resumeToken = conn.resumeToken;
        slot.disconnected = false;
        slot.graceUntil = null;
      } else if (slot.graceUntil !== null && Date.now() < slot.graceUntil) {
        slot.claimed = true;
      } else {
        slot.claimed = false;
        slot.connectionId = null;
      }
    }
  }

  private reconcileSeatsBeforeStart(): void {
    if (this.meta === null) return;
    for (let i = 0; i < this.meta.playerCount; i++) {
      const slot = this.meta.seats[i]!;
      if (slot.kind === 'cpu' && slot.claimed) {
        if (slot.connectionId) {
          this.evictSeatToHumanOrSpectate(slot.connectionId);
        }
        this.clearSeatReservation(slot);
      }
    }
  }

  private releaseConnectionSeat(connectionId: string): void {
    for (const conn of this.connections.values()) {
      if (conn.id === connectionId) {
        conn.seat = null;
      }
    }
  }

  private handleStartGame(socket: WebSocket, conn: ConnectionInfo): void {
    if (this.meta === null) return;
    if (this.meta.started) {
      this.sendError(socket, 'not_lobby', 'game already started');
      return;
    }
    if (conn.id !== this.meta.hostConnectionId) {
      this.sendError(socket, 'not_host', 'only the host can start');
      return;
    }

    const hasHumanSeat = this.meta.seats
      .slice(0, this.meta.playerCount)
      .some((s) => s.kind === 'human');
    if (!hasHumanSeat) {
      this.sendError(socket, 'bad_message', 'at least one human seat required');
      return;
    }

    this.reconcileSeatsBeforeStart();
    this.syncSeatClaimsFromConnections();
    this.meta.started = true;
    this.game = createGameFromMeta(this.meta, this.connections);
    this.armTurnTimer();
    void this.persistMeta();
    // Lobby snapshot (`started: true`) must reach clients — `state` alone left the UI stuck on lobby.
    this.broadcastLobby();
    this.seq += 1;
    this.broadcastState();
    this.scheduleCpuIfNeeded();
  }

  private handleIntent(
    socket: WebSocket,
    conn: ConnectionInfo,
    msg: Extract<ClientMessage, { type: 'intent' }>,
  ): void {
    if (this.meta === null || this.game === null) {
      this.sendError(socket, 'not_lobby', 'game has not started');
      return;
    }
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
    const runtimeKind = this.game.seatKinds[conn.seat.seatIndex];
    if (runtimeKind !== 'human') {
      this.sendError(socket, 'not_your_turn', 'this seat is controlled by CPU');
      return;
    }
    this.applyServerIntent(msg.intent, 'client', socket);
  }

  private sendWelcome(socket: WebSocket, conn: ConnectionInfo): void {
    if (this.meta === null) return;
    this.send(socket, {
      type: 'welcome',
      roomId: this.meta.roomId,
      connectionId: conn.id,
      resumeToken: conn.resumeToken,
      isHost: conn.id === this.meta.hostConnectionId,
      seat: conn.seat,
      lobby: this.lobbySnapshot(),
      state: this.game ? this.publicState() : null,
      seq: this.seq,
    });
  }

  private lobbySnapshot(): LobbyState {
    if (this.meta === null) throw new Error('lobby without meta');
    const seats: LobbySeatView[] = this.meta.seats
      .slice(0, this.meta.playerCount)
      .map((s) => ({
        color: s.color,
        kind: s.kind,
        claimed: s.claimed,
        disconnected:
          s.disconnected && s.graceUntil !== null && Date.now() < s.graceUntil,
        displayName: s.displayName,
      }));
    return {
      roomId: this.meta.roomId,
      joinCode: this.meta.joinCode,
      playerCount: this.meta.playerCount,
      seats,
      hostConnectionId: this.meta.hostConnectionId ?? '',
      started: this.meta.started,
    };
  }

  private broadcastLobby(): void {
    if (this.meta === null) return;
    this.seq += 1;
    const payload: ServerMessage = {
      type: 'lobby',
      lobby: this.lobbySnapshot(),
      seq: this.seq,
    };
    for (const socket of this.connections.keys()) {
      this.send(socket, payload);
    }
  }

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

  private armTurnTimer(): void {
    if (this.game === null) {
      this.turnDeadline = null;
      void this.ctx.storage.deleteAlarm();
      return;
    }
    if (
      isGameOver(this.game) ||
      activeSeatKind(this.game) !== 'human' ||
      !turnTimerApplies(this.game.seatKinds)
    ) {
      this.turnDeadline = null;
      void this.ctx.storage.deleteAlarm();
      return;
    }
    this.turnDeadline = Date.now() + TURN_TIMER_SECONDS * 1000;
    void this.ctx.storage.setAlarm(this.turnDeadline);
  }

  private scheduleCpuIfNeeded(): void {
    if (this.cpuTimer !== null) {
      clearTimeout(this.cpuTimer);
      this.cpuTimer = null;
    }
    if (this.game === null) return;
    if (isGameOver(this.game)) return;
    if (activeSeatKind(this.game) !== 'cpu') return;

    const snapshot = this.game;
    this.cpuTimer = setTimeout(() => {
      this.cpuTimer = null;
      if (this.game !== snapshot) return;
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

  /** Human seat timed out — play the rest of this turn with CPU logic; seat stays human. */
  private playTimerTurn(): void {
    if (this.game === null) return;
    const seatIndex = this.game.activePlayerIndex;
    if (this.game.seatKinds[seatIndex] !== 'human') return;

    let guard = 0;
    while (
      this.game !== null &&
      !isGameOver(this.game) &&
      this.game.activePlayerIndex === seatIndex &&
      this.game.seatKinds[seatIndex] === 'human' &&
      guard++ < 40
    ) {
      if (this.game.phase === 'roll') {
        this.applyServerIntent({ type: 'roll', die: randomDie() }, 'timer');
      } else {
        const pick = chooseMove(this.game);
        if (pick === null) {
          this.applyServerIntent({ type: 'forfeit' }, 'timer');
        } else {
          this.applyServerIntent({ type: 'move', piece: pick.piece }, 'timer');
        }
      }
    }
  }

  private substituteSeatWithCpu(seatIndex: number, displayName: string | null): void {
    if (this.game === null || this.meta === null) return;
    this.game = withSeatKind(this.game, seatIndex, 'cpu');
    const color = this.meta.seats[seatIndex]?.color ?? this.game.players[seatIndex]!;
    this.broadcastRoomNotice({
      kind: 'player_left',
      seatIndex,
      color,
      displayName,
    });
    this.broadcastState();
    this.scheduleCpuIfNeeded();
  }

  private restoreSeatToHuman(seatIndex: number, displayName: string | null): void {
    if (this.game === null || this.meta === null) return;
    this.game = withSeatKind(this.game, seatIndex, 'human');
    const color = this.meta.seats[seatIndex]?.color ?? this.game.players[seatIndex]!;
    this.broadcastRoomNotice({
      kind: 'player_rejoined',
      seatIndex,
      color,
      displayName,
    });
    this.broadcastState();
    this.armTurnTimer();
  }

  private broadcastRoomNotice(notice: RoomNotice): void {
    this.seq += 1;
    const payload: ServerMessage = { type: 'room_notice', notice, seq: this.seq };
    for (const socket of this.connections.keys()) {
      this.send(socket, payload);
    }
  }

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

function buildSeatSlots(
  playerCount: OnlinePlayerCount,
  seats: readonly { readonly kind: PlayerKind }[],
): SeatSlot[] {
  const colors = PLAYER_COLORS.slice(0, playerCount);
  return colors.map((color, index) => ({
    color,
    kind: seats[index]?.kind ?? 'human',
    claimed: false,
    connectionId: null,
    displayName: null,
    resumeToken: null,
    graceUntil: null,
    disconnected: false,
  }));
}

function createGameFromMeta(
  meta: RoomMeta,
  connections: ReadonlyMap<WebSocket, ConnectionInfo>,
): GameState {
  const players = PLAYER_COLORS.slice(0, meta.playerCount);
  const seatKinds = meta.seats.slice(0, meta.playerCount).map((slot, seatIndex) => {
    if (slot.kind !== 'human') return 'cpu' as const;
    const occupied = [...connections.values()].some(
      (c) => c.seat?.seatIndex === seatIndex,
    );
    if (occupied) return 'human' as const;
    if (slot.claimed && (slot.graceUntil === null || Date.now() < slot.graceUntil)) {
      return 'human' as const;
    }
    return 'cpu' as const;
  });
  return createGame({ players, seatKinds });
}

function randomDie(): 1 | 2 | 3 | 4 | 5 | 6 {
  return (1 + Math.floor(Math.random() * 6)) as 1 | 2 | 3 | 4 | 5 | 6;
}
