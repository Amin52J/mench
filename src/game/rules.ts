/**
 * Pure Ludo rules engine — reducer/API for the standard international Ludo
 * rules locked in `product.mdc` (no blockades, enter on 6, three-sixes forfeit,
 * exact finish, captures with safe-square exemption).
 *
 * No React / DOM / fetch imports (see `architecture.mdc`).
 *
 * Surface used by `features/session/` and `worker/room.ts`:
 *
 * - {@link createGame}
 * - {@link rollDice}
 * - {@link getLegalMoves}
 * - {@link applyMove}
 * - {@link forfeitTurn}
 * - {@link isGameOver}
 * - {@link GameIntent} (union forwarded from the Worker)
 */

import {
  HOME_FINISH_INDEX,
  HOME_LENGTH,
  TRACK_LENGTH,
  advanceAlongTrack,
  getStartTrackIndex,
  isSafeTrackIndex,
} from './board.ts';
import type {
  BoardState,
  PieceId,
  PieceIndex,
  PiecePosition,
  PlayerColor,
  PlayerKind,
} from './types.ts';
import { PLAYER_COLORS, createInitialBoardState, pieceKey } from './types.ts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DieValue = 1 | 2 | 3 | 4 | 5 | 6;

/** Phase of the active player's turn. */
export type TurnPhase =
  /** Player must roll the die next. */
  | 'roll'
  /** Player has rolled `dice` and must choose a legal move (or pass if none). */
  | 'move';

export interface GameState {
  readonly board: BoardState;
  /** Active seats, in clockwise turn order. Inactive colors are omitted. */
  readonly players: readonly PlayerColor[];
  /** Human vs CPU per seat; parallel to {@link players}. */
  readonly seatKinds: readonly PlayerKind[];
  /** Index into {@link players} of the seat whose turn it is. */
  readonly activePlayerIndex: number;
  readonly phase: TurnPhase;
  /** Last rolled value while {@link phase} === `'move'`; `null` otherwise. */
  readonly dice: DieValue | null;
  /** Count of consecutive sixes already rolled this turn (0–2 — a third 6 forfeits). */
  readonly consecutiveSixes: number;
  /** Set when all four pieces of a player have finished. */
  readonly winner: PlayerColor | null;
}

export interface LegalMove {
  readonly piece: PieceId;
  /** Position the piece would occupy after applying the move. */
  readonly to: PiecePosition;
  /** Capture victim (if any). */
  readonly capture: PieceId | null;
}

/**
 * Intents accepted by the reducer. Mirrors the wire format consumed by the
 * Worker so the client/server speak the same vocabulary (`architecture.mdc`).
 */
export type GameIntent =
  | { readonly type: 'roll'; readonly die: DieValue }
  | { readonly type: 'move'; readonly piece: PieceId }
  | { readonly type: 'forfeit' };

export class IllegalIntentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IllegalIntentError';
  }
}

// ---------------------------------------------------------------------------
// Construction
// ---------------------------------------------------------------------------

export interface CreateGameOptions {
  /** Seats in clockwise order. Length 2–4. Inactive colors are omitted. */
  readonly players: readonly PlayerColor[];
  /** Human vs CPU per seat; defaults to all humans when omitted. */
  readonly seatKinds?: readonly PlayerKind[];
  /** Optional override of the first player (index into `players`). */
  readonly startingPlayerIndex?: number;
}

export function createGame(options: CreateGameOptions): GameState {
  const { players, seatKinds: seatKindsInput, startingPlayerIndex = 0 } = options;
  if (players.length < 2 || players.length > 4) {
    throw new RangeError(`players must be 2..4, got ${players.length}`);
  }
  const seen = new Set<PlayerColor>();
  for (const color of players) {
    if (!PLAYER_COLORS.includes(color)) {
      throw new RangeError(`unknown player color: ${color}`);
    }
    if (seen.has(color)) {
      throw new RangeError(`duplicate player color: ${color}`);
    }
    seen.add(color);
  }
  if (
    !Number.isInteger(startingPlayerIndex) ||
    startingPlayerIndex < 0 ||
    startingPlayerIndex >= players.length
  ) {
    throw new RangeError(
      `startingPlayerIndex must be 0..${players.length - 1}, got ${startingPlayerIndex}`,
    );
  }

  const seatKinds =
    seatKindsInput === undefined
      ? (Array.from({ length: players.length }, () => 'human' as const) satisfies PlayerKind[])
      : [...seatKindsInput];
  if (seatKinds.length !== players.length) {
    throw new RangeError(
      `seatKinds length must match players (${players.length}), got ${seatKinds.length}`,
    );
  }
  for (const kind of seatKinds) {
    if (kind !== 'human' && kind !== 'cpu') {
      throw new RangeError(`unknown seat kind: ${String(kind)}`);
    }
  }

  return {
    board: createInitialBoardState(players),
    players,
    seatKinds,
    activePlayerIndex: startingPlayerIndex,
    phase: 'roll',
    dice: null,
    consecutiveSixes: 0,
    winner: null,
  };
}

