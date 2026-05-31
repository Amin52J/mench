import { advanceAlongTrack } from '@game/board';
import type { PieceIndex, PiecePosition, PlayerColor } from '@game/types';
import { positionToCoord, yardSlotCoord, type PieceCoord } from './boardLayout.ts';

export function positionsEqual(a: PiecePosition, b: PiecePosition): boolean {
  if (a.zone !== b.zone) return false;
  if (a.zone === 'yard') return true;
  return a.index === (b as { index: number }).index;
}

/**
 * Grid cells to visit when a piece moves from `from` to `to` (inclusive endpoints).
 * Used for stepped piece motion in the UI layer only.
 */
export function buildPieceCoordPath(
  color: PlayerColor,
  pieceIndex: PieceIndex,
  from: PiecePosition,
  to: PiecePosition,
): PieceCoord[] {
  const path: PieceCoord[] = [];
  const push = (pos: PiecePosition): void => {
    const coord =
      pos.zone === 'yard'
        ? yardSlotCoord(color, pieceIndex)
        : positionToCoord(color, pieceIndex, pos);
    if (coord !== null) {
      path.push(coord);
    }
  };

  push(from);
  if (positionsEqual(from, to)) {
    return path;
  }

  if (from.zone === 'yard' && to.zone === 'track') {
    push(to);
    return path;
  }

  /** Capture return: UI animates as a single drag to the yard (`usePieceAnimations`). */
  if (from.zone === 'track' && to.zone === 'yard') {
    push(to);
    return path;
  }

  let current = from;
  let guard = 0;
  while (!positionsEqual(current, to) && guard < 64) {
    guard += 1;
    current = advanceAlongTrack(color, current, 1);
    push(current);
  }

  return path;
}
