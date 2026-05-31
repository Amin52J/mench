import { isGameOver } from '@game/rules';
import { BoardView, Dice } from '@/features/board';
import { Panel } from '@/shared/ui';
import { playersForCount } from './types.ts';
import { WinOverlay } from './WinOverlay.tsx';
import type { UseLocalGameResult } from './useLocalGame.ts';
import styles from './LocalGameView.module.css';

export interface LocalGameViewProps {
  readonly session: UseLocalGameResult;
}

export function LocalGameView({ session }: LocalGameViewProps) {
  const { game, setup, activeColor, feedback } = session;
  // Dice face is driven directly by the turn-phase state machine in
  // `useLocalGame` — `?` while idle, the rolled die during revealing/moving.
  const diceFace = session.diceFace;

  if (game === null || activeColor === null) {
    return null;
  }

  const players = playersForCount(setup.playerCount);
  const winner = game.winner;
  const canContinueForPlacements =
    winner !== null && !isGameOver(game) && game.placements.length < players.length;

  const handleRoll = (): void => {
    session.roll();
  };

  return (
    <>
      <Panel className={styles.panel}>
        <BoardView
          key={session.sessionKey}
          board={game.board}
          activeColor={activeColor}
          players={players}
          legalPieceKeys={session.legalPieceKeys}
          shakePieceKey={feedback.shakePieceKey}
          interactive={session.isHumanTurn && game.phase === 'move' && !session.isPieceAnimating}
          pieceVisuals={session.pieceVisuals}
          captureFlash={session.captureFlash}
          onPieceSelect={(piece) => session.tryMove(piece)}
        />

        <div className={styles.playRow}>
          <Dice
            value={diceFace}
            canRoll={session.canRoll}
            onRoll={handleRoll}
            activeColor={activeColor}
          />
        </div>

        {feedback.toast ? (
          <p className={styles.toast} role="status">
            {feedback.toast}
          </p>
        ) : null}
      </Panel>

      {session.showWinOverlay && winner !== null ? (
        <WinOverlay
          winner={winner}
          placements={game.placements}
          canContinue={canContinueForPlacements}
          onContinue={session.continueForPlacements}
          onPlayAgain={session.restartGame}
          onNewSetup={session.backToSetup}
        />
      ) : null}
      {isGameOver(game) && game.placements.length > 0 ? (
        <p className={styles.finalStandings} role="status">
          Final: {game.placements.join(' → ')}
        </p>
      ) : null}
    </>
  );
}
