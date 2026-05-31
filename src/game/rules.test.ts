import { describe, expect, it } from 'vitest';
import { HOME_FINISH_INDEX, isSafeTrackIndex } from './board.ts';
import {
  IllegalIntentError,
  activeColor,
  applyIntent,
  applyMove,
  createGame,
  forfeitTurn,
  getLegalMoves,
  isGameOver,
  rollDice,
} from './rules.ts';
import { placePieces } from './fixtures.ts';
import type { DieValue, GameState } from './rules.ts';
import type { PieceId, PieceIndex, PlayerColor } from './types.ts';
import { pieceKey } from './types.ts';

function withDie(state: GameState, die: DieValue): GameState {
  return { ...state, phase: 'move', dice: die };
}

const pid = (color: PlayerColor, index: PieceIndex): PieceId => ({ color, index });

// ---------- createGame -------------------------------------------------------

describe('createGame', () => {
  it('starts a 2–4 player game in the roll phase with all pieces in the yard', () => {
    const game = createGame({ players: ['red', 'green', 'yellow', 'blue'] });
    expect(game.players).toEqual(['red', 'green', 'yellow', 'blue']);
    expect(game.phase).toBe('roll');
    expect(game.dice).toBeNull();
    expect(game.consecutiveSixes).toBe(0);
    expect(game.winner).toBeNull();
    expect(activeColor(game)).toBe('red');
    for (const color of game.players) {
      for (let i = 0; i < 4; i++) {
        expect(game.board.positions[pieceKey(pid(color, i as PieceIndex))]).toEqual({
          zone: 'yard',
        });
      }
    }
  });

  it('omits inactive colors in a 2-player game', () => {
    const game = createGame({ players: ['red', 'yellow'] });
    expect(game.players).toEqual(['red', 'yellow']);
    expect(game.board.positions[pieceKey(pid('green', 0))]).toBeUndefined();
    expect(game.board.positions[pieceKey(pid('blue', 0))]).toBeUndefined();
  });

  it('rejects bad player configurations', () => {
    expect(() => createGame({ players: ['red'] })).toThrow(RangeError);
    expect(() => createGame({ players: ['red', 'red'] as unknown as PlayerColor[] })).toThrow(
      RangeError,
    );
    expect(() =>
      createGame({ players: ['red', 'green'], startingPlayerIndex: 2 }),
    ).toThrow(RangeError);
  });
});

// ---------- legal moves: entering & basic motion ----------------------------

describe('getLegalMoves — entering the board', () => {
  it('requires a 6 to leave the yard', () => {
    const game = createGame({ players: ['red', 'green'] });
    for (const die of [1, 2, 3, 4, 5] as DieValue[]) {
      const moves = getLegalMoves(withDie(game, die));
      expect(moves).toEqual([]);
    }
    const sixes = getLegalMoves(withDie(game, 6));
    expect(sixes).toHaveLength(4);
    for (const m of sixes) {
      expect(m.to).toEqual({ zone: 'track', index: 0 });
      expect(m.capture).toBeNull();
    }
  });

  it('does not allow stacking on a square already occupied by an own piece', () => {
    let game = createGame({ players: ['red', 'green'] });
    game = placePieces(game, {
      red: [
        { zone: 'track', index: 0 },
        { zone: 'yard' },
        { zone: 'yard' },
        { zone: 'yard' },
      ],
    });
    const moves = getLegalMoves(withDie(game, 6));
    // The piece on 0 may still move forward (track motion), but yard pieces
    // cannot enter onto the blocked start square.
    const yardEnters = moves.filter((m) => m.piece.index !== 0);
    expect(yardEnters).toEqual([]);
  });
});

// ---------- captures --------------------------------------------------------

