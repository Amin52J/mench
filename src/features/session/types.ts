import type { PlayerColor } from '@game/types';
import { PLAYER_COLORS } from '@game/types';

export type SeatKind = 'human' | 'cpu';

export interface SeatConfig {
  readonly kind: SeatKind;
}

export type PlayerCount = 2 | 3 | 4;

export interface GameSetup {
  readonly playerCount: PlayerCount;
  readonly seats: readonly SeatConfig[];
}

export function playersForCount(count: PlayerCount): readonly PlayerColor[] {
  return PLAYER_COLORS.slice(0, count);
}

export function defaultSetup(playerCount: PlayerCount = 4): GameSetup {
  return {
    playerCount,
    seats: Array.from({ length: playerCount }, () => ({ kind: 'human' })),
  };
}

export function normalizeSetup(setup: GameSetup): GameSetup {
  const seats = setup.seats.slice(0, setup.playerCount);
  while (seats.length < setup.playerCount) {
    seats.push({ kind: 'human' });
  }
  return { playerCount: setup.playerCount, seats };
}