// ---------------------------------------------------------------------------
// Dice
// ---------------------------------------------------------------------------

/**
 * Apply a rolled die. The roll source (RNG, server) is the caller's concern —
 * keeping the reducer deterministic. Returns the next state.
 *
 * Rules implemented:
 * - Cannot roll when `phase !== 'roll'` or the game has a winner.
 * - A third consecutive 6 forfeits the turn immediately (no move).
 * - If no legal move exists after the roll, the turn passes — except on a 6,
 *   which still consumes the consecutive-sixes counter and re-grants `'roll'`.
 */
export function rollDice(state: GameState, die: DieValue): GameState {
  if (state.winner !== null) {
    throw new IllegalIntentError('game is over');
  }
  if (state.phase !== 'roll') {
    throw new IllegalIntentError(`cannot roll in phase '${state.phase}'`);
  }
  assertDie(die);

  if (die === 6 && state.consecutiveSixes === 2) {
    // Third six in a row → turn ends, no move on this roll.
    return passTurn(state);
  }

  const nextSixes = die === 6 ? state.consecutiveSixes + 1 : state.consecutiveSixes;
  const tentative: GameState = {
    ...state,
    phase: 'move',
    dice: die,
    consecutiveSixes: nextSixes,
  };

  const legal = getLegalMoves(tentative);
  if (legal.length === 0) {
    // No legal move available with this die.
    // - On a 6 the player keeps the extra turn (roll again).
    // - Otherwise the turn passes to the next seat.
    if (die === 6) {
      return {
        ...state,
        phase: 'roll',
        dice: null,
        consecutiveSixes: nextSixes,
      };
    }
    return passTurn(state);
  }

  return tentative;
}

// ---------------------------------------------------------------------------
// Legal moves
// ---------------------------------------------------------------------------

export function getLegalMoves(state: GameState): readonly LegalMove[] {
  if (state.phase !== 'move' || state.dice === null || state.winner !== null) {
    return [];
  }

  const color = activeColor(state);
  const die = state.dice;
  const moves: LegalMove[] = [];

  for (let i = 0; i < 4; i++) {
    const piece: PieceId = { color, index: i as PieceIndex };
    const move = tryComputeMove(state, piece, die);
    if (move !== null) {
      moves.push(move);
    }
  }

  return moves;
}

function tryComputeMove(state: GameState, piece: PieceId, die: DieValue): LegalMove | null {
  const from = state.board.positions[pieceKey(piece)];
  if (from === undefined) return null;

  const color = piece.color;

  // Yard: only a 6 can move a piece out, and only if the start square is not
  // blocked by another piece of the same color (no stacking — `product.mdc`).
  if (from.zone === 'yard') {
    if (die !== 6) return null;
    const start = getStartTrackIndex(color);
    const to: PiecePosition = { zone: 'track', index: start };
    if (isBlockedByOwnPiece(state, color, to)) return null;
    const capture = findCaptureVictim(state, color, to);
    return { piece, to, capture };
  }

  // Home: cannot overshoot — exact roll to land on `HOME_FINISH_INDEX`.
  if (from.zone === 'home') {
    const target = from.index + die;
    if (target >= HOME_LENGTH) return null;
    const to: PiecePosition = { zone: 'home', index: target };
    if (isBlockedByOwnPiece(state, color, to)) return null;
    // Home column is private — no captures.
    return { piece, to, capture: null };
  }

  // Track piece: advance, but disallow overshoot past finish.
  const to = advanceAlongTrack(color, from, die);
  if (to.zone === 'home' && to.index === HOME_FINISH_INDEX) {
    // advanceAlongTrack clamps at finish; verify the die landed exactly here.
    const along = (from.index - getStartTrackIndex(color) + TRACK_LENGTH) % TRACK_LENGTH;
    const exactSteps = TRACK_LENGTH - along + HOME_FINISH_INDEX;
    if (die !== exactSteps) return null;
  }
  if (isBlockedByOwnPiece(state, color, to)) return null;
  const capture = to.zone === 'track' ? findCaptureVictim(state, color, to) : null;
  return { piece, to, capture };
}

function isBlockedByOwnPiece(state: GameState, color: PlayerColor, to: PiecePosition): boolean {
  if (to.zone === 'yard') return false;
  // The finish cell is a pile, not a square — multiple finished pieces co-exist there.
  if (to.zone === 'home' && to.index === HOME_FINISH_INDEX) return false;
  for (let i = 0; i < 4; i++) {
    const key = pieceKey({ color, index: i as PieceIndex });
    const pos = state.board.positions[key];
    if (pos !== undefined && samePosition(pos, to)) return true;
  }
  return false;
}

