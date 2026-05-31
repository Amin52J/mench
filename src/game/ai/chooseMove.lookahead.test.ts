import { describe, expect, it } from 'vitest';

import { getStartTrackIndex, HOME_FINISH_INDEX } from '../board.ts';
import { placePieces } from '../fixtures.ts';
import {
  createGame,
  getLegalMoves,
  type GameState,
} from '../rules.ts';
import type { PieceIndex, PlayerColor } from '../types.ts';

import { chooseMove } from './chooseMove.ts';
import { SEARCH, scoreMovesWithLookahead } from './search.ts';
import { scoreMove } from './score.ts';

const PLAYERS: readonly PlayerColor[] = ['red', 'green', 'yellow', 'blue'];

function makeGame(
  overrides: Partial<Omit<GameState, 'players' | 'seatKinds' | 'board'>> = {},
): GameState {
  const base = createGame({
    players: PLAYERS,
    seatKinds: ['cpu', 'cpu', 'cpu', 'cpu'],
  });
  return { ...base, ...overrides };
}

describe('chooseMove — frozen lookahead positions', () => {
  it('prefers escaping a threatened piece over advancing into a square the opponent can punish', () => {
    // Two-seat game, die 2. Piece 0 can advance 8 → 10 (no capture bonus but green
    // rolls 6 to land there). Piece 1 flees 5 → 7. Static only nudges progress on the
    // advance; lookahead penalizes the reply and picks the escape.
    const die = 3;
    const twoSeat = createGame({
      players: ['red', 'green'],
      seatKinds: ['cpu', 'cpu'],
    });
    const game = placePieces(
      { ...twoSeat, phase: 'move', dice: die, activePlayerIndex: 0 },
      {
        red: [
          { zone: 'track', index: 6 },
          { zone: 'track', index: 5 },
          { zone: 'yard' },
          { zone: 'yard' },
        ],
        green: [{ zone: 'track', index: 4 }, { zone: 'yard' }, { zone: 'yard' }, { zone: 'yard' }],
      },
    );

    const moves = getLegalMoves(game);
    const reckless = moves.find((m) => m.piece.index === 0)!;
    const escape = moves.find((m) => m.piece.index === 1)!;
    expect(scoreMove(game, escape)).toBeGreaterThan(scoreMove(game, reckless));

    const scored = scoreMovesWithLookahead(game, moves);
    const recklessTotal = scored.find((s) => s.move.piece.index === 0)!.total;
    const escapeTotal = scored.find((s) => s.move.piece.index === 1)!.total;
    expect(escapeTotal).toBeGreaterThan(recklessTotal);

    const choice = chooseMove(game, { random: () => 0 });
    expect(choice!.piece.index).toBe(1 satisfies PieceIndex);
  });

  it('avoids parking where an opponent can enter from yard on a 6 (reply pessimism)', () => {
    // Red die 1: advance to green start (13, safe) vs stop one step short (12, unsafe).
    // Static scores are similar; lookahead penalizes sitting on 12 when green is all-yard.
    const die = 1;
    const GREEN_START = getStartTrackIndex('green');
    const game = placePieces(
      makeGame({ phase: 'move', dice: die, activePlayerIndex: 0 }),
      {
        red: [
          { zone: 'track', index: GREEN_START - 1 },
          { zone: 'track', index: 40 },
          { zone: 'yard' },
          { zone: 'yard' },
        ],
        green: [
          { zone: 'yard' },
          { zone: 'yard' },
          { zone: 'yard' },
          { zone: 'yard' },
        ],
      },
    );

    const choice = chooseMove(game, { random: () => 0 });
    expect(choice!.piece.index).toBe(0);
    expect(choice!.to).toEqual({ zone: 'track', index: GREEN_START });
  });

  it('still prefers exact finish over a capture that hands the opponent a strong reply', () => {
    const die = 3;
    const RED_START = getStartTrackIndex('red');
    const game = placePieces(
      makeGame({ phase: 'move', dice: die, activePlayerIndex: 0 }),
      {
        red: [
          { zone: 'home', index: HOME_FINISH_INDEX - die },
          { zone: 'track', index: RED_START },
          { zone: 'yard' },
          { zone: 'yard' },
        ],
        green: [
          { zone: 'track', index: RED_START + die },
          { zone: 'track', index: RED_START + die - 1 },
          { zone: 'yard' },
          { zone: 'yard' },
        ],
      },
    );

    const choice = chooseMove(game, { random: () => 0 });
    expect(choice!.piece.index).toBe(0);
    expect(choice!.to).toEqual({ zone: 'home', index: HOME_FINISH_INDEX });
  });

  it('returns null when every piece is in the yard on a non-6 roll', () => {
    const game = placePieces(
      makeGame({ phase: 'move', dice: 3, activePlayerIndex: 0 }),
      {
        red: [
          { zone: 'yard' },
          { zone: 'yard' },
          { zone: 'yard' },
          { zone: 'yard' },
        ],
      },
    );
    expect(getLegalMoves(game)).toHaveLength(0);
    expect(chooseMove(game)).toBeNull();
  });

  it('is deterministic for the same RNG seed across many invocations', () => {
    const game = placePieces(
      makeGame({ phase: 'move', dice: 4, activePlayerIndex: 0 }),
      {
        red: [
          { zone: 'track', index: 0 },
          { zone: 'track', index: 10 },
          { zone: 'yard' },
          { zone: 'yard' },
        ],
        green: [
          { zone: 'track', index: 4 },
          { zone: 'track', index: 14 },
          { zone: 'yard' },
          { zone: 'yard' },
        ],
      },
    );

    const first = chooseMove(game, { random: () => 0.25 });
    for (let i = 0; i < 100; i++) {
      expect(chooseMove(game, { random: () => 0.25 })).toEqual(first);
    }
  });

  it('completes high-fanout lookahead within twice the search budget', () => {
    const RED_START = getStartTrackIndex('red');
    const game = placePieces(
      makeGame({ phase: 'move', dice: 6, activePlayerIndex: 0 }),
      {
        red: [
          { zone: 'track', index: RED_START },
          { zone: 'track', index: RED_START + 6 },
          { zone: 'track', index: RED_START + 12 },
          { zone: 'track', index: RED_START + 18 },
        ],
        green: [
          { zone: 'track', index: RED_START + 3 },
          { zone: 'track', index: RED_START + 9 },
          { zone: 'track', index: RED_START + 15 },
          { zone: 'track', index: RED_START + 21 },
        ],
      },
    );

    const start = performance.now();
    const choice = chooseMove(game, { random: () => 0 });
    const elapsed = performance.now() - start;
    expect(choice).not.toBeNull();
    expect(elapsed).toBeLessThan(SEARCH.SEARCH_TIME_BUDGET_MS * 2);
  });
});
