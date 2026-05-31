import {
  activeColor,
  applyMove,
  createGame,
  getLegalMoves,
  rollDice,
  type DieValue,
  type GameState,
  type LegalMove,
} from '@game/rules';
import { PLAYER_COLORS, pieceKey, type PieceId } from '@game/types';
import { useCallback, useMemo, useState } from 'react';

function randomDie(): DieValue {
  return (Math.floor(Math.random() * 6) + 1) as DieValue;
}

export interface AnimationPlaygroundState {
  readonly game: GameState;
  readonly activeColor: ReturnType<typeof activeColor>;
  readonly legalMoves: readonly LegalMove[];
  readonly canRoll: boolean;
  readonly roll: () => void;
  readonly move: (piece: PieceId) => void;
}

export function useAnimationPlayground(): AnimationPlaygroundState {
  const [game, setGame] = useState<GameState>(() =>
    createGame({ players: [...PLAYER_COLORS] }),
  );

  const legalMoves = useMemo(
    () => (game.phase === 'move' ? getLegalMoves(game) : []),
    [game],
  );

  const roll = useCallback(() => {
    setGame((current) => rollDice(current, randomDie()));
  }, []);

  const move = useCallback((piece: PieceId) => {
    setGame((current) => applyMove(current, piece));
  }, []);

  return {
    game,
    activeColor: activeColor(game),
    legalMoves,
    canRoll: game.phase === 'roll' && game.winner === null,
    roll,
    move,
  };
}

export function formatMoveLabel(move: LegalMove): string {
  const capture =
    move.captures.length > 0
      ? ` (captures ${move.captures.map((c) => pieceKey(c)).join(', ')})`
      : '';
  return `${move.piece.color} #${move.piece.index + 1} → ${move.to.zone}${capture}`;
}
