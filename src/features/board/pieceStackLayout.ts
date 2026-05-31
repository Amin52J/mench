import { pieceKey, type PieceId } from '@game/types';
import type { PieceCoord } from './boardLayout.ts';
import type { PieceVisual } from './usePieceAnimations.ts';

export interface StackPieceLayout {
  readonly scale: number;
  /** Offset from cell center, as a fraction of one grid cell (e.g. 0.25 ≈ quarter cell). */
  readonly offsetX: number;
  readonly offsetY: number;
  readonly stackCount: number;
  readonly indexInStack: number;
}

function coordKey({ row, col }: PieceCoord): string {
  return `${row},${col}`;
}

/** Positions/scale for pieces sharing a cell (1–9+ supported). */
export function layoutForStackIndex(count: number, index: number): Pick<StackPieceLayout, 'scale' | 'offsetX' | 'offsetY'> {
  const n = Math.max(1, count);
  const i = Math.max(0, Math.min(index, n - 1));

  if (n === 1) {
    return { scale: 0.88, offsetX: 0, offsetY: 0 };
  }
  if (n === 2) {
    const x = i === 0 ? -0.24 : 0.24;
    return { scale: 0.5, offsetX: x, offsetY: 0 };
  }
  if (n === 3) {
    const spots: ReadonlyArray<{ readonly x: number; readonly y: number }> = [
      { x: 0, y: -0.22 },
      { x: -0.22, y: 0.2 },
      { x: 0.22, y: 0.2 },
    ];
    const spot = spots[i] ?? spots[0]!;
    return { scale: 0.46, offsetX: spot.x, offsetY: spot.y };
  }
  if (n === 4) {
    const col = i % 2 === 0 ? -0.22 : 0.22;
    const row = i < 2 ? -0.22 : 0.22;
    return { scale: 0.46, offsetX: col, offsetY: row };
  }

  const cols = Math.ceil(Math.sqrt(n));
  const rows = Math.ceil(n / cols);
  const scale = Math.min(0.42, 0.88 / cols);
  const col = i % cols;
  const row = Math.floor(i / cols);
  const offsetX = cols === 1 ? 0 : (col / (cols - 1) - 0.5) * 0.48;
  const offsetY = rows === 1 ? 0 : (row / (rows - 1) - 0.5) * 0.48;
  return { scale, offsetX, offsetY };
}

export function computeStackLayouts(
  pieces: readonly PieceVisual[],
): ReadonlyMap<string, StackPieceLayout> {
  const byCell = new Map<string, PieceVisual[]>();
  for (const piece of pieces) {
    const key = coordKey(piece.coord);
    const list = byCell.get(key) ?? [];
    list.push(piece);
    byCell.set(key, list);
  }

  const layouts = new Map<string, StackPieceLayout>();
  for (const cellPieces of byCell.values()) {
    const sorted = [...cellPieces].sort((a, b) => pieceKey(a.id).localeCompare(pieceKey(b.id)));
    const count = sorted.length;
    sorted.forEach((piece, index) => {
      const { scale, offsetX, offsetY } = layoutForStackIndex(count, index);
      layouts.set(pieceKey(piece.id), {
        scale,
        offsetX,
        offsetY,
        stackCount: count,
        indexInStack: index,
      });
    });
  }
  return layouts;
}

export function groupPiecesByCell(
  pieces: readonly PieceVisual[],
): ReadonlyMap<string, readonly PieceVisual[]> {
  const byCell = new Map<string, PieceVisual[]>();
  for (const piece of pieces) {
    const key = coordKey(piece.coord);
    const list = byCell.get(key) ?? [];
    list.push(piece);
    byCell.set(key, list);
  }
  return byCell;
}

/** Picks a legal piece in the cell; cycles when multiple are movable. */
export function pickLegalPieceInCell(
  piecesInCell: readonly PieceVisual[],
  legalPieceKeys: ReadonlySet<string>,
  cycleIndex: number,
): PieceId | null {
  const legal = piecesInCell
    .filter((p) => legalPieceKeys.has(pieceKey(p.id)))
    .sort((a, b) => pieceKey(a.id).localeCompare(pieceKey(b.id)));
  if (legal.length === 0) return null;
  return legal[cycleIndex % legal.length]!.id;
}
