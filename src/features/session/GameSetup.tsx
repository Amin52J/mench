import { devAllowAllCpuStart } from './devFlags.ts';
import { playersForCount, QUICK_SETUP_PRESETS } from './types.ts';
import type { GameSetup, SeatConfig } from './types.ts';
import { Button, Panel } from '@/shared/ui';
import styles from './GameSetup.module.css';

export interface GameSetupProps {
  readonly setup: GameSetup;
  readonly onPlayerCount: (count: GameSetup['playerCount']) => void;
  readonly onSeatKind: (seatIndex: number, kind: SeatConfig['kind']) => void;
  readonly onApplyPreset: (setup: GameSetup) => void;
  readonly onStart: () => void;
}

const COUNT_OPTIONS: readonly GameSetup['playerCount'][] = [2, 3, 4];

export function GameSetupView({
  setup,
  onPlayerCount,
  onSeatKind,
  onApplyPreset,
  onStart,
}: GameSetupProps) {
  const colors = playersForCount(setup.playerCount);
  const hasHuman = setup.seats.some((seat) => seat.kind === 'human');
  const canStart = hasHuman || devAllowAllCpuStart();

  return (
    <Panel className={styles.panel}>
      <h2 className={styles.heading}>New game</h2>
      <p className={styles.lead}>Local hotseat — pick seats and who plays each one.</p>

      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>Quick start</legend>
        <div className={styles.presetRow}>
          {QUICK_SETUP_PRESETS.map((preset) => (
            <Button key={preset.id} variant="ghost" onClick={() => onApplyPreset(preset.setup)}>
              {preset.label}
            </Button>
          ))}
        </div>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>Players</legend>
        <div className={styles.countRow}>
          {COUNT_OPTIONS.map((count) => (
            <Button
              key={count}
              variant={count === setup.playerCount ? 'primary' : 'ghost'}
              onClick={() => onPlayerCount(count)}
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
                >
                  Human
                </Button>
                <Button
                  variant={seat.kind === 'cpu' ? 'primary' : 'ghost'}
                  onClick={() => onSeatKind(index, 'cpu')}
                >
                  CPU
                </Button>
              </div>
            </li>
          );
        })}
      </ul>

      <Button className={styles.start} onClick={onStart} disabled={!canStart}>
        Start game
      </Button>
      {!canStart ? (
        <p className={styles.hint} role="status">
          At least one human seat is required.
        </p>
      ) : null}
      {devAllowAllCpuStart() && !hasHuman ? (
        <p className={styles.hint} role="status">
          Dev mode: all-CPU start enabled (`?allCpu=1`).
        </p>
      ) : null}
    </Panel>
  );
}
