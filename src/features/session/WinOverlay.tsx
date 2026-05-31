import type { PlayerColor } from '@game/types';
import { Button, Panel } from '@/shared/ui';
import styles from './WinOverlay.module.css';

export interface WinOverlayProps {
  readonly winner: PlayerColor;
  readonly placements: readonly PlayerColor[];
  readonly canContinue: boolean;
  readonly onContinue: () => void;
  readonly onPlayAgain: () => void;
  readonly onNewSetup: () => void;
}

function ordinal(rank: number): string {
  if (rank === 1) return '1st';
  if (rank === 2) return '2nd';
  if (rank === 3) return '3rd';
  return `${rank}th`;
}

export function WinOverlay({
  winner,
  placements,
  canContinue,
  onContinue,
  onPlayAgain,
  onNewSetup,
}: WinOverlayProps) {
  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-labelledby="win-title">
      <Panel className={styles.card}>
        <h2 id="win-title" className={styles.title}>
          <span data-color={winner}>{winner}</span> finishes 1st!
        </h2>
        <p className={styles.subtitle}>All four pieces reached home.</p>
        {placements.length > 0 ? (
          <ol className={styles.standings} aria-label="Current standings">
            {placements.map((color, index) => (
              <li key={color} data-color={color}>
                {ordinal(index + 1)} — {color}
              </li>
            ))}
          </ol>
        ) : null}
        <div className={styles.actions}>
          {canContinue ? (
            <Button onClick={onContinue}>Continue for 2nd–4th place</Button>
          ) : null}
          <Button variant={canContinue ? 'ghost' : 'primary'} onClick={onPlayAgain}>
            Play again
          </Button>
          <Button variant="ghost" onClick={onNewSetup}>
            New setup
          </Button>
        </div>
      </Panel>
    </div>
  );
}
