import type { PlayerColor } from '@game/types';
import { Button, Panel } from '@/shared/ui';
import styles from './WinOverlay.module.css';

export interface WinOverlayProps {
  readonly winner: PlayerColor;
  readonly onPlayAgain: () => void;
  readonly onNewSetup: () => void;
}

export function WinOverlay({ winner, onPlayAgain, onNewSetup }: WinOverlayProps) {
  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-labelledby="win-title">
      <Panel className={styles.card}>
        <h2 id="win-title" className={styles.title}>
          <span data-color={winner}>{winner}</span> wins!
        </h2>
        <p className={styles.subtitle}>All four pieces reached home.</p>
        <div className={styles.actions}>
          <Button onClick={onPlayAgain}>Play again</Button>
          <Button variant="ghost" onClick={onNewSetup}>
            New setup
          </Button>
        </div>
      </Panel>
    </div>
  );
}
