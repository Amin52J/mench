import type { PlayerColor, PlayerKind } from '@game/types';
import { PLAYER_COLORS } from '@game/types';

/** Alias for {@link PlayerKind} in setup UI. */
export type SeatKind = PlayerKind;

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

export function seatKindsFromSetup(setup: GameSetup): readonly PlayerKind[] {
  return normalizeSetup(setup).seats.map((seat) => seat.kind);
}

export interface QuickSetupPreset {
  readonly id: string;
  readonly label: string;
  readonly setup: GameSetup;
}

export const QUICK_SETUP_PRESETS: readonly QuickSetupPreset[] = [
  {
    id: 'solo-3-cpu',
    label: 'Solo vs 3 CPU',
    setup: {
      playerCount: 4,
      seats: [
        { kind: 'human' },
        { kind: 'cpu' },
        { kind: 'cpu' },
        { kind: 'cpu' },
      ],
    },
  },
  {
    id: 'two-and-two',
    label: '2 humans + 2 CPU',
    setup: {
      playerCount: 4,
      seats: [
        { kind: 'human' },
        { kind: 'human' },
        { kind: 'cpu' },
        { kind: 'cpu' },
      ],
    },
  },
  {
    id: 'all-human-4',
    label: '4 humans',
    setup: defaultSetup(4),
  },
];
