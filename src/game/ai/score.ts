/**
 * Heuristic scoring for CPU move selection (phase 3.2).
 *
 * Pure functions over `GameState` + `LegalMove`. No lookahead — phase 3.3
 * adds shallow search on top of this scoring (`decisions.mdc` O7).
 *
 * Heuristic factors (weighted sum):
 *
 * - **Capture** — landing on an unsafe opponent token (sends them home).
 * - **Escape threat** — moving a piece off a square reachable by an opponent
 *   on their next roll (1..6). Bonus scales with how far that piece has
 *   travelled (losing a near-home piece hurts more than losing a fresh one).
 * - **Enter on 6** — leaving the yard onto the start square.
 * - **Home approach / finish** — progress into the home column, with a big
 *   bonus for exactly landing on the finish triangle.
 * - **Progress** — small forward-distance term to break ties between
 *   otherwise-neutral moves.
 * - **Aggression tie-break** — see {@link AGGRESSION_TIE_BREAK_WEIGHT}: a
 *   tiny capture/threat-related nudge so that, all else equal, the CPU
 *   prefers the more aggressive option.
 */

import {
  HOME_FINISH_INDEX,
  advanceAlongTrack,
  getStartTrackIndex,
  isSafeTrackIndex,
  stepsToFinish,
  trackStepsFromStart,
} from '../board.ts';
import type { GameState, LegalMove } from '../rules.ts';
import type { PieceId, PieceIndex, PiecePosition, PlayerColor } from '../types.ts';
import { pieceKey } from '../types.ts';

// ---------------------------------------------------------------------------
// Weights — chosen so individual factors dominate "progress" but are
// comparable to each other. Tuned by inspection; phase 3.3 may revisit.
// ---------------------------------------------------------------------------

export const WEIGHTS = {
  capture: 100,
  /** Multiplier on `(1 + stepsAlongTrack)` for a piece that escapes a threat. */
  escapeBase: 40,
  escapeProgressBonus: 1,
  enterFromYard: 60,
  homeEntry: 45,
  homeAdvance: 6,
  finishLanding: 80,
  /** Per-step bonus along the track (progress / tie-break). */
  progress: 1,
  /** Tiny aggression tie-break (prefers capture/threat moves on ties). */
  aggressionTieBreak: 0.01,
} as const;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface MoveScore {
  readonly move: LegalMove;
  readonly score: number;
}

export function scoreMove(state: GameState, move: LegalMove): number {
  const color = move.piece.color;
  const from = state.board.positions[pieceKey(move.piece)] as PiecePosition;
  const to = move.to;

  let score = 0;

  // Capture (huge).
  if (move.capture !== null) {
    score += WEIGHTS.capture;
    score += WEIGHTS.aggressionTieBreak;
  }

  // Enter from yard (only happens on a 6).
  if (from.zone === 'yard' && to.zone === 'track') {
    score += WEIGHTS.enterFromYard;
  }

  // Home column progress.
  if (to.zone === 'home') {
    if (from.zone !== 'home') {
      // Just stepped off the track into the home column.
      score += WEIGHTS.homeEntry;
    }
    score += WEIGHTS.homeAdvance * (to.index + 1);
    if (to.index === HOME_FINISH_INDEX) {
      score += WEIGHTS.finishLanding;
    }
  }

  // Forward progress along the path (small term — disambiguates ties).
  const progressDelta =
    stepsToFinish(color, from) - stepsToFinish(color, to);
  score += WEIGHTS.progress * Math.max(0, progressDelta);

  // Escape threat: if `from` is on the open track AND an opponent could
  // capture it on a 1..6 next roll, reward moving away.
  if (from.zone === 'track' && !isSafeTrackIndex(from.index)) {
    if (isCellThreatened(state, color, from.index)) {
      const along = trackStepsFromStart(color, from.index);
      const escapeBonus =
        WEIGHTS.escapeBase + WEIGHTS.escapeProgressBonus * along;
      // Don't reward "escaping" by landing on another threatened, unsafe cell.
      if (to.zone !== 'track' || isSafeTrackIndex(to.index) ||
          !isCellThreatened(state, color, to.index)) {
        score += escapeBonus;
        score += WEIGHTS.aggressionTieBreak;
      }
    }
  }

  return score;
}

export function scoreMoves(
  state: GameState,
  moves: readonly LegalMove[],
): readonly MoveScore[] {
  return moves.map((move) => ({ move, score: scoreMove(state, move) }));
}

// ---------------------------------------------------------------------------
// Threat detection
// ---------------------------------------------------------------------------

/**
 * True if any opponent piece could land on `trackIndex` with a 1..6 roll
 * on their next turn (yard pieces only threaten via a 6 onto their start).
 * Safe squares are never threatened.
 */
export function isCellThreatened(
  state: GameState,
  defender: PlayerColor,
  trackIndex: number,
): boolean {
  if (isSafeTrackIndex(trackIndex)) return false;

  for (const color of state.players) {
    if (color === defender) continue;
    for (let i = 0; i < 4; i++) {
      const piece: PieceId = { color, index: i as PieceIndex };
      const pos = state.board.positions[pieceKey(piece)];
      if (pos === undefined) continue;

      if (pos.zone === 'yard') {
        // Yard pieces threaten only their own start square (reached on a 6).
        if (getStartTrackIndex(color) === trackIndex) return true;
        continue;
      }
      if (pos.zone === 'home') continue;

      // Track piece: check dice 1..6. `advanceAlongTrack` redirects into
      // the home column past the gate, so wrap-around hits are excluded.
      for (let die = 1; die <= 6; die++) {
        const after = advanceAlongTrack(color, pos, die);
        if (after.zone === 'track' && after.index === trackIndex) {
          return true;
        }
      }
    }
  }
  return false;
}
