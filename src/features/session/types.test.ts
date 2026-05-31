import { describe, expect, it } from 'vitest';
import { defaultSetup, normalizeSetup, playersForCount } from './types.ts';

describe('session setup helpers', () => {
  it('maps player count to clockwise colors', () => {
    expect(playersForCount(2)).toEqual(['red', 'green']);
    expect(playersForCount(4)).toEqual(['red', 'green', 'yellow', 'blue']);
  });

  it('pads seats when normalizing', () => {
    const setup = normalizeSetup({ playerCount: 3, seats: [{ kind: 'human' }] });
    expect(setup.seats).toHaveLength(3);
    expect(setup.seats.every((s) => s.kind === 'human')).toBe(true);
  });

  it('defaultSetup is four humans', () => {
    const setup = defaultSetup();
    expect(setup.playerCount).toBe(4);
    expect(setup.seats).toHaveLength(4);
  });
});
