import { describe, expect, it } from 'vitest';
import { finishPosition, HOME_GRID, yardSlotCoord } from './boardLayout.ts';
import { buildPieceCoordPath, positionsEqual } from './piecePath.ts';

describe('buildPieceCoordPath', () => {
  it('returns a single coord when position is unchanged', () => {
    const from = { zone: 'yard' as const };
    const path = buildPieceCoordPath('red', 0, from, from);
    expect(path).toHaveLength(1);
    expect(path[0]).toEqual(yardSlotCoord('red', 0));
  });

  it('steps along track for multi-cell moves', () => {
    const from = { zone: 'track' as const, index: 0 };
    const to = { zone: 'track' as const, index: 3 };
    const path = buildPieceCoordPath('red', 0, from, to);
    expect(path).toHaveLength(4);
    expect(path.at(-1)).toEqual(buildPieceCoordPath('red', 0, to, to)[0]);
  });

  it('steps through each home column cell', () => {
    const from = { zone: 'home' as const, index: 0 };
    const to = { zone: 'home' as const, index: 3 };
    const path = buildPieceCoordPath('red', 0, from, to);
    expect(path).toHaveLength(4);
  });

  it('animates finish into that color’s triangle (not the hub junction)', () => {
    const from = { zone: 'home' as const, index: 4 };
    const to = { zone: 'home' as const, index: 5 };
    const path = buildPieceCoordPath('red', 0, from, to);
    expect(path.at(-1)).toEqual(finishPosition('red'));
    expect(path.at(-1)).not.toEqual(finishPosition('green'));
    const lastHomeCell = HOME_GRID.red[4]!;
    expect(path.at(-1)).not.toEqual({ row: lastHomeCell.row + 0.5, col: lastHomeCell.col + 0.5 });
  });

  it('jumps from yard to track entry in two coords', () => {
    const from = { zone: 'yard' as const };
    const to = { zone: 'track' as const, index: 0 };
    const path = buildPieceCoordPath('red', 0, from, to);
    expect(path).toHaveLength(2);
  });

  it('has no consecutive duplicate coords on a long move', () => {
    const from = { zone: 'track' as const, index: 0 };
    const to = { zone: 'track' as const, index: 10 };
    const path = buildPieceCoordPath('red', 0, from, to);
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1]!;
      const b = path[i]!;
      expect(a.row === b.row && a.col === b.col).toBe(false);
    }
  });

  it('uses a direct path for capture return (drag animation in UI)', () => {
    const from = { zone: 'track' as const, index: 4 };
    const to = { zone: 'yard' as const };
    const path = buildPieceCoordPath('red', 1, from, to);
    expect(path).toHaveLength(2);
    expect(path[0]).toEqual(buildPieceCoordPath('red', 1, from, from)[0]);
    expect(path.at(-1)).toEqual(yardSlotCoord('red', 1));
  });
});

describe('positionsEqual', () => {
  it('treats yard positions as equal', () => {
    expect(positionsEqual({ zone: 'yard' }, { zone: 'yard' })).toBe(true);
  });
});
