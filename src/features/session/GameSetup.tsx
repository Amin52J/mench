import { playersForCount } from './types.ts';
import type { GameSetup, SeatConfig } from './types.ts';
import { Button, Panel } from '@/shared/ui';
import styles from './GameSetup.module.css';

export interface GameSetupProps {
  readonly setup: GameSetup;
  readonly onPlayerCount: (count: GameSetup['playerCount']) => void;
  readonly onSeatKind: (seatIndex: number, kind: SeatConfig['kind']) => void;
  readonly onStart: () => void;
  readonly readOnly?: boolean;
  readonly heading?: string;
  readonly startLabel?: string;
  readonly showStart?: boolean;
  readonly canStartOverride?: boolean;
}

const COUNT_OPTIONS: readonly GameSetup['playerCount'][] = [2, 3, 4];

export function GameSetupView({
  setup,
  onPlayerCount,
  onSeatKind,
  onStart,
  readOnly = false,
  heading = 'New game',
  startLabel = 'Start game',
  showStart = true,
  canStartOverride,
}: GameSetupProps) {
  const colors = playersForCount(setup.playerCount);
  const hasHuman = setup.seats.some((seat) => seat.kind === 'human');
  const canStart = canStartOverride ?? hasHuman;

  return (
    <Panel className={styles.panel}>
      <h2 className={styles.heading}>{heading}</h2>

      <fieldset className={styles.fieldset} disabled={readOnly}>
        <legend className={styles.legend}>Players</legend>
        <div className={styles.countRow}>
          {COUNT_OPTIONS.map((count) => (
            <Button
              key={count}
              variant={count === setup.playerCount ? 'primary' : 'ghost'}
              onClick={() => onPlayerCount(count)}
              disabled={readOnly}
            >
              {count}
            </Button>
          ))}
        </div>
      </fieldset>

      <ul className={styles.seatList}>
        {colors.map((color, index) => {
          const seat = setup.seats[index] ?? { kind: 'human' as const };
          return (
            <li key={color} className={styles.seatRow}>
              <span className={styles.seatLabel} data-color={color}>
                {color}
              </span>
              <div className={styles.seatToggle}>
                <Button
                  variant={seat.kind === 'human' ? 'primary' : 'ghost'}
                  onClick={() => onSeatKind(index, 'human')}
                  disabled={readOnly}
                >
                  Human
                </Button>
                <Button
                  variant={seat.kind === 'cpu' ? 'primary' : 'ghost'}
                  onClick={() => onSeatKind(index, 'cpu')}
                  disabled={readOnly}
                >
                  CPU
                </Button>
              </div>
            </li>
          );
        })}
      </ul>

      {showStart ? (
        <Button className={styles.start} onClick={onStart} disabled={!canStart || readOnly}>
          {startLabel}
        </Button>
      ) : null}
      {!canStart ? (
        <p className={styles.hint} role="status">
          At least one human seat is required.
        </p>
      ) : null}
    </Panel>
  );
}
