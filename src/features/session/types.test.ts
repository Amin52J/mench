import { describe, expect, it } from 'vitest';
import {
  defaultSetup,
  normalizeSetup,
  playersForCount,
  QUICK_SETUP_PRESETS,
  seatKindsFromSetup,
} from './types.ts';

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

  it('seatKindsFromSetup maps kinds for the reducer', () => {
    const setup = QUICK_SETUP_PRESETS[0]!.setup;
    expect(seatKindsFromSetup(setup)).toEqual(['human', 'cpu', 'cpu', 'cpu']);
  });

  it('solo vs 3 CPU preset is four seats', () => {
    const solo = QUICK_SETUP_PRESETS.find((p) => p.id === 'solo-3-cpu');
    expect(solo?.setup.playerCount).toBe(4);
    expect(solo?.setup.seats.filter((s) => s.kind === 'cpu')).toHaveLength(3);
  });
});
