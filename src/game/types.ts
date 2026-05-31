/** Player seat colors in clockwise board order (Red → Green → Yellow → Blue). */
export type PlayerColor = 'blue' | 'red' | 'green' | 'yellow';

/** Clockwise turn order for a full four-player game (`product.mdc`). */
export const PLAYER_COLORS = [
  'blue',
  'red',
  'green',
  'yellow',
] as const satisfies readonly PlayerColor[];

/** Whether a seat is controlled by a human or the CPU (`product.mdc` O12). */
export type PlayerKind = 'human' | 'cpu';

export type PieceIndex = 0 | 1 | 2 | 3;

/** One of four tokens for a seat. */
export interface PieceId {
  readonly color: PlayerColor;
  readonly index: PieceIndex;
}

export function pieceKey(id: PieceId): string {
  return `${id.color}-${id.index}`;
}

/** Yard (off board), shared track cell, or color home column cell. */
export type PiecePosition =
  | { readonly zone: 'yard' }
  | { readonly zone: 'track'; readonly index: number }
  | { readonly zone: 'home'; readonly index: number };

/** Static piece placements (turn/dice live in rules layer later). */
export interface BoardState {
  readonly positions: Readonly<Record<string, PiecePosition>>;
}

export function createPieceId(color: PlayerColor, index: PieceIndex): PieceId {
  return { color, index };
}

export function createInitialBoardState(colors: readonly PlayerColor[]): BoardState {
  const positions: Record<string, PiecePosition> = {};
  for (const color of colors) {
    for (let index = 0; index < 4; index++) {
      positions[pieceKey(createPieceId(color, index as PieceIndex))] = { zone: 'yard' };
    }
  }
  return { positions };
}