function findCaptureVictim(
  state: GameState,
  attacker: PlayerColor,
  to: PiecePosition,
): PieceId | null {
  if (to.zone !== 'track') return null;
  if (isSafeTrackIndex(to.index)) return null;
  for (const color of state.players) {
    if (color === attacker) continue;
    for (let i = 0; i < 4; i++) {
      const id: PieceId = { color, index: i as PieceIndex };
      const pos = state.board.positions[pieceKey(id)];
      if (pos !== undefined && pos.zone === 'track' && pos.index === to.index) {
        return id;
      }
    }
  }
  return null;
}

function samePosition(a: PiecePosition, b: PiecePosition): boolean {
  if (a.zone !== b.zone) return false;
  if (a.zone === 'yard') return true;
  // Both are track or both are home (same zone).
  return (a as { index: number }).index === (b as { index: number }).index;
}

// ---------------------------------------------------------------------------
// Apply move
// ---------------------------------------------------------------------------

export function applyMove(state: GameState, piece: PieceId): GameState {
  if (state.winner !== null) {
    throw new IllegalIntentError('game is over');
  }
  if (state.phase !== 'move' || state.dice === null) {
    throw new IllegalIntentError(`cannot move in phase '${state.phase}'`);
  }
  if (piece.color !== activeColor(state)) {
    throw new IllegalIntentError(`piece does not belong to active player`);
  }

  const legal = getLegalMoves(state);
  const chosen = legal.find(
    (m) => m.piece.color === piece.color && m.piece.index === piece.index,
  );
  if (chosen === undefined) {
    throw new IllegalIntentError(`no legal move for piece ${pieceKey(piece)}`);
  }

  const positions: Record<string, PiecePosition> = { ...state.board.positions };
  positions[pieceKey(chosen.piece)] = chosen.to;
  if (chosen.capture !== null) {
    positions[pieceKey(chosen.capture)] = { zone: 'yard' };
  }
  const nextBoard: BoardState = { positions };

  const color = chosen.piece.color;
  const won = playerHasWon(nextBoard, color);
  if (won) {
    return {
      ...state,
      board: nextBoard,
      phase: 'roll',
      dice: null,
      consecutiveSixes: 0,
      winner: color,
    };
  }

  // A 6 grants another roll (and the consecutive-sixes counter is already
  // bumped on `rollDice`). Anything else ends the turn.
  if (state.dice === 6) {
    return {
      ...state,
      board: nextBoard,
      phase: 'roll',
      dice: null,
    };
  }

  return {
    ...passTurn(state),
    board: nextBoard,
  };
}

// ---------------------------------------------------------------------------
// Forfeit / timeout
// ---------------------------------------------------------------------------

/**
 * Voluntarily forfeit the rest of the active player's turn. Used by the 30s
 * turn timer (see `product.mdc`) and by tests. Allowed in either phase as long
 * as the game is still running.
 */
export function forfeitTurn(state: GameState): GameState {
  if (state.winner !== null) {
    throw new IllegalIntentError('game is over');
  }
  return passTurn(state);
}

// ---------------------------------------------------------------------------
// Win detection
// ---------------------------------------------------------------------------

export function isGameOver(state: GameState): boolean {
  return state.winner !== null;
}

function playerHasWon(board: BoardState, color: PlayerColor): boolean {
  for (let i = 0; i < 4; i++) {
    const pos = board.positions[pieceKey({ color, index: i as PieceIndex })];
    if (pos === undefined || pos.zone !== 'home' || pos.index !== HOME_FINISH_INDEX) {
      return false;
    }
  }
  return true;
}

// ---------------------------------------------------------------------------
// Intent dispatcher
// ---------------------------------------------------------------------------

/**
 * Single entry-point used by the Worker (`worker/room.ts`) after it has
 * validated `seat` and `turn`. Mirrors the client reducer.
 */
export function applyIntent(state: GameState, intent: GameIntent): GameState {
  switch (intent.type) {
    case 'roll':
      return rollDice(state, intent.die);
    case 'move':
      return applyMove(state, intent.piece);
    case 'forfeit':
      return forfeitTurn(state);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function activeColor(state: GameState): PlayerColor {
  return state.players[state.activePlayerIndex];
}

export function activeSeatKind(state: GameState): PlayerKind {
  return state.seatKinds[state.activePlayerIndex];
}

function passTurn(state: GameState): GameState {
  return {
    ...state,
    activePlayerIndex: (state.activePlayerIndex + 1) % state.players.length,
    phase: 'roll',
    dice: null,
    consecutiveSixes: 0,
  };
}

function assertDie(die: DieValue): void {
  if (!Number.isInteger(die) || die < 1 || die > 6) {
    throw new RangeError(`die must be 1..6, got ${die}`);
  }
}
