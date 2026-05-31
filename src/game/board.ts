/**
 * Board coordinate system (standard international Ludo)
 *
 * - **Shared track:** 52 cells, indices `0..51`, numbered **clockwise** around the outer path.
 * - **Entry / start squares:** Red `0`, Green `13`, Yellow `26`, Blue `39` (13 cells apart).
 * - **Home column:** per color, indices `0..5` where `0` is the first home square off the track
 *   and `5` is the finished center triangle.
 * - **Safe track cells:** each start square plus the star square 8 steps ahead (clockwise).
 * - **Render order:** `trackIndexToRenderOrder(i) === i` — UI walks the same clockwise path;
 *   use `TRACK_RENDER_ORDER` when iterating cells for drawing.
 *
 * Distance on track is measured from a color's start square: `0` = on start, `51` = on the
 * gate cell (one step before turning into home). No React / DOM imports in this module.
 */

import type { PieceId, PiecePosition, PlayerColor } from './types.ts';
import { pieceKey } from './types.ts';

export const TRACK_LENGTH = 52;
export const HOME_LENGTH = 6;
/** Finished piece sits at home index `HOME_FINISH_INDEX`. */
export const HOME_FINISH_INDEX = HOME_LENGTH - 1;

/** Clockwise start cell on the shared track for each color. */
export const START_TRACK_INDEX: Readonly<Record<PlayerColor, number>> = {
  red: 0,
  green: 13,
  yellow: 26,
  blue: 39,
};

/** Track indices that cannot be captured on (stars + starts). */
export const SAFE_TRACK_INDICES: ReadonlySet<number> = new Set([
  0, 8, 13, 21, 26, 34, 39, 47,
]);

/** `renderOrder` 0..51 → track index (identity path for classic clockwise UI). */
export const TRACK_RENDER_ORDER: readonly number[] = Array.from(
  { length: TRACK_LENGTH },
  (_, renderOrder) => renderOrder,
);

export function trackIndexToRenderOrder(trackIndex: number): number {
  assertTrackIndex(trackIndex);
  return trackIndex;
}

export function renderOrderToTrackIndex(renderOrder: number): number {
  assertTrackIndex(renderOrder);
  return renderOrder;
}

export function isSafeTrackIndex(trackIndex: number): boolean {
  return SAFE_TRACK_INDICES.has(trackIndex);
}

export function getStartTrackIndex(color: PlayerColor): number {
  return START_TRACK_INDEX[color];
}

/** Steps clockwise from this color's start square to `trackIndex`. */
export function trackStepsFromStart(color: PlayerColor, trackIndex: number): number {
  assertTrackIndex(trackIndex);
  const start = getStartTrackIndex(color);
  return (trackIndex - start + TRACK_LENGTH) % TRACK_LENGTH;
}

/** Last shared-track cell before entering this color's home column. */
export function getHomeGateTrackIndex(color: PlayerColor): number {
  return (getStartTrackIndex(color) + TRACK_LENGTH - 1) % TRACK_LENGTH;
}

export function isInHomeStretch(position: PiecePosition): boolean {
  return position.zone === 'home';
}

/**
 * Minimum steps along the legal path to reach home index {@link HOME_FINISH_INDEX}.
 * Does not account for dice legality (e.g. must roll 6 to leave yard).
 */
export function stepsToFinish(color: PlayerColor, position: PiecePosition): number {
  switch (position.zone) {
    case 'yard':
      // Same path length as on the start square once a piece has entered.
      return TRACK_LENGTH + HOME_FINISH_INDEX;
    case 'track': {
      const along = trackStepsFromStart(color, position.index);
      return TRACK_LENGTH - along + HOME_FINISH_INDEX;
    }
    case 'home':
      return Math.max(0, HOME_FINISH_INDEX - position.index);
  }
}

/**
 * Move `steps` forward along this color's path (track → home).
 * Yard pieces are unchanged. Overshooting past finish stays on the last home cell.
 */
export function advanceAlongTrack(
  color: PlayerColor,
  from: PiecePosition,
  steps: number,
): PiecePosition {
  if (steps <= 0 || from.zone === 'yard') {
    return from;
  }

  if (from.zone === 'home') {
    const next = Math.min(from.index + steps, HOME_FINISH_INDEX);
    return { zone: 'home', index: next };
  }

  const along = trackStepsFromStart(color, from.index);
  const afterTrack = along + steps;

  if (afterTrack < TRACK_LENGTH) {
    const start = getStartTrackIndex(color);
    return { zone: 'track', index: (start + afterTrack) % TRACK_LENGTH };
  }

  const homeSteps = afterTrack - TRACK_LENGTH;
  if (homeSteps >= HOME_LENGTH) {
    return { zone: 'home', index: HOME_FINISH_INDEX };
  }

  return { zone: 'home', index: homeSteps };
}

export function getPiecePosition(
  board: Readonly<{ positions: Readonly<Record<string, PiecePosition>> }>,
  id: PieceId,
): PiecePosition | undefined {
  return board.positions[pieceKey(id)];
}

function assertTrackIndex(trackIndex: number): void {
  if (!Number.isInteger(trackIndex) || trackIndex < 0 || trackIndex >= TRACK_LENGTH) {
    throw new RangeError(`track index must be 0..${TRACK_LENGTH - 1}, got ${trackIndex}`);
  }
}
