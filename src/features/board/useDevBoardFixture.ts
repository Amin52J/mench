import { useMemo } from 'react';
import {
  DEV_BOARD_FIXTURES,
  type DevBoardFixtureId,
  loadDevBoardFixture,
} from '@game/fixtures';
import type { BoardState, PlayerColor } from '@game/types';

const FIXTURE_IDS = Object.keys(DEV_BOARD_FIXTURES) as DevBoardFixtureId[];

function readFixtureId(): DevBoardFixtureId {
  if (!import.meta.env.DEV) {
    return 'initial';
  }
  const raw = new URLSearchParams(globalThis.location.search).get('fixture');
  if (raw !== null && FIXTURE_IDS.includes(raw as DevBoardFixtureId)) {
    return raw as DevBoardFixtureId;
  }
  return 'initial';
}

export interface DevBoardFixtureState {
  readonly board: BoardState;
  readonly fixtureId: DevBoardFixtureId;
  readonly activeColor: PlayerColor;
  readonly isDev: boolean;
}

export function useDevBoardFixture(): DevBoardFixtureState {
  const fixtureId = readFixtureId();
  const board = useMemo(() => loadDevBoardFixture(fixtureId), [fixtureId]);
  const activeColor: PlayerColor = fixtureId === 'midGame' ? 'green' : 'red';

  return {
    board,
    fixtureId,
    activeColor,
    isDev: import.meta.env.DEV,
  };
}

export function devFixtureOptions(): readonly DevBoardFixtureId[] {
  return FIXTURE_IDS;
}
