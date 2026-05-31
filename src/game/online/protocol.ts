/**
 * Wire protocol for the online room (`api-design.mdc`).
 *
 * Shared between the Cloudflare Worker / Durable Object (`worker/`) and the
 * online client (`src/features/online/`). Keep this module free of React,
 * DOM, and Worker-only globals so both sides can import it.
 *
 * Phase 4.2 (`opus`):
 * - `join` assigns the next free seat and replies with a `state` snapshot.
 * - `intent` is validated by `game/rules.ts` via {@link applyIntent}; rejects
 *   surface as `error` and do not advance `seq`.
 * - Server broadcasts `state` snapshots with a monotonic `seq` and the
 *   absolute `turnDeadline` (epoch ms) so clients can render a synced
 *   countdown.
 */

import type { GameIntent, GameState } from '../rules.ts';
import type { PlayerColor, PlayerKind } from '../types.ts';

/** Number of seconds before an online human turn auto-skips (`O14`). */
export const TURN_TIMER_SECONDS = 30;

/** Default seat layout used while phase 4.3 lobby UI is not wired yet. */
export const DEFAULT_ONLINE_SEATS: readonly {
  readonly color: PlayerColor;
  readonly kind: PlayerKind;
}[] = [
  { color: 'red', kind: 'human' },
  { color: 'green', kind: 'human' },
  { color: 'yellow', kind: 'cpu' },
  { color: 'blue', kind: 'cpu' },
];

/** Seat assigned to a connected client, or `null` while it spectates. */
export interface SeatAssignment {
  readonly seatIndex: number;
  readonly color: PlayerColor;
  readonly kind: PlayerKind;
}

/**
 * Public state broadcast to every client on every change. Currently equal to
 * the engine state plus timer metadata; if we later split private/public
 * information, narrow this shape in one place.
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
  | { readonly type: 'join'; readonly joinCode: string; readonly displayName?: string }
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
  | 'not_your_turn'
  | 'illegal_intent'
  | 'rate_limited';

export type ServerMessage =
  | {
      readonly type: 'welcome';
      readonly roomId: string;
      readonly seat: SeatAssignment;
      readonly state: PublicGameState;
      readonly seq: number;
    }
  | {
      readonly type: 'state';
      readonly state: PublicGameState;
      readonly seq: number;
    }
  | {
      readonly type: 'error';
      readonly code: ServerErrorCode;
      readonly message: string;
    }
  | { readonly type: 'pong' };

/** Narrow an unknown payload to a {@link ClientMessage}. */
export function parseClientMessage(raw: unknown): ClientMessage | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const candidate = raw as { type?: unknown };
  switch (candidate.type) {
    case 'join': {
      const m = raw as { joinCode?: unknown; displayName?: unknown };
      if (typeof m.joinCode !== 'string') return null;
      return {
        type: 'join',
        joinCode: m.joinCode,
        displayName: typeof m.displayName === 'string' ? m.displayName : undefined,
      };
    }
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
      const colors: readonly PlayerColor[] = ['red', 'green', 'yellow', 'blue'];
      if (
        typeof p.color !== 'string' ||
        !colors.includes(p.color as PlayerColor) ||
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
