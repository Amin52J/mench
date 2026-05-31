import { START_TRACK_INDEX } from '@game/board';
import { PLAYER_COLORS } from '@game/types';
import { describe, expect, it } from 'vitest';
import {
  CENTER_HUB_ORIGIN,
  CENTER_HUB_SIZE,
  getCellModel,
  TRACK_GRID,
  trackStartCoord,
  YARD_GRID,
} from './boardLayout.ts';

describe('boardLayout track mapping', () => {
  it('maps each color start index to a grid cell', () => {
    for (const color of PLAYER_COLORS) {
      expect(TRACK_GRID[START_TRACK_INDEX[color]]).toEqual(trackStartCoord(color));
    }
  });

  it('has 52 track cells', () => {
    expect(TRACK_GRID).toHaveLength(52);
  });

  it('colors each player start square on the track', () => {
    for (const color of PLAYER_COLORS) {
      const coord = trackStartCoord(color);
      const model = getCellModel(coord.row, coord.col);
      expect(model.kind).toBe('track-start');
      expect(model.color).toBe(color);
    }
  });

  it('places yard pieces in the 3rd and 4th columns of each corner', () => {
    const expectYardCols = (color: (typeof PLAYER_COLORS)[number], cols: [number, number]) => {
      const usedCols = new Set(YARD_GRID[color].map((c) => c.col));
      expect(usedCols).toEqual(new Set(cols));
    };
    expectYardCols('red', [2, 3]);
    expectYardCols('blue', [2, 3]);
    expectYardCols('green', [11, 12]);
    expectYardCols('yellow', [11, 12]);
  });

  it('uses yard-fill for the corner block and yard-slot only for piece wells', () => {
    for (const color of PLAYER_COLORS) {
      for (const coord of YARD_GRID[color]) {
        expect(getCellModel(coord.row, coord.col).kind).toBe('yard-slot');
      }
    }
    expect(getCellModel(0, 0).kind).toBe('yard-fill');
    expect(getCellModel(0, 1).kind).toBe('yard-fill');
  });

  it('keeps star safe squares neutral', () => {
    const starIndex = 8;
    expect(START_TRACK_INDEX.red).not.toBe(starIndex);
    const coord = TRACK_GRID[starIndex]!;
    const model = getCellModel(coord.row, coord.col);
    expect(model.kind).toBe('track-safe');
    expect(model.color).toBeUndefined();
  });

  it('marks the 3×3 center hub as center cells', () => {
    for (let r = CENTER_HUB_ORIGIN.row; r < CENTER_HUB_ORIGIN.row + CENTER_HUB_SIZE; r++) {
      for (let c = CENTER_HUB_ORIGIN.col; c < CENTER_HUB_ORIGIN.col + CENTER_HUB_SIZE; c++) {
        expect(getCellModel(r, c).kind).toBe('center');
      }
    }
  });
});
