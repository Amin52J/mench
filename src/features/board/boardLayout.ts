/**
 * 15×15 classic Ludo grid coordinates for rendering.
 * Track index `i` matches `src/game/board.ts` (0 = red start, clockwise).
 * Path cell order derived from a standard 52-cell loop; offset aligns index 0 with red's
 * start square (top-left yard on the rendered board).
 */

import { SAFE_TRACK_INDICES, START_TRACK_INDEX } from '@game/board';
import { PLAYER_COLORS, type PiecePosition, type PlayerColor } from '@game/types';

export const GRID_SIZE = 15;

export interface GridCoord {
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

const JAVA_YARD_FLAT: Readonly<Record<PlayerColor, readonly number[]>> = {
  red: [166, 167, 181, 182],
  green: [31, 32, 46, 47],
  yellow: [43, 42, 58, 57],
  blue: [178, 177, 193, 192],
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
  | 'yard'
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

function buildCellLookup(): Map<string, BoardCellModel> {
  const map = new Map<string, BoardCellModel>();

  for (let trackIndex = 0; trackIndex < TRACK_GRID.length; trackIndex++) {
    const coord = TRACK_GRID[trackIndex]!;
    const kind: CellKind = SAFE_TRACK_INDICES.has(trackIndex) ? 'track-safe' : 'track';
    map.set(coordKey(coord), { kind, trackIndex });
  }

  for (const color of PLAYER_COLORS) {
    for (let homeIndex = 0; homeIndex < HOME_GRID[color].length; homeIndex++) {
      map.set(coordKey(HOME_GRID[color][homeIndex]!), { kind: 'home', color, homeIndex });
    }
    for (const coord of yardCellsFor(color)) {
      map.set(coordKey(coord), { kind: 'yard', color });
    }
  }

  for (const coord of CENTER_CELLS) {
    map.set(coordKey(coord), { kind: 'center', color: centerColorFor(coord) });
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

const CENTER_CELLS: readonly GridCoord[] = [
  { row: 7, col: 6 },
  { row: 7, col: 7 },
  { row: 7, col: 8 },
  { row: 6, col: 7 },
  { row: 8, col: 7 },
];

function centerColorFor({ row, col }: GridCoord): PlayerColor | undefined {
  if (row === 7 && col === 6) return 'red';
  if (row === 6 && col === 7) return 'green';
  if (row === 7 && col === 8) return 'yellow';
  if (row === 8 && col === 7) return 'blue';
  return undefined;
}

export const CELL_LOOKUP = buildCellLookup();

export function getCellModel(row: number, col: number): BoardCellModel {
  return CELL_LOOKUP.get(coordKey({ row, col })) ?? { kind: 'empty' };
}

export function positionToCoord(
  color: PlayerColor,
  pieceIndex: number,
  position: PiecePosition,
): GridCoord | null {
  switch (position.zone) {
    case 'yard':
      return yardSlotCoord(color, pieceIndex);
    case 'track':
      return TRACK_GRID[position.index] ?? null;
    case 'home':
      return HOME_GRID[color][position.index] ?? null;
  }
}

/** Yard slot for a piece index (2×2 within the 6×6 corner). */
export function yardSlotCoord(color: PlayerColor, pieceIndex: number): GridCoord {
  return YARD_GRID[color][pieceIndex] ?? YARD_GRID[color][0]!;
}

export function trackStartCoord(color: PlayerColor): GridCoord {
  return TRACK_GRID[START_TRACK_INDEX[color]]!;
}
