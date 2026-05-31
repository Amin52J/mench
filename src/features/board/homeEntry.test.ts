import {
  getLastLapTrackIndex,
  getPreStartTrackIndex,
  getStartTrackIndex,
  isPreStartTrackForColor,
} from '@game/board';
import { PLAYER_COLORS } from '@game/types';
import { describe, expect, it } from 'vitest';
import { cellCenter, HOME_GRID, TRACK_GRID } from './boardLayout.ts';
import { buildPieceCoordPath } from './piecePath.ts';

function key(c: { row: number; col: number }): string {
  return `${c.row},${c.col}`;
}

describe('home entry layout', () => {
  it('last lap cell is track index 50 from start, not the pre-start cell', () => {
    for (const color of PLAYER_COLORS) {
      const lastLap = getLastLapTrackIndex(color);
      const preStart = getPreStartTrackIndex(color);
      expect(lastLap).toBe((getStartTrackIndex(color) + 50) % 52);
      expect(preStart).not.toBe(lastLap);
      expect(isPreStartTrackForColor(color, preStart)).toBe(true);
    }
  });

  it('first home cell is the colored strip entry, not start or pre-start (red)', () => {
    const start = cellCenter(TRACK_GRID[getStartTrackIndex('red')]!)!;
    const preStart = cellCenter(TRACK_GRID[getPreStartTrackIndex('red')]!)!;
    const lastLap = cellCenter(TRACK_GRID[getLastLapTrackIndex('red')]!)!;
    const home0 = cellCenter(HOME_GRID.red[0]!)!;
    expect(key(home0)).not.toBe(key(start));
    expect(key(home0)).not.toBe(key(preStart));
    expect(key(lastLap)).not.toBe(key(home0));
  });

  it('entering home from last lap goes to colored home without pre-start or start (red)', () => {
    const lastLap = getLastLapTrackIndex('red');
    const from = { zone: 'track' as const, index: lastLap };
    const to = { zone: 'home' as const, index: 0 };
    const path = buildPieceCoordPath('red', 0, from, to);
    const keys = path.map(key);
    expect(keys).toEqual([
      key(cellCenter(TRACK_GRID[lastLap]!)!),
      key(cellCenter(HOME_GRID.red[0]!)!),
    ]);
    expect(keys).not.toContain(key(cellCenter(TRACK_GRID[getPreStartTrackIndex('red')]!)!));
    expect(keys).not.toContain(key(cellCenter(TRACK_GRID[getStartTrackIndex('red')]!)!));
  });
});
