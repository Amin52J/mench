import type { DieValue } from '@game/rules';
import { useCallback, useEffect, useRef, useState } from 'react';

/** How long a skipped or no-move roll stays visible before the next `?` (`product.mdc` feedback). */
export const ROLL_REVEAL_MS = 2_000;

export interface UseDiceFaceOptions {
  readonly dice: DieValue | null;
  readonly lastRoll: DieValue | null;
  readonly canRoll: boolean;
}

export interface UseDiceFaceResult {
  readonly face: DieValue | null;
  /** Call when the local player rolls — shows the die immediately, then holds for {@link ROLL_REVEAL_MS}. */
  readonly announceRoll: (die: DieValue) => void;
}

/**
 * Die face for the UI: `?` when {@link UseDiceFaceOptions.canRoll}, current {@link dice}
 * during move phase, and a timed reveal for {@link lastRoll} / local rolls.
 */
export function useDiceFace({
  dice,
  lastRoll,
  canRoll,
}: UseDiceFaceOptions): UseDiceFaceResult {
  const [held, setHeld] = useState<DieValue | null>(null);
  const seenLastRoll = useRef<DieValue | null>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearHoldTimer = useCallback(() => {
    if (holdTimer.current !== null) {
      globalThis.clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  }, []);

  const holdFace = useCallback(
    (die: DieValue) => {
      clearHoldTimer();
      setHeld(die);
      holdTimer.current = globalThis.setTimeout(() => {
        setHeld(null);
        holdTimer.current = null;
      }, ROLL_REVEAL_MS);
    },
    [clearHoldTimer],
  );

  const announceRoll = useCallback(
    (die: DieValue) => {
      seenLastRoll.current = die;
      holdFace(die);
    },
    [holdFace],
  );

  useEffect(() => {
    if (dice !== null) {
      clearHoldTimer();
      setHeld(dice);
      return;
    }

    if (canRoll) {
      clearHoldTimer();
      setHeld(null);
      seenLastRoll.current = null;
      return;
    }

    if (lastRoll === null) {
      return;
    }
    if (lastRoll === seenLastRoll.current) {
      return;
    }
    seenLastRoll.current = lastRoll;
    holdFace(lastRoll);
  }, [canRoll, clearHoldTimer, dice, holdFace, lastRoll]);

  useEffect(() => () => clearHoldTimer(), [clearHoldTimer]);

  let face: DieValue | null;
  if (dice !== null) {
    face = dice;
  } else if (canRoll) {
    face = null;
  } else if (held !== null) {
    face = held;
  } else {
    face = lastRoll;
  }

  return { face, announceRoll };
}
