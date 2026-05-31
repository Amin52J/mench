import styles from './TurnTimer.module.css';

export interface TurnTimerProps {
  readonly secondsLeft: number;
  readonly progress: number;
  readonly visible: boolean;
}

export function TurnTimer({ secondsLeft, progress, visible }: TurnTimerProps) {
  if (!visible) {
    return null;
  }

  return (
    <div
      className={styles.timer}
      role="timer"
      aria-live="polite"
      aria-label={`Turn time remaining: ${secondsLeft} seconds`}
    >
      <div className={styles.track}>
        <div className={styles.fill} style={{ width: `${progress * 100}%` }} />
      </div>
      <span className={styles.label}>{secondsLeft}s</span>
    </div>
  );
}
