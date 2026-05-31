import { describe, expect, it } from 'vitest';

import { getStartTrackIndex, HOME_FINISH_INDEX } from '../board.ts';
import { placePieces } from '../fixtures.ts';
import { createGame, type GameState } from '../rules.ts';
import type { PieceIndex, PlayerColor } from '../types.ts';

import { chooseMove } from './chooseMove.ts';
import {
  CPU_THINK_DELAY_MAX_MS,
  CPU_THINK_DELAY_MIN_MS,
  pickCpuThinkDelayMs,
} from './index.ts';
import { isCellThreatened, scoreMove } from './score.ts';

/** Four-color test boards — red at index 0 so `activePlayerIndex: 0` means red's turn. */
const TEST_FOUR_PLAYERS: readonly PlayerColor[] = ['red', 'green', 'yellow', 'blue'];

function makeGame(
  overrides: Partial<Omit<GameState, 'players' | 'seatKinds' | 'board'>> = {},
): GameState {
  const base = createGame({
    players: TEST_FOUR_PLAYERS,
    seatKinds: ['cpu', 'cpu', 'cpu', 'cpu'],
  });
  return { ...base, ...overrides };
}

describe('chooseMove — heuristics', () => {
  it('prefers capture over a neutral advance when both are legal', () => {
    // Red has two pieces on track. Green sits on an unsafe square reachable
    // by piece 0 with the rolled die. Piece 1 has no capture target.
    const RED_START = getStartTrackIndex('red'); // 0
    const die = 3;
    const captureTarget = RED_START + die; // 3 — not a safe cell
    const game = placePieces(
      makeGame({ phase: 'move', dice: die, activePlayerIndex: 0 }),
      {
        red: [
          { zone: 'track', index: RED_START }, // piece 0 → can capture
          { zone: 'track', index: 40 }, // piece 1 → neutral advance
          { zone: 'yard' },
          { zone: 'yard' },
        ],
        green: [
          { zone: 'track', index: captureTarget },
          { zone: 'yard' },
          { zone: 'yard' },
          { zone: 'yard' },
        ],
      },
    );

    const choice = chooseMove(game, { random: () => 0 });
    expect(choice).not.toBeNull();
    expect(choice!.piece.index).toBe(0 satisfies PieceIndex);
    expect(choice!.captures.length).toBeGreaterThan(0);
    expect(choice!.captures[0]!.color).toBe('green');
  });

  it('returns null when there are no legal moves', () => {
    // Phase is `roll` → getLegalMoves returns empty.
    const game = makeGame({ phase: 'roll', dice: null });
    expect(chooseMove(game)).toBeNull();
  });

  it('prefers entering a piece on a rolled 6 over advancing a fresh track piece', () => {
    const RED_START = getStartTrackIndex('red');
    const game = placePieces(
      makeGame({ phase: 'move', dice: 6, activePlayerIndex: 0 }),
      {
        red: [
          { zone: 'yard' }, // piece 0 → can enter
          { zone: 'track', index: RED_START + 10 }, // piece 1 → can advance
          { zone: 'yard' },
          { zone: 'yard' },
        ],
      },
    );

    const choice = chooseMove(game, { random: () => 0 });
    expect(choice).not.toBeNull();
    expect(choice!.piece.index).toBe(0);
    expect(choice!.to).toEqual({ zone: 'track', index: RED_START });
  });

  it('prefers landing exactly on the finish triangle', () => {
    const die = 3;
    const game = placePieces(
      makeGame({ phase: 'move', dice: die, activePlayerIndex: 0 }),
      {
        red: [
          // Home index (HOME_FINISH_INDEX - die) → exact finish landing.
          { zone: 'home', index: HOME_FINISH_INDEX - die },
          // Far-behind track piece that would otherwise be the obvious move.
          { zone: 'track', index: getStartTrackIndex('red') + 5 },
          { zone: 'yard' },
          { zone: 'yard' },
        ],
      },
    );

    const choice = chooseMove(game, { random: () => 0 });
    expect(choice!.piece.index).toBe(0);
    expect(choice!.to).toEqual({ zone: 'home', index: HOME_FINISH_INDEX });
  });

  it('escapes a threatened piece instead of advancing a safe one', () => {
    // Red piece 0 sits on an unsafe track cell threatened by green; piece 1
    // is on a safe star square. Die value lets both move forward.
    const die = 2;
    const REDS_THREATENED = 5; // not a safe index
    const GREEN_ATTACKER = REDS_THREATENED - 1; // green hits on a 1
    expect(GREEN_ATTACKER).toBeGreaterThan(0);
    const game = placePieces(
      makeGame({ phase: 'move', dice: die, activePlayerIndex: 0 }),
      {
        red: [
          { zone: 'track', index: REDS_THREATENED },
          { zone: 'track', index: 8 }, // 8 is a safe star
          { zone: 'yard' },
          { zone: 'yard' },
        ],
        green: [
          { zone: 'track', index: GREEN_ATTACKER },
          { zone: 'yard' },
          { zone: 'yard' },
          { zone: 'yard' },
        ],
      },
    );

    expect(isCellThreatened(game, 'red', REDS_THREATENED)).toBe(true);
    const choice = chooseMove(game, { random: () => 0 });
    expect(choice!.piece.index).toBe(0);
  });

  it('scoreMove gives capture a higher score than a neutral progress move', () => {
    const RED_START = getStartTrackIndex('red');
    const die = 3;
    const game = placePieces(
      makeGame({ phase: 'move', dice: die, activePlayerIndex: 0 }),
      {
        red: [
          { zone: 'track', index: RED_START },
          { zone: 'track', index: 40 },
          { zone: 'yard' },
          { zone: 'yard' },
        ],
        green: [
          { zone: 'track', index: RED_START + die },
          { zone: 'yard' },
          { zone: 'yard' },
          { zone: 'yard' },
        ],
      },
    );

    const [capture, neutral] = [
      {
        piece: { color: 'red' as const, index: 0 as PieceIndex },
        to: { zone: 'track' as const, index: RED_START + die },
        captures: [{ color: 'green' as const, index: 0 as PieceIndex }],
      },
      {
        piece: { color: 'red' as const, index: 1 as PieceIndex },
        to: { zone: 'track' as const, index: 43 },
        captures: [],
      },
    ];

    expect(scoreMove(game, capture)).toBeGreaterThan(scoreMove(game, neutral));
  });
});

describe('pickCpuThinkDelayMs', () => {
  it('stays within the documented bounds (product.mdc: 300–800ms)', () => {
    expect(pickCpuThinkDelayMs(() => 0)).toBe(CPU_THINK_DELAY_MIN_MS);
    expect(pickCpuThinkDelayMs(() => 0.9999999)).toBe(CPU_THINK_DELAY_MAX_MS);
    for (let i = 0; i < 20; i++) {
      const d = pickCpuThinkDelayMs();
      expect(d).toBeGreaterThanOrEqual(CPU_THINK_DELAY_MIN_MS);
      expect(d).toBeLessThanOrEqual(CPU_THINK_DELAY_MAX_MS);
    }
  });
});
