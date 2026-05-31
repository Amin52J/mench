/**
 * Wire protocol for the online room (`api-design.mdc`).
 *
 * Shared between the Cloudflare Worker / Durable Object (`worker/`) and the
 * online client (`src/features/online/`, `src/features/lobby/`). Keep this
 * module free of React, DOM, and Worker-only globals so both sides can import it.
 */

import type { GameIntent, GameState } from '../rules.ts';
import type { PlayerColor, PlayerKind } from '../types.ts';
import { PLAYER_COLORS } from '../types.ts';

/** Number of seconds before an online human turn auto-skips (`O14`). */
export const TURN_TIMER_SECONDS = 30;

/** Seat stays reserved after disconnect until this grace window elapses (phase 4.3). */
export const RECONNECT_GRACE_MS = 60_000;

export type OnlinePlayerCount = 2 | 3 | 4;

/** Default lobby layout for a freshly created room. */
export const DEFAULT_ONLINE_SETUP: {
  readonly playerCount: OnlinePlayerCount;
  readonly seats: readonly { readonly kind: PlayerKind }[];
} = {
  playerCount: 4,
  seats: [
    { kind: 'human' },
    { kind: 'human' },
    { kind: 'human' },
    { kind: 'human' },
  ],
};

/** Seat assigned to a connected client, or `null` while it spectates. */
export interface SeatAssignment {
  readonly seatIndex: number;
  readonly color: PlayerColor;
  readonly kind: PlayerKind;
}

/** One row in the pre-game lobby broadcast. */
export interface LobbySeatView {
  readonly color: PlayerColor;
  readonly kind: PlayerKind;
  readonly claimed: boolean;
  readonly disconnected: boolean;
  readonly displayName: string | null;
}

/** Host-authoritative setup synced to every client before `started`. */
export interface LobbyState {
  readonly roomId: string;
  readonly joinCode: string;
  readonly playerCount: OnlinePlayerCount;
  readonly seats: readonly LobbySeatView[];
  readonly hostConnectionId: string;
  readonly started: boolean;
}

/**
 * Public state broadcast during play. Equal to the engine state plus timer
 * metadata; narrow here if we later split private/public information.
 */
export interface PublicGameState extends GameState {
  /** Epoch ms at which the current human turn auto-skips. `null` for CPU turns or finished games. */
  readonly turnDeadline: number | null;
  /** Seconds remaining until {@link turnDeadline}; clamped at 0 for CPU/finished turns. */
  readonly turnSecondsRemaining: number;
}

// ---------------------------------------------------------------------------
// Client → Server
// ---------------------------------------------------------------------------

export type ClientMessage =
  | {
      readonly type: 'join';
      readonly joinCode: string;
      readonly displayName?: string;
      readonly resumeToken?: string;
    }
  | {
      readonly type: 'update_setup';
      readonly playerCount: OnlinePlayerCount;
      readonly seats: readonly { readonly kind: PlayerKind }[];
    }
  | { readonly type: 'start_game' }
  | { readonly type: 'intent'; readonly intent: GameIntent }
  | { readonly type: 'ping' };

// ---------------------------------------------------------------------------
// Server → Client
// ---------------------------------------------------------------------------

export type ServerErrorCode =
  | 'bad_message'
  | 'bad_join_code'
  | 'room_full'
  | 'not_joined'
  | 'not_host'
  | 'not_lobby'
  | 'not_your_turn'
  | 'illegal_intent'
  | 'rate_limited';

export type RoomNoticeKind = 'player_left' | 'player_rejoined';

/** Ephemeral presence event broadcast to everyone in the room. */
export interface RoomNotice {
  readonly kind: RoomNoticeKind;
  readonly seatIndex: number;
  readonly color: PlayerColor;
  readonly displayName: string | null;
}

