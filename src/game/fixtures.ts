/**
 * Shared board/game fixtures for tests and dev-only visual checks.
 * No React imports.
 */

import { createGame } from './rules.ts';
import type { GameState } from './rules.ts';
import type { BoardState, PieceIndex, PiecePosition, PlayerColor } from './types.ts';
import { PLAYER_COLORS, createInitialBoardState, pieceKey } from './types.ts';

export type PlacementSpec = Partial<Record<PlayerColor, readonly PiecePosition[]>>;

export function placePieces(state: GameState, placements: PlacementSpec): GameState {
  const positions: Record<string, PiecePosition> = { ...state.board.positions };
  for (const color of state.players) {
    const specs = placements[color];
    if (specs === undefined) continue;
    specs.forEach((pos, index) => {
      positions[pieceKey({ color, index: index as PieceIndex })] = pos;
    });
  }
  return { ...state, board: { positions } };
}

export function boardFromPlacements(
  players: readonly PlayerColor[],
  placements: PlacementSpec,
): BoardState {
  const base = createGame({ players: [...players] });
  return placePieces(base, placements).board;
}

/** Four-player start — all pieces in yards. */
export function fixtureInitialBoard(): BoardState {
  return createInitialBoardState(PLAYER_COLORS);
}

/** Mixed track positions for layout smoke tests. */
export function fixtureMidGameBoard(): BoardState {
  return boardFromPlacements(PLAYER_COLORS, {
    red: [
      { zone: 'track', index: 0 },
      { zone: 'track', index: 4 },
      { zone: 'yard' },
      { zone: 'yard' },
    ],
    green: [
      { zone: 'track', index: 13 },
      { zone: 'home', index: 2 },
      { zone: 'yard' },
      { zone: 'yard' },
    ],
    yellow: [{ zone: 'track', index: 26 }, { zone: 'track', index: 30 }, { zone: 'yard' }, { zone: 'yard' }],
    blue: [{ zone: 'home', index: 4 }, { zone: 'track', index: 39 }, { zone: 'yard' }, { zone: 'yard' }],
  });
}

export const DEV_BOARD_FIXTURES = {
  initial: fixtureInitialBoard,
  midGame: fixtureMidGameBoard,
} as const;

export type DevBoardFixtureId = keyof typeof DEV_BOARD_FIXTURES;

export function loadDevBoardFixture(id: DevBoardFixtureId): BoardState {
  return DEV_BOARD_FIXTURES[id]();
}
