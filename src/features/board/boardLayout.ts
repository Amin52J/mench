/**
 * 15×15 classic Ludo grid coordinates for rendering.
 * Track index `i` matches `src/game/board.ts` (0 = red start, clockwise).
 * Path cell order derived from a standard 52-cell loop; offset aligns index 0 with red's
 * start square (top-left yard on the rendered board).
 */

import { HOME_FINISH_INDEX, SAFE_TRACK_INDICES, START_TRACK_INDEX } from '@game/board';
import { PLAYER_COLORS, type PiecePosition, type PlayerColor } from '@game/types';

export const GRID_SIZE = 15;

export interface GridCoord {
  readonly row: number;
  readonly col: number;
}

/** Piece center on the grid; may be fractional between cell centers. */
export interface PieceCoord {
  readonly row: number;
  readonly col: number;
}

/** Flat board indices (row * 15 + col) on the shared clockwise path. */
const JAVA_PATH_FLAT: readonly number[] = [
  91, 92, 93, 94, 95, 81, 66, 51, 36, 21, 6, 7, 8, 23, 38, 53, 68, 83, 99, 100, 101, 102, 103,
  104, 119, 134, 133, 132, 131, 130, 129, 143, 158, 173, 188, 203, 218, 217, 216, 201, 186,
  171, 156, 141, 125, 124, 123, 122, 121, 120, 105, 90,
] as const;

/** Rotates the reference path so engine track index 0 is red's start (top-left entry). */
const PATH_OFFSET = 0;

const JAVA_HOME_FLAT: Readonly<Record<PlayerColor, readonly number[]>> = {
  red: [202, 187, 172, 157, 142, 127],
  green: [106, 107, 108, 109, 110, 111],
  yellow: [22, 37, 52, 67, 82, 97],
  blue: [118, 117, 116, 115, 114, 113],
};

/** 2×2 yard slots in the 3rd and 4th columns of each 6×6 corner (see `YARD_GRID`). */
const JAVA_YARD_FLAT: Readonly<Record<PlayerColor, readonly number[]>> = {
  red: [167, 168, 182, 183],
  green: [32, 33, 47, 48],
  yellow: [42, 41, 56, 57],
  blue: [177, 176, 192, 191],
};

export const TRACK_GRID: readonly GridCoord[] = Array.from(
  { length: JAVA_PATH_FLAT.length },
  (_, trackIndex) =>
    flatToCoord(JAVA_PATH_FLAT[(trackIndex + PATH_OFFSET) % JAVA_PATH_FLAT.length]!),
);

/** Physical corner strips from the reference layout (before color assignment). */
const CORNER_HOME = {
  topLeft: JAVA_HOME_FLAT.green,
  topRight: JAVA_HOME_FLAT.yellow,
  bottomRight: JAVA_HOME_FLAT.blue,
  bottomLeft: JAVA_HOME_FLAT.red,
} as const;

const CORNER_YARD = {
  topLeft: JAVA_YARD_FLAT.green,
  topRight: JAVA_YARD_FLAT.yellow,
  bottomRight: JAVA_YARD_FLAT.blue,
  bottomLeft: JAVA_YARD_FLAT.red,
} as const;

/** Board corners: red top-left, green top-right, yellow bottom-right, blue bottom-left. */
export const HOME_GRID: Readonly<Record<PlayerColor, readonly GridCoord[]>> = {
  red: CORNER_HOME.topLeft.map(flatToCoord),
  green: CORNER_HOME.topRight.map(flatToCoord),
  yellow: CORNER_HOME.bottomRight.map(flatToCoord),
  blue: CORNER_HOME.bottomLeft.map(flatToCoord),
};

export const YARD_GRID: Readonly<Record<PlayerColor, readonly GridCoord[]>> = {
  red: CORNER_YARD.topLeft.map(flatToCoord),
  green: CORNER_YARD.topRight.map(flatToCoord),
  yellow: CORNER_YARD.bottomRight.map(flatToCoord),
  blue: CORNER_YARD.bottomLeft.map(flatToCoord),
};

export type CellKind =
  | 'empty'
  | 'track'
  | 'track-safe'
  | 'track-start'
  | 'yard-fill'
  | 'yard-slot'
  | 'home'
  | 'center';

export interface BoardCellModel {
  readonly kind: CellKind;
  readonly color?: PlayerColor;
  readonly trackIndex?: number;
  readonly homeIndex?: number;
}

function flatToCoord(flat: number): GridCoord {
  return { row: Math.floor(flat / GRID_SIZE), col: flat % GRID_SIZE };
}

function coordKey({ row, col }: GridCoord): string {
  return `${row},${col}`;
}

function startColorForTrackIndex(trackIndex: number): PlayerColor | undefined {
  for (const color of PLAYER_COLORS) {
    if (START_TRACK_INDEX[color] === trackIndex) {
      return color;
    }
  }
  return undefined;
}