export type ServerMessage =
  | {
      readonly type: 'welcome';
      readonly roomId: string;
      readonly connectionId: string;
      readonly resumeToken: string;
      readonly isHost: boolean;
      readonly seat: SeatAssignment | null;
      readonly lobby: LobbyState;
      readonly state: PublicGameState | null;
      readonly seq: number;
    }
  | {
      readonly type: 'lobby';
      readonly lobby: LobbyState;
      readonly seq: number;
    }
  | {
      readonly type: 'state';
      readonly state: PublicGameState;
      readonly seq: number;
    }
  | {
      readonly type: 'room_notice';
      readonly notice: RoomNotice;
      readonly seq: number;
    }
  | {
      readonly type: 'room_closed';
      readonly reason: string;
    }
  | {
      readonly type: 'error';
      readonly code: ServerErrorCode;
      readonly message: string;
    }
  | { readonly type: 'pong' };

/** @deprecated Use {@link DEFAULT_ONLINE_SETUP} — kept for worker imports during migration. */
export const DEFAULT_ONLINE_SEATS = DEFAULT_ONLINE_SETUP.seats.map((seat, index) => ({
  color: PLAYER_COLORS[index]!,
  kind: seat.kind,
}));

/** Narrow an unknown payload to a {@link ClientMessage}. */
export function parseClientMessage(raw: unknown): ClientMessage | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const candidate = raw as { type?: unknown };
  switch (candidate.type) {
    case 'join': {
      const m = raw as {
        joinCode?: unknown;
        displayName?: unknown;
        resumeToken?: unknown;
      };
      if (typeof m.joinCode !== 'string') return null;
      return {
        type: 'join',
        joinCode: m.joinCode,
        displayName: typeof m.displayName === 'string' ? m.displayName : undefined,
        resumeToken: typeof m.resumeToken === 'string' ? m.resumeToken : undefined,
      };
    }
    case 'update_setup': {
      const m = raw as { playerCount?: unknown; seats?: unknown };
      const playerCount = parsePlayerCount(m.playerCount);
      const seats = parseSetupSeats(m.seats);
      if (playerCount === null || seats === null) return null;
      return { type: 'update_setup', playerCount, seats };
    }
    case 'start_game':
      return { type: 'start_game' };
    case 'intent': {
      const m = raw as { intent?: unknown };
      const intent = parseIntent(m.intent);
      if (intent === null) return null;
      return { type: 'intent', intent };
    }
    case 'ping':
      return { type: 'ping' };
    default:
      return null;
  }
}

function parsePlayerCount(value: unknown): OnlinePlayerCount | null {
  if (value === 2 || value === 3 || value === 4) return value;
  return null;
}

function parseSetupSeats(
  raw: unknown,
): readonly { readonly kind: PlayerKind }[] | null {
  if (!Array.isArray(raw)) return null;
  const kinds: { kind: PlayerKind }[] = [];
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) return null;
    const kind = (item as { kind?: unknown }).kind;
    if (kind !== 'human' && kind !== 'cpu') return null;
    kinds.push({ kind });
  }
  if (kinds.length < 2 || kinds.length > 4) return null;
  return kinds;
}

function parseIntent(raw: unknown): GameIntent | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const candidate = raw as { type?: unknown };
  switch (candidate.type) {
    case 'roll': {
      const m = raw as { die?: unknown };
      if (
        typeof m.die !== 'number' ||
        !Number.isInteger(m.die) ||
        m.die < 1 ||
        m.die > 6
      ) {
        return null;
      }
      return { type: 'roll', die: m.die as 1 | 2 | 3 | 4 | 5 | 6 };
    }
    case 'move': {
      const m = raw as { piece?: unknown };
      if (typeof m.piece !== 'object' || m.piece === null) return null;
      const p = m.piece as { color?: unknown; index?: unknown };
      if (
        typeof p.color !== 'string' ||
        !PLAYER_COLORS.includes(p.color as PlayerColor) ||
        typeof p.index !== 'number' ||
        ![0, 1, 2, 3].includes(p.index)
      ) {
        return null;
      }
      return {
        type: 'move',
        piece: { color: p.color as PlayerColor, index: p.index as 0 | 1 | 2 | 3 },
      };
    }
    case 'forfeit':
      return { type: 'forfeit' };
    default:
      return null;
  }
}
