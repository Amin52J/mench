import { describe, expect, it } from 'vitest';
import { autoPlayCurrentTurn } from './autoPlay.ts';
import { activeColor, createGame } from './rules.ts';
import { placePieces } from './fixtures.ts';

describe('autoPlayCurrentTurn', () => {
  it('finishes a human roll+move turn without changing seat kind', () => {
    let game = createGame({ players: ['red', 'green'] });
    game = placePieces(game, {
      red: [
        { zone: 'track', index: 10 },
        { zone: 'yard' },
        { zone: 'yard' },
        { zone: 'yard' },
      ],
    });
    const next = autoPlayCurrentTurn(game, () => 4);
    expect(next.seatKinds).toEqual(game.seatKinds);
    expect(activeColor(next)).toBe('green');
    expect(next.phase).toBe('roll');
  });

  it('plays through roll and move without skipping the seat kind', () => {
    const game = createGame({
      players: ['red', 'green'],
      seatKinds: ['human', 'cpu'],
    });
    const next = autoPlayCurrentTurn(game, () => 6);
    expect(next.seatKinds).toEqual(['human', 'cpu']);
    expect(next.winner).toBeNull();
  });
});
