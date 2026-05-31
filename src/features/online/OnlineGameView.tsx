/**
 * Online game view — renders server-broadcast state only.
 */

import { useMemo } from 'react';
import { BoardView } from '../board/BoardView.tsx';
import { Dice } from '../board/Dice.tsx';
import { useDiceFace } from '../board/useDiceFace.ts';
import { randomDie } from '../session/localGameReducer.ts';
import { TurnTimer } from '../session/TurnTimer.tsx';
import { activeColor, getLegalMoves } from '@game/rules';
import { pieceKey, type PieceId } from '@game/types';
import { Button, Panel } from '@/shared/ui';
import type { useOnlineGame } from './useOnlineGame.ts';
import styles from './OnlineGameView.module.css';

type OnlineRoom = ReturnType<typeof useOnlineGame>;

export interface OnlineGameViewProps {
  readonly room: OnlineRoom;
  readonly onLeave?: () => void;
}

function formatRoomNotice(notice: NonNullable<OnlineRoom['roomNotice']>): string {
  const who = notice.displayName ?? notice.color;
  if (notice.kind === 'player_left') {
    return `${who} left — CPU is playing their seat until they rejoin.`;
  }
  return `${who} rejoined.`;
}

export function OnlineGameView({ room, onLeave }: OnlineGameViewProps) {
  const { state, seat, error, secondsRemaining, sendIntent, disconnected, roomNotice } =
    room;

  const legalMoves = useMemo(
    () => (state !== null && state.phase === 'move' ? getLegalMoves(state) : []),
    [state],
  );
  const legalPieceKeys = useMemo(
    () => new Set(legalMoves.map((m) => pieceKey(m.piece))),
    [legalMoves],
  );

  const active = state !== null ? activeColor(state) : null;
  const myTurn = state !== null && seat !== null && active === seat.color;
  const canRoll = myTurn && state?.phase === 'roll' && state.winner === null;
  const showTimer = myTurn && seat?.kind === 'human' && state?.turnDeadline !== null;

  const { face: diceFace, announceRoll } = useDiceFace({
    dice: state?.dice ?? null,
    lastRoll: state?.lastRoll ?? null,
    canRoll: canRoll === true,
  });

  if (state === null) {
    return <p>Waiting for room state…</p>;
  }

  const handleRoll = (): void => {
    if (!canRoll) return;
    const die = randomDie();
    announceRoll(die);
    sendIntent({ type: 'roll', die });
  };

  const handlePiece = (piece: PieceId): void => {
    if (!myTurn || state.phase !== 'move') return;
    if (!legalPieceKeys.has(pieceKey(piece))) return;
    sendIntent({ type: 'move', piece });
  };

  return (
    <Panel className={styles.panel}>
      {disconnected ? (
        <p className={styles.banner} role="status">
          Connection lost — reconnecting…
        </p>
      ) : null}
      {roomNotice ? (
        <p className={styles.banner} role="status">
          {formatRoomNotice(roomNotice)}
        </p>
      ) : null}

      <header className={styles.header}>
        <span>
          Seat: <strong data-color={seat?.color}>{seat?.color ?? 'spectator'}</strong>
        </span>
        <span>
          Turn: <strong data-color={active}>{active}</strong>
          {myTurn ? ' (you)' : ''}
        </span>
        <TurnTimer
          visible={showTimer}
          secondsLeft={secondsRemaining}
          progress={state.turnDeadline ? secondsRemaining / 30 : 0}
        />
        {onLeave ? (
          <Button type="button" variant="ghost" onClick={onLeave}>
            Leave
          </Button>
        ) : null}
      </header>

      <BoardView
        board={state.board}
        players={state.players}
        activeColor={active ?? undefined}
        legalPieceKeys={legalPieceKeys}
        interactive={myTurn && state.phase === 'move'}
        onPieceSelect={handlePiece}
      />

      <Dice value={diceFace} canRoll={canRoll} onRoll={handleRoll} />

      {error ? (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      ) : null}
      {state.winner !== null ? <p className={styles.win}>Winner: {state.winner}</p> : null}
    </Panel>
  );
}
