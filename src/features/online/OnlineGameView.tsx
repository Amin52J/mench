/**
 * Minimal online game view (`phase 4.2`).
 *
 * Renders the server-broadcast `PublicGameState` only — no local rules
 * mutation (`architecture.mdc`: "never apply opponent moves locally without
 * server ack"). Shows the server-synced countdown and routes human intents
 * back to the DO.
 */

import { useMemo } from 'react';
import { BoardView } from '../board/BoardView.tsx';
import { Dice } from '../board/Dice.tsx';
import { activeColor, getLegalMoves } from '@game/rules';
import { pieceKey, type PieceId } from '@game/types';
import { useOnlineGame, type OnlineRoomCredentials } from './useOnlineGame.ts';

export interface OnlineGameViewProps {
  readonly credentials: OnlineRoomCredentials;
  readonly onLeave?: () => void;
}

export function OnlineGameView({ credentials, onLeave }: OnlineGameViewProps) {
  const room = useOnlineGame(credentials);
  const { state, seat, status, error, secondsRemaining, sendIntent } = room;

  const legalMoves = useMemo(
    () => (state !== null && state.phase === 'move' ? getLegalMoves(state) : []),
    [state],
  );
  const legalPieceKeys = useMemo(
    () => new Set(legalMoves.map((m) => pieceKey(m.piece))),
    [legalMoves],
  );

  const myTurn =
    state !== null && seat !== null && activeColor(state) === seat.color;
  const canRoll = myTurn && state?.phase === 'roll' && state.winner === null;

  const handleRoll = (): void => {
    if (!canRoll) return;
    const die = (1 + Math.floor(Math.random() * 6)) as 1 | 2 | 3 | 4 | 5 | 6;
    sendIntent({ type: 'roll', die });
  };

  const handlePiece = (piece: PieceId): void => {
    if (!myTurn || state?.phase !== 'move') return;
    if (!legalPieceKeys.has(pieceKey(piece))) return;
    sendIntent({ type: 'move', piece });
  };

  if (status !== 'open' && state === null) {
    return (
      <div role="status">
        <p>Connecting to room… ({status})</p>
        {error && <p style={{ color: 'crimson' }}>{error}</p>}
        {onLeave && <button onClick={onLeave}>Cancel</button>}
      </div>
    );
  }

  if (state === null) {
    return <p>Waiting for room state…</p>;
  }

  return (
    <div>
      <header style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <span>
          Seat: <strong>{seat?.color ?? 'spectator'}</strong>
        </span>
        <span>Active: {activeColor(state)}</span>
        <span>
          Turn: <strong>{myTurn ? 'you' : 'opponent'}</strong>
        </span>
        <span aria-label="server countdown">
          ⏱ {state.turnDeadline === null ? '—' : `${secondsRemaining}s`}
        </span>
        {onLeave && (
          <button type="button" onClick={onLeave}>
            Leave
          </button>
        )}
      </header>

      <BoardView
        board={state.board}
        players={state.players}
        activeColor={activeColor(state)}
        legalPieceKeys={legalPieceKeys}
        interactive={myTurn && state.phase === 'move'}
        onPieceSelect={handlePiece}
      />

      <div>
        <Dice value={state.dice} canRoll={canRoll} onRoll={handleRoll} />
      </div>

      {error && (
        <p role="alert" style={{ color: 'crimson' }}>
          {error}
        </p>
      )}
      {state.winner !== null && <p>🏆 Winner: {state.winner}</p>}
    </div>
  );
}
