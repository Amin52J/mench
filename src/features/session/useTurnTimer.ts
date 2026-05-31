import { useEffect, useRef, useState } from 'react';

/** Human turn window per `product.mdc` / `decisions.mdc` O14. */
export const TURN_TIMER_MS = 30_000;

export interface UseTurnTimerOptions {
  readonly enabled: boolean;
  /** Changes when the active seat's turn window starts (seat index). */
  readonly turnKey: number;
  readonly onExpire: () => void;
}

export interface TurnTimerState {
  readonly secondsLeft: number;
  readonly progress: number;
}

export function useTurnTimer({
  enabled,
  turnKey,
  onExpire,
}: UseTurnTimerOptions): TurnTimerState {
  const [remainingMs, setRemainingMs] = useState(TURN_TIMER_MS);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useEffect(() => {
    if (!enabled) {
      setRemainingMs(TURN_TIMER_MS);
      return;
    }

    const startedAt = Date.now();
    let expired = false;
    setRemainingMs(TURN_TIMER_MS);

    const tick = () => {
      const left = TURN_TIMER_MS - (Date.now() - startedAt);
      if (left <= 0) {
        setRemainingMs(0);
        if (!expired) {
          expired = true;
          onExpireRef.current();
        }
        return false;
      }
      setRemainingMs(left);
      return true;
    };

    if (!tick()) {
      return;
    }

    const id = globalThis.setInterval(() => {
      if (!tick()) {
        globalThis.clearInterval(id);
      }
    }, 200);

    return () => globalThis.clearInterval(id);
  }, [enabled, turnKey]);

  return {
    secondsLeft: Math.max(0, Math.ceil(remainingMs / 1000)),
    progress: Math.max(0, Math.min(1, remainingMs / TURN_TIMER_MS)),
  };
}
