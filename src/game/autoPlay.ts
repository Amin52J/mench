/**
 * Auto-play the rest of the active seat's turn (timer expiry path).
 * Seat kind stays unchanged — only move selection uses CPU heuristics.
 */

import { chooseMove } from './ai/chooseMove.ts';
import {
  applyMove,
  forfeitTurn,
  rollDice,
  type DieValue,
  type GameState,
} from './rules.ts';

export function autoPlayCurrentTurn(
  state: GameState,
  roll: () => DieValue,
  maxSteps = 40,
): GameState {
  if (state.winner !== null) {
    return state;
  }
  const seatIndex = state.activePlayerIndex;
  let current = state;
  let steps = 0;
  while (
    current.winner === null &&
    current.activePlayerIndex === seatIndex &&
    steps++ < maxSteps
  ) {
    if (current.phase === 'roll') {
      current = rollDice(current, roll());
    } else if (current.phase === 'move') {
      const pick = chooseMove(current);
      current = pick !== null ? applyMove(current, pick.piece) : forfeitTurn(current);
    } else {
      break;
    }
  }
  return current;
}