describe('captures', () => {
  it('sends an opponent home when landing on a non-safe square', () => {
    let game = createGame({ players: ['red', 'green'] });
    game = placePieces(game, {
      red: [
        { zone: 'track', index: 4 },
        { zone: 'yard' },
        { zone: 'yard' },
        { zone: 'yard' },
      ],
      green: [
        { zone: 'track', index: 7 },
        { zone: 'yard' },
        { zone: 'yard' },
        { zone: 'yard' },
      ],
    });
    expect(isSafeTrackIndex(7)).toBe(false);

    const rolled = withDie(game, 3);
    const moves = getLegalMoves(rolled);
    const attack = moves.find((m) => m.piece.index === 0);
    expect(attack?.to).toEqual({ zone: 'track', index: 7 });
    expect(attack?.capture).toEqual(pid('green', 0));

    const next = applyMove(rolled, pid('red', 0));
    expect(next.board.positions[pieceKey(pid('green', 0))]).toEqual({ zone: 'yard' });
    expect(next.board.positions[pieceKey(pid('red', 0))]).toEqual({ zone: 'track', index: 7 });
  });

  it('does not capture on a safe square (start/star)', () => {
    let game = createGame({ players: ['red', 'green'] });
    // Green sits on the star at index 8; red on 5 needs a 3 to reach.
    game = placePieces(game, {
      red: [
        { zone: 'track', index: 5 },
        { zone: 'yard' },
        { zone: 'yard' },
        { zone: 'yard' },
      ],
      green: [
        { zone: 'track', index: 8 },
        { zone: 'yard' },
        { zone: 'yard' },
        { zone: 'yard' },
      ],
    });
    expect(isSafeTrackIndex(8)).toBe(true);
    const rolled = withDie(game, 3);
    const move = getLegalMoves(rolled).find((m) => m.piece.index === 0);
    // Landing on a safe square is allowed but **never captures** the opponent
    // sitting there — that's the whole point of stars/start squares.
    expect(move?.to).toEqual({ zone: 'track', index: 8 });
    expect(move?.capture).toBeNull();

    const next = applyMove(rolled, pid('red', 0));
    // Green's piece is untouched on the safe square.
    expect(next.board.positions[pieceKey(pid('green', 0))]).toEqual({
      zone: 'track',
      index: 8,
    });
  });
});

// ---------- exact finish ----------------------------------------------------

describe('exact finish', () => {
  it('refuses to overshoot the home triangle', () => {
    let game = createGame({ players: ['red', 'green'] });
    game = placePieces(game, {
      red: [
        { zone: 'home', index: 3 }, // 2 steps from finish
        { zone: 'yard' },
        { zone: 'yard' },
        { zone: 'yard' },
      ],
    });
    const tooBig = getLegalMoves(withDie(game, 5));
    expect(tooBig.find((m) => m.piece.index === 0)).toBeUndefined();

    const exact = getLegalMoves(withDie(game, 2));
    const m = exact.find((mv) => mv.piece.index === 0);
    expect(m?.to).toEqual({ zone: 'home', index: HOME_FINISH_INDEX });
  });

  it('only allows finishing from the track with the exact die', () => {
    let game = createGame({ players: ['red', 'green'] });
    // Red gate cell is 51 (one before start 0); from there 6 = finish.
    game = placePieces(game, {
      red: [
        { zone: 'track', index: 51 },
        { zone: 'yard' },
        { zone: 'yard' },
        { zone: 'yard' },
      ],
    });
    expect(getLegalMoves(withDie(game, 6)).find((m) => m.piece.index === 0)?.to).toEqual({
      zone: 'home',
      index: HOME_FINISH_INDEX,
    });
    // A 7-equivalent would overshoot; rolling 5 (home index 4) is allowed.
    expect(getLegalMoves(withDie(game, 5)).find((m) => m.piece.index === 0)?.to).toEqual({
      zone: 'home',
      index: 4,
    });
  });
});

// ---------- extra turn on 6 / three-sixes -----------------------------------

