import { BoardView, Dice, useDiceFace } from '@/features/board';
import { randomDie } from './localGameReducer.ts';
import { Button, Panel } from '@/shared/ui';
import { playersForCount } from './types.ts';
import { TurnTimer } from './TurnTimer.tsx';
import { WinOverlay } from './WinOverlay.tsx';
import type { UseLocalGameResult } from './useLocalGame.ts';
import styles from './LocalGameView.module.css';

export interface LocalGameViewProps {
  readonly session: UseLocalGameResult;
}

export function LocalGameView({ session }: LocalGameViewProps) {
  const { game, setup, seatKinds, activeColor, activeSeatKind, feedback } = session;
  const { face: diceFace, announceRoll } = useDiceFace({
    dice: game?.dice ?? null,
    lastRoll: game?.lastRoll ?? null,
    canRoll: session.canRoll,
  });

  if (game === null || activeColor === null) {
    return null;
  }

  const players = playersForCount(setup.playerCount);
  const winner = game.winner;

  const handleRoll = (): void => {
    const die = randomDie();
    announceRoll(die);
    session.roll(die);
  };
  const phaseHint =
    game.phase === 'roll'
      ? activeSeatKind === 'cpu'
        ? 'CPU is rolling…'
        : 'Roll the die'
      : activeSeatKind === 'cpu'
        ? 'CPU is moving…'
        : 'Tap a highlighted piece';

  return (
    <>
      <Panel className={styles.panel}>
        <div className={styles.statusRow}>
          <p className={styles.turnHint} data-pulse="true">
            <strong data-color={activeColor}>{activeColor}</strong>
            <span className={styles.seatKind}>
              {activeSeatKind === 'cpu' ? ' (CPU)' : ''}
            </span>
            <span className={styles.phaseHint}> — {phaseHint}</span>
          </p>
          <TurnTimer
            visible={session.isHumanTurn}
            secondsLeft={session.timerSeconds}
            progress={session.timerProgress}
          />
        </div>

        <div className={styles.playRow}>
          <Dice value={diceFace} canRoll={session.canRoll} onRoll={handleRoll} />
        </div>

        <BoardView
          board={game.board}
          activeColor={activeColor}
          players={players}
          legalPieceKeys={session.legalPieceKeys}
          shakePieceKey={feedback.shakePieceKey}
          interactive={session.isHumanTurn && game.phase === 'move'}
          onPieceSelect={(piece) => session.tryMove(piece)}
        />

        {feedback.toast ? (
          <p className={styles.toast} role="status">
            {feedback.toast}
          </p>
        ) : null}

        <ul className={styles.seatStatus} aria-label="Seat types">
          {players.map((color, index) => (
            <li key={color} data-color={color} data-active={color === activeColor ? 'true' : 'false'}>
              {color}: {seatKinds[index] ?? 'human'}
            </li>
          ))}
        </ul>

        <div className={styles.footer}>
          <Button variant="ghost" onClick={session.backToSetup}>
            Setup
          </Button>
        </div>
      </Panel>

      {winner !== null ? (
        <WinOverlay
          winner={winner}
          onPlayAgain={session.restartGame}
          onNewSetup={session.backToSetup}
        />
      ) : null}
    </>
  );
}
