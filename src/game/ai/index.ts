/**
 * CPU AI public surface (phase 3.2 heuristics, 3.3 lookahead).
 */

export { chooseMove, type ChooseMoveOptions } from './chooseMove.ts';
export { SEARCH, scoreMovesWithLookahead, type LookaheadScore } from './search.ts';
export {
  scoreMove,
  scoreMoves,
  isCellThreatened,
  WEIGHTS,
  type MoveScore,
} from './score.ts';

/** Bounds of the CPU "think" delay before auto-play (`product.mdc`). */
export const CPU_THINK_DELAY_MIN_MS = 300;
export const CPU_THINK_DELAY_MAX_MS = 800;

/**
 * Picks a think delay in `[CPU_THINK_DELAY_MIN_MS, CPU_THINK_DELAY_MAX_MS]`.
 * Pure — pass in an RNG for tests.
 */
export function pickCpuThinkDelayMs(random: () => number = Math.random): number {
  const span = CPU_THINK_DELAY_MAX_MS - CPU_THINK_DELAY_MIN_MS;
  return CPU_THINK_DELAY_MIN_MS + Math.floor(random() * (span + 1));
}
