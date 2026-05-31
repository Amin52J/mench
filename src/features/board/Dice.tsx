import type { DieValue } from '@game/rules';
import { useEffect, useRef, useState } from 'react';
import { usePrefersReducedMotion } from '@/shared/hooks';
import styles from './Dice.module.css';

const TUMBLE_MS = 520;

export interface DiceProps {
  readonly value: DieValue | null;
  readonly canRoll: boolean;
  readonly onRoll: () => void;
}

function pipLayout(value: DieValue): readonly boolean[] {
  const layouts: Record<DieValue, readonly boolean[]> = {
    1: [false, false, false, false, true, false, false, false, false],
    2: [true, false, false, false, false, false, false, false, true],
    3: [true, false, false, false, true, false, false, false, true],
    4: [true, false, true, false, false, false, true, false, true],
    5: [true, false, true, false, true, false, true, false, true],
    6: [true, false, true, true, false, true, true, false, true],
  };
  return layouts[value];
}

export function Dice({ value, canRoll, onRoll }: DiceProps) {
  const reducedMotion = usePrefersReducedMotion();
  const [displayValue, setDisplayValue] = useState<DieValue | null>(value);
  const [tumbling, setTumbling] = useState(false);
  const prevValueRef = useRef<DieValue | null>(value);

  useEffect(() => {
    if (value === prevValueRef.current) {
      return;
    }
    prevValueRef.current = value;

    if (value === null) {
      setDisplayValue(null);
      setTumbling(false);
      return;
    }

    if (reducedMotion) {
      setDisplayValue(value);
      setTumbling(false);
      return;
    }

    setTumbling(true);
    const timer = globalThis.setTimeout(() => {
      setDisplayValue(value);
      setTumbling(false);
    }, TUMBLE_MS);

    return () => globalThis.clearTimeout(timer);
  }, [reducedMotion, value]);

  const faceValue = displayValue;
  const label =
    faceValue === null ? 'Tap to roll' : `Die showing ${faceValue}`;

  return (
    <button
      type="button"
      className={styles.dice}
      data-tumbling={tumbling ? 'true' : 'false'}
      data-can-roll={canRoll ? 'true' : 'false'}
      disabled={!canRoll || tumbling}
      aria-label={label}
      onClick={() => {
        if (!canRoll || tumbling) return;
        onRoll();
      }}
    >
      <span className={styles.cube} aria-hidden>
        {faceValue === null ? (
          <span className={styles.prompt}>?</span>
        ) : (
          pipLayout(faceValue).map((on, index) => (
            <span key={index} className={on ? styles.pip : styles.pipOff} />
          ))
        )}
      </span>
    </button>
  );
}