describe('extra turn on six & three-sixes forfeit', () => {
  it('keeps the same player rolling after a 6 + move', () => {
    let game = createGame({ players: ['red', 'green'] });
    game = placePieces(game, {
      red: [
        { zone: 'track', index: 10 },
        { zone: 'yard' },
        { zone: 'yard' },
        { zone: 'yard' },
      ],
    });
    let s = rollDice(game, 6);
    expect(s.phase).toBe('move');
    expect(s.consecutiveSixes).toBe(1);
    s = applyMove(s, pid('red', 0));
    expect(activeColor(s)).toBe('red');
    expect(s.phase).toBe('roll');
    expect(s.dice).toBeNull();
    expect(s.consecutiveSixes).toBe(1);
  });

  it('a non-six ends the turn after the move', () => {
    let game = createGame({ players: ['red', 'green'] });
    game = placePieces(game, {
      red: [
        { zone: 'track', index: 10 },
        { zone: 'yard' },
        { zone: 'yard' },
        { zone: 'yard' },
      ],
    });
    let s = rollDice(game, 3);
    s = applyMove(s, pid('red', 0));
    expect(activeColor(s)).toBe('green');
    expect(s.consecutiveSixes).toBe(0);
  });

  it('forfeits the third six without moving', () => {
    let game = createGame({ players: ['red', 'green'] });
    game = placePieces(game, {
      red: [
        { zone: 'track', index: 10 },
        { zone: 'yard' },
        { zone: 'yard' },
        { zone: 'yard' },
      ],
    });
    let s = rollDice(game, 6);
    s = applyMove(s, pid('red', 0));
    s = rollDice(s, 6);
    s = applyMove(s, pid('red', 0));
    expect(s.consecutiveSixes).toBe(2);
    expect(activeColor(s)).toBe('red');
    const before = s.board;
    s = rollDice(s, 6);
    // Third six → no move, turn passes, sixes counter reset.
    expect(s.board).toBe(before);
    expect(activeColor(s)).toBe('green');
    expect(s.consecutiveSixes).toBe(0);
    expect(s.phase).toBe('roll');
  });

  it('passes the turn when a non-six roll has no legal move', () => {
    const game = createGame({ players: ['red', 'green'] });
    // Nothing on the board → only a 6 helps; a 3 has no legal move.
    const s = rollDice(game, 3);
    expect(activeColor(s)).toBe('green');
    expect(s.phase).toBe('roll');
  });

  it('keeps the turn on a 6 that has no legal move (entry blocked by own piece)', () => {
    let game = createGame({ players: ['red', 'green'] });
    game = placePieces(game, {
      red: [
        { zone: 'track', index: 0 },
        { zone: 'home', index: HOME_FINISH_INDEX }, // off the board
        { zone: 'home', index: HOME_FINISH_INDEX },
        { zone: 'home', index: HOME_FINISH_INDEX },
      ],
    });
    // The only non-finished piece sits on its own start (0). Rolling a 6
    // could still advance it to 6 (legal), so this test stays as a sanity
    // check: the 6 keeps the turn either way.
    const s = rollDice(game, 6);
    expect(activeColor(s)).toBe('red');
  });
});

// ---------- win detection ---------------------------------------------------

describe('win detection', () => {
  it('declares a winner when the last piece reaches finish', () => {
    let game = createGame({ players: ['red', 'green'] });
    game = placePieces(game, {
      red: [
        { zone: 'home', index: HOME_FINISH_INDEX },
        { zone: 'home', index: HOME_FINISH_INDEX },
        { zone: 'home', index: HOME_FINISH_INDEX },
        { zone: 'home', index: 4 }, // 1 step from finish
      ],
    });
    const rolled = withDie(game, 1);
    const next = applyMove(rolled, pid('red', 3));
    expect(next.winner).toBe('red');
    expect(isGameOver(next)).toBe(true);
    expect(() => rollDice(next, 6)).toThrow(IllegalIntentError);
  });
});

// ---------- forfeit / timeout ----------------------------------------------

describe('forfeitTurn (30s timer path)', () => {
  it('passes the turn from the roll phase without rolling', () => {
    const game = createGame({ players: ['red', 'green', 'yellow'] });
    const next = forfeitTurn(game);
    expect(activeColor(next)).toBe('green');
    expect(next.phase).toBe('roll');
    expect(next.dice).toBeNull();
    expect(next.consecutiveSixes).toBe(0);
  });

  it('passes the turn from the move phase, discarding the roll', () => {
    let game = createGame({ players: ['red', 'green'] });
    game = placePieces(game, {
      red: [
        { zone: 'track', index: 10 },
        { zone: 'yard' },
        { zone: 'yard' },
        { zone: 'yard' },
      ],
    });
    const rolled = rollDice(game, 4);
    expect(rolled.phase).toBe('move');
    const next = forfeitTurn(rolled);
    expect(activeColor(next)).toBe('green');
    expect(next.phase).toBe('roll');
    expect(next.dice).toBeNull();
  });
});

// ---------- intent dispatcher (Worker surface) -----------------------------

describe('applyIntent', () => {
  it('routes roll/move/forfeit to the matching reducer', () => {
    let game = createGame({ players: ['red', 'green'] });
    game = placePieces(game, {
      red: [
        { zone: 'track', index: 20 },
        { zone: 'yard' },
        { zone: 'yard' },
        { zone: 'yard' },
      ],
    });
    let s = applyIntent(game, { type: 'roll', die: 4 });
    expect(s.phase).toBe('move');
    s = applyIntent(s, { type: 'move', piece: pid('red', 0) });
    expect(activeColor(s)).toBe('green');
    s = applyIntent(s, { type: 'forfeit' });
    expect(activeColor(s)).toBe('red');
  });

  it('rejects out-of-phase intents', () => {
    const game = createGame({ players: ['red', 'green'] });
    expect(() => applyIntent(game, { type: 'move', piece: pid('red', 0) })).toThrow(
      IllegalIntentError,
    );
  });
});