function buildCellLookup(): Map<string, BoardCellModel> {
  const map = new Map<string, BoardCellModel>();

  for (let trackIndex = 0; trackIndex < TRACK_GRID.length; trackIndex++) {
    const coord = TRACK_GRID[trackIndex]!;
    const startColor = startColorForTrackIndex(trackIndex);
    const kind: CellKind =
      startColor !== undefined
        ? 'track-start'
        : SAFE_TRACK_INDICES.has(trackIndex)
          ? 'track-safe'
          : 'track';
    map.set(coordKey(coord), {
      kind,
      trackIndex,
      ...(startColor !== undefined ? { color: startColor } : {}),
    });
  }

  for (const color of PLAYER_COLORS) {
    const slotKeys = new Set(YARD_GRID[color].map((coord) => coordKey(coord)));
    for (let homeIndex = 0; homeIndex < HOME_GRID[color].length; homeIndex++) {
      map.set(coordKey(HOME_GRID[color][homeIndex]!), { kind: 'home', color, homeIndex });
    }
    for (const coord of yardCellsFor(color)) {
      const kind: CellKind = slotKeys.has(coordKey(coord)) ? 'yard-slot' : 'yard-fill';
      map.set(coordKey(coord), { kind, color });
    }
  }

  for (const coord of CENTER_CELLS) {
    map.set(coordKey(coord), { kind: 'center' });
  }

  return map;
}

/** 6×6 corner blocks (yards) plus home strips — used for tinted backgrounds. */
function yardCellsFor(color: PlayerColor): GridCoord[] {
  const ranges: Record<PlayerColor, { row: [number, number]; col: [number, number] }> = {
    red: { row: [0, 5], col: [0, 5] },
    green: { row: [0, 5], col: [9, 14] },
    yellow: { row: [9, 14], col: [9, 14] },
    blue: { row: [9, 14], col: [0, 5] },
  };
  const { row, col } = ranges[color];
  const cells: GridCoord[] = [];
  for (let r = row[0]; r <= row[1]; r++) {
    for (let c = col[0]; c <= col[1]; c++) {
      cells.push({ row: r, col: c });
    }
  }
  return cells;
}

/** Inclusive origin of the 3×3 center hub (rows/cols 6–8 on the 15×15 grid). */
export const CENTER_HUB_ORIGIN = { row: 6, col: 6 } as const;
export const CENTER_HUB_SIZE = 3;

/** Centroid of each color's finish triangle in the 3×3 hub (matches `CENTER_TRIANGLES`). */
export const FINISH_POSITION_BY_COLOR: Readonly<Record<PlayerColor, PieceCoord>> = {
  red: { row: 7.5, col: 6.5 },
  green: { row: 6.5, col: 7.5 },
  yellow: { row: 7.5, col: 8.5 },
  blue: { row: 8.5, col: 7.5 },
};

export function finishPosition(color: PlayerColor): PieceCoord {
  return FINISH_POSITION_BY_COLOR[color];
}

/** Colored finish triangles (apex at hub center, base on each side). */
export const CENTER_TRIANGLES: ReadonlyArray<{
  readonly color: PlayerColor;
  readonly side: 'top' | 'right' | 'bottom' | 'left';
}> = [
  { color: 'green', side: 'top' },
  { color: 'yellow', side: 'right' },
  { color: 'blue', side: 'bottom' },
  { color: 'red', side: 'left' },
] as const;

const CENTER_CELLS: readonly GridCoord[] = (() => {
  const cells: GridCoord[] = [];
  for (let r = CENTER_HUB_ORIGIN.row; r < CENTER_HUB_ORIGIN.row + CENTER_HUB_SIZE; r++) {
    for (let c = CENTER_HUB_ORIGIN.col; c < CENTER_HUB_ORIGIN.col + CENTER_HUB_SIZE; c++) {
      cells.push({ row: r, col: c });
    }
  }
  return cells;
})();

export const CELL_LOOKUP = buildCellLookup();

export function getCellModel(row: number, col: number): BoardCellModel {
  return CELL_LOOKUP.get(coordKey({ row, col })) ?? { kind: 'empty' };
}

export function positionToCoord(
  color: PlayerColor,
  pieceIndex: number,
  position: PiecePosition,
): PieceCoord | null {
  switch (position.zone) {
    case 'yard':
      return yardSlotCoord(color, pieceIndex);
    case 'track': {
      const cell = TRACK_GRID[position.index];
      return cell === undefined ? null : cellCenter(cell);
    }
    case 'home':
      if (position.index === HOME_FINISH_INDEX) {
        return finishPosition(color);
      }
      return cellCenter(HOME_GRID[color][position.index] ?? null);
  }
}

export function cellCenter(cell: GridCoord | null | undefined): PieceCoord | null {
  if (cell === null || cell === undefined) {
    return null;
  }
  return { row: cell.row + 0.5, col: cell.col + 0.5 };
}

/** Yard slot for a piece index (2×2 within the 6×6 corner). */
export function yardSlotCoord(color: PlayerColor, pieceIndex: number): GridCoord {
  return YARD_GRID[color][pieceIndex] ?? YARD_GRID[color][0]!;
}

export function trackStartCoord(color: PlayerColor): GridCoord {
  return TRACK_GRID[START_TRACK_INDEX[color]]!;
}
