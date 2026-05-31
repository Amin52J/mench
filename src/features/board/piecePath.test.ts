import { describe, expect, it } from 'vitest';
import { yardSlotCoord } from './boardLayout.ts';
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
    expect(path.length).toBeGreaterThan(1);
    expect(path.at(-1)).toEqual(buildPieceCoordPath('red', 0, to, to)[0]);
  });

  it('jumps from yard to track entry in two coords', () => {
    const from = { zone: 'yard' as const };
    const to = { zone: 'track' as const, index: 0 };
    const path = buildPieceCoordPath('red', 0, from, to);
    expect(path).toHaveLength(2);
  });

  it('moves captured piece from track to yard slot', () => {
    const from = { zone: 'track' as const, index: 10 };
    const to = { zone: 'yard' as const };
    const path = buildPieceCoordPath('green', 1, from, to);
    expect(path).toHaveLength(2);
  });
});

describe('positionsEqual', () => {
  it('treats yard positions as equal', () => {
    expect(positionsEqual({ zone: 'yard' }, { zone: 'yard' })).toBe(true);
  });
});
