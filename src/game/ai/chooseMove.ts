/**
 * CPU move selector — picks one of the legal moves by maximizing shallow
 * lookahead (phase 3.3) over {@link scoreMove}. Deterministic given an
 * injected RNG; ties are broken randomly among equal totals.
 */

import { getLegalMoves, type GameState, type LegalMove } from '../rules.ts';
import { scoreMovesWithLookahead } from './search.ts';
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

  const scored = scoreMovesWithLookahead(state, moves);
  let bestTotal = -Infinity;
  for (const entry of scored) {
    if (entry.total > bestTotal) bestTotal = entry.total;
  }
  const top = scored.filter((entry) => entry.total === bestTotal);
  if (top.length === 1) return top[0]!.move;

  const random = options.random ?? Math.random;
  const pick = Math.floor(random() * top.length);
  return top[Math.min(pick, top.length - 1)]!.move;
}

export { scoreMove, scoreMoves };
export type { MoveScore };
