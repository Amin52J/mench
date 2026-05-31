import { describe, expect, it } from 'vitest';
import { pieceKey } from '@game/types';
import {
  computeStackLayouts,
  layoutForStackIndex,
  pickLegalPieceInCell,
} from './pieceStackLayout.ts';
import type { PieceVisual } from './usePieceAnimations.ts';

function visual(
  color: PieceVisual['color'],
  index: PieceVisual['index'],
  row: number,
  col: number,
): PieceVisual {
  return {
    id: { color, index },
    color,
    index,
    coord: { row, col },
    stackIndex: 0,
  };
}

describe('layoutForStackIndex', () => {
  it('shrinks pieces as stack count grows', () => {
    expect(layoutForStackIndex(1, 0).scale).toBeGreaterThan(layoutForStackIndex(4, 0).scale);
    expect(layoutForStackIndex(4, 0).scale).toBeGreaterThan(layoutForStackIndex(9, 0).scale);
  });
});

describe('computeStackLayouts', () => {
  it('assigns distinct offsets for four pieces in one cell', () => {
    const pieces = [0, 1, 2, 3].map((i) => visual('red', i as 0, 4, 4));
    const layouts = computeStackLayouts(pieces);
    const offsets = pieces.map((p) => {
      const l = layouts.get(pieceKey(p.id))!;
      return `${l.offsetX},${l.offsetY}`;
    });
    expect(new Set(offsets).size).toBe(4);
  });
});

describe('pickLegalPieceInCell', () => {
  it('cycles through legal pieces in stable order', () => {
    const pieces = [visual('red', 0, 2, 2), visual('red', 1, 2, 2)];
    const legal = new Set([pieceKey({ color: 'red', index: 0 }), pieceKey({ color: 'red', index: 1 })]);
    expect(pickLegalPieceInCell(pieces, legal, 0)?.index).toBe(0);
    expect(pickLegalPieceInCell(pieces, legal, 1)?.index).toBe(1);
    expect(pickLegalPieceInCell(pieces, legal, 2)?.index).toBe(0);
  });
});
