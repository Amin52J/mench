/**
 * CPU move selector — picks one of the legal moves by maximizing
 * {@link scoreMove}. Deterministic given an injected RNG; ties are broken
 * by aggression (capture/threat moves win via the score itself, then by
 * insertion order — i.e. lowest piece index — for total stability).
 */

import { getLegalMoves, type GameState, type LegalMove } from '../rules.ts';
import { scoreMove, scoreMoves, type MoveScore } from './score.ts';

export interface ChooseMoveOptions {
  /** Inject for reproducible tie-breaks; defaults to `Math.random`. */
  readonly random?: () => number;
}

/**
 * Returns the best legal move for the active player in `state`, or `null`
 * when there are no legal moves (caller should forfeit).
 */
export function chooseMove(
  state: GameState,
  options: ChooseMoveOptions = {},
): LegalMove | null {
  const moves = getLegalMoves(state);
  if (moves.length === 0) return null;
  if (moves.length === 1) return moves[0]!;

  const scored = scoreMoves(state, moves);
  let bestScore = -Infinity;
  for (const entry of scored) {
    if (entry.score > bestScore) bestScore = entry.score;
  }
  const top = scored.filter((entry) => entry.score === bestScore);
  if (top.length === 1) return top[0]!.move;

  // Stable random tie-break — preserves determinism in tests.
  const random = options.random ?? Math.random;
  const pick = Math.floor(random() * top.length);
  return top[Math.min(pick, top.length - 1)]!.move;
}

export { scoreMove, scoreMoves };
export type { MoveScore };
