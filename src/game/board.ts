/**
 * Board coordinate system (standard international Ludo)
 *
 * - **Shared track:** 52 cells, indices `0..51`, numbered **clockwise** around the outer path.
 * - **Entry / start squares:** Red `0`, Green `13`, Yellow `26`, Blue `39` (13 cells apart on
 *   the shared loop). Rendered corners: red top-left, green top-right, yellow bottom-right,
 *   blue bottom-left (`boardLayout.ts`).
 * - **Home column:** per color, indices `0..5` where `0` is the first home square off the track
 *   and `5` is the finished center triangle.
 * - **Safe track cells:** each start square plus the star square 8 steps ahead (clockwise).
 * - **Render order:** `trackIndexToRenderOrder(i) === i` — UI walks the same clockwise path;
 *   use `TRACK_RENDER_ORDER` when iterating cells for drawing.
 *
 * Distance on track is measured from a color's start square: `0` = on start, `50` = last lap
 * cell, then home column. The shared cell immediately before each start (along `51`) is
 * never occupied by that color's pieces; other colors may use it. No React / DOM imports.
 */

import type { PieceId, PiecePosition, PlayerColor } from './types.ts';
import { pieceKey } from './types.ts';

export const TRACK_LENGTH = 52;
/** Playable lap steps from start: along `0` (start) through `50` (last track), then home. */
export const LAP_LENGTH = 51;
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

/** Shared track cell clockwise before this color's start (along step `51`). */
export function getPreStartTrackIndex(color: PlayerColor): number {
  return (getStartTrackIndex(color) + TRACK_LENGTH - 1) % TRACK_LENGTH;
}

/** @deprecated Use {@link getPreStartTrackIndex}. */
export function getHomeGateTrackIndex(color: PlayerColor): number {
  return getPreStartTrackIndex(color);
}

/** Last track cell on this color's lap (along step `50`). */
export function getLastLapTrackIndex(color: PlayerColor): number {
  return (getStartTrackIndex(color) + LAP_LENGTH - 1) % TRACK_LENGTH;
}

/** True when `trackIndex` is the pre-start cell for `color` (that color never rests here). */
export function isPreStartTrackForColor(color: PlayerColor, trackIndex: number): boolean {
  return trackIndex === getPreStartTrackIndex(color);
}

function trackIndexFromAlong(color: PlayerColor, along: number): number {
  return (getStartTrackIndex(color) + along) % TRACK_LENGTH;
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
      return LAP_LENGTH + HOME_FINISH_INDEX;
    case 'track': {
      const along = trackStepsFromStart(color, position.index);
      return LAP_LENGTH - along + HOME_FINISH_INDEX;
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

  if (afterTrack < LAP_LENGTH) {
    return { zone: 'track', index: trackIndexFromAlong(color, afterTrack) };
  }

  const homeSteps = afterTrack - LAP_LENGTH;
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
