import {
  applyMove,
  createGame,
  forfeitTurn,
  rollDice,
  type DieValue,
  type GameState,
} from '@game/rules';
import type { PieceId } from '@game/types';
import { playersForCount, type GameSetup } from './types.ts';

export type LocalGameAction =
  | { readonly type: 'start'; readonly setup: GameSetup }
  | { readonly type: 'roll'; readonly die: DieValue }
  | { readonly type: 'move'; readonly piece: PieceId }
  | { readonly type: 'forfeit' }
  | { readonly type: 'restart'; readonly setup: GameSetup }
  | { readonly type: 'reset' };

export function localGameReducer(
  state: GameState | null,
  action: LocalGameAction,
): GameState | null {
  switch (action.type) {
    case 'start':
      return createGame({ players: [...playersForCount(action.setup.playerCount)] });
    case 'restart':
      return createGame({ players: [...playersForCount(action.setup.playerCount)] });
    case 'roll':
      return state === null ? state : rollDice(state, action.die);
    case 'move':
      return state === null ? state : applyMove(state, action.piece);
    case 'forfeit':
      return state === null ? state : forfeitTurn(state);
    case 'reset':
      return null;
    default:
      return state;
  }
}

export function randomDie(): DieValue {
  return (Math.floor(Math.random() * 6) + 1) as DieValue;
}
