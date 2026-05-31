import type { DieValue } from '@game/rules';

/** Face to show on the die button — `?` when it is time to roll. */
export function diceDisplayValue(
  dice: DieValue | null,
  lastRoll: DieValue | null,
  canRoll: boolean,
): DieValue | null {
  if (dice !== null) return dice;
  if (canRoll) return null;
  return lastRoll;
}
