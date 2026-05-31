/**
 * Shallow lookahead for CPU move selection (phase 3.3).
 *
 * 1-ply static score + opponent reply (expected + pessimistic over dice 1..6),
 * optional 2-ply own-roll follow-up when legal-move breadth is small.
 * See `README.md` for the design spec.
 */

import {
  activeColor,
  applyMove,
  getLegalMoves,
  rollDice,
  type DieValue,
  type GameState,
  type LegalMove,
} from '../rules.ts';
import type { PlayerColor } from '../types.ts';
import { scoreMove } from './score.ts';

// ---------------------------------------------------------------------------
// Search constants (tweakable — documented in README.md)
// ---------------------------------------------------------------------------

export const SEARCH = {
  LOOKAHEAD_BREADTH: 4,
  TWO_PLY_BREADTH_CAP: 6,
  REPLY_DISCOUNT: 0.55,
  REPLY_PESSIMISM: 0.2,
  OWN_FOLLOWUP_WEIGHT: 0.3,
  SEARCH_TIME_BUDGET_MS: 50,
} as const;

export interface LookaheadScore {
  readonly move: LegalMove;
  readonly staticScore: number;
  readonly total: number;
  readonly expanded: boolean;
}

function dieValues(): readonly DieValue[] {
  return [1, 2, 3, 4, 5, 6];
}

function bestReplyScore(state: GameState): number {
  const replies = getLegalMoves(state);
  if (replies.length === 0) return 0;
  let best = -Infinity;
  for (const reply of replies) {
    const s = scoreMove(state, reply);
    if (s > best) best = s;
  }
  return best;
}

function evaluateOpponentReply(
  afterMove: GameState,
  moverColor: PlayerColor,
): { readonly expected: number; readonly pessimistic: number } {
  if (afterMove.phase !== 'roll' || activeColor(afterMove) === moverColor) {
    return { expected: 0, pessimistic: 0 };
  }

  const perDie: number[] = [];
  for (const die of dieValues()) {
    const afterRoll = rollDice(afterMove, die);
    if (afterRoll.phase !== 'move') {
      perDie.push(0);
      continue;
    }
    perDie.push(bestReplyScore(afterRoll));
  }

  const expected = perDie.reduce((sum, v) => sum + v, 0) / perDie.length;
  return { expected, pessimistic: Math.max(...perDie) };
}

function evaluateOwnFollowUp(
  afterMove: GameState,
  moverColor: PlayerColor,
): number {
  if (afterMove.phase !== 'roll' || activeColor(afterMove) !== moverColor) {
    return 0;
  }

  let sum = 0;
  for (const die of dieValues()) {
    const afterRoll = rollDice(afterMove, die);
    if (afterRoll.phase !== 'move') continue;
    sum += bestReplyScore(afterRoll);
  }
  return sum / dieValues().length;
}

function compareMovesForPrefilter(a: LegalMove, b: LegalMove): number {
  if (a.piece.index !== b.piece.index) {
    return a.piece.index - b.piece.index;
  }
  return 0;
}

function sortMovesByStatic(state: GameState, moves: readonly LegalMove[]): LegalMove[] {
  return [...moves].sort((a, b) => {
    const diff = scoreMove(state, b) - scoreMove(state, a);
    if (diff !== 0) return diff;
    return compareMovesForPrefilter(a, b);
  });
}

function compositeTotal(
  state: GameState,
  move: LegalMove,
  enableTwoPly: boolean,
): number {
  const staticScore = scoreMove(state, move);
  const afterMove = applyMove(state, move.piece);
  const mover = move.piece.color;

  const { expected, pessimistic } = evaluateOpponentReply(afterMove, mover);
  const ownFollowUp = enableTwoPly
    ? evaluateOwnFollowUp(afterMove, mover)
    : 0;

  return (
    staticScore +
    SEARCH.OWN_FOLLOWUP_WEIGHT * ownFollowUp -
    SEARCH.REPLY_DISCOUNT * expected -
    SEARCH.REPLY_PESSIMISM * pessimistic
  );
}

function nowMs(): number {
  return performance.now();
}

/**
 * Scores legal moves with shallow lookahead. Moves outside the static
 * prefilter keep {@link scoreMove} only; top candidates get full expansion.
 * Stops expanding when the wall-clock budget is exceeded.
 */
export function scoreMovesWithLookahead(
  state: GameState,
  moves: readonly LegalMove[],
): readonly LookaheadScore[] {
  if (moves.length === 0) return [];

  const sorted = sortMovesByStatic(state, moves);
  const expandSet = new Set(
    sorted
      .slice(0, SEARCH.LOOKAHEAD_BREADTH)
      .map((m) => m.piece.index),
  );
  const enableTwoPly = moves.length <= SEARCH.TWO_PLY_BREADTH_CAP;
  const budgetStart = nowMs();

  const results: LookaheadScore[] = [];
  for (const move of sorted) {
    const staticScore = scoreMove(state, move);
    const shouldExpand = expandSet.has(move.piece.index);
    const elapsed = nowMs() - budgetStart;

    if (!shouldExpand || elapsed > SEARCH.SEARCH_TIME_BUDGET_MS) {
      results.push({
        move,
        staticScore,
        total: staticScore,
        expanded: false,
      });
      continue;
    }

    results.push({
      move,
      staticScore,
      total: compositeTotal(state, move, enableTwoPly),
      expanded: true,
    });
  }

  return results;
}
