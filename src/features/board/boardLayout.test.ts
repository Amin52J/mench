import { START_TRACK_INDEX } from '@game/board';
import { PLAYER_COLORS } from '@game/types';
import { describe, expect, it } from 'vitest';
import { TRACK_GRID, trackStartCoord } from './boardLayout.ts';

describe('boardLayout track mapping', () => {
  it('maps each color start index to a grid cell', () => {
    for (const color of PLAYER_COLORS) {
      expect(TRACK_GRID[START_TRACK_INDEX[color]]).toEqual(trackStartCoord(color));
    }
  });

  it('has 52 track cells', () => {
    expect(TRACK_GRID).toHaveLength(52);
  });
});
