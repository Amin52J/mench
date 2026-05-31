import { pieceKey } from '@game/types';
import type { BoardState, PieceIndex, PlayerColor } from '@game/types';
import { PLAYER_COLORS } from '@game/types';
import {
  GRID_SIZE,
  getCellModel,
  positionToCoord,
  type GridCoord,
} from './boardLayout.ts';
import styles from './BoardView.module.css';

export interface BoardViewProps {
  readonly board: BoardState;
  readonly activeColor?: PlayerColor;
  readonly players?: readonly PlayerColor[];
}

interface PlacedPiece {
  readonly color: PlayerColor;
  readonly index: PieceIndex;
  readonly coord: GridCoord;
}

export function BoardView({
  board,
  activeColor,
  players = PLAYER_COLORS,
}: BoardViewProps) {
  const pieces = collectPieces(board, players);
  const piecesByCell = groupPiecesByCell(pieces);

  return (
    <div
      className={styles.boardWrap}
      data-active-color={activeColor}
      aria-label="Ludo board"
    >
      <div className={styles.board} role="grid" aria-rowcount={GRID_SIZE} aria-colcount={GRID_SIZE}>
        {Array.from({ length: GRID_SIZE }, (_, row) =>
          Array.from({ length: GRID_SIZE }, (_, col) => {
            const model = getCellModel(row, col);
            const key = `${row}-${col}`;
            const stack = piecesByCell.get(`${row},${col}`) ?? [];
            return (
              <div
                key={key}
                className={cellClassName(model)}
                data-kind={model.kind}
                data-color={model.color}
                role="gridcell"
              >
                {stack.map((piece) => (
                  <span
                    key={pieceKey({ color: piece.color, index: piece.index })}
                    className={styles.piece}
                    data-color={piece.color}
                    title={`${piece.color} piece ${piece.index + 1}`}
                  />
                ))}
              </div>
            );
          }),
        )}
      </div>
    </div>
  );
}

function collectPieces(board: BoardState, players: readonly PlayerColor[]): PlacedPiece[] {
  const result: PlacedPiece[] = [];
  for (const color of players) {
    for (let index = 0; index < 4; index++) {
      const key = pieceKey({ color, index: index as PieceIndex });
      const position = board.positions[key];
      if (position === undefined) continue;
      const coord = positionToCoord(color, index, position);
      if (coord === null) continue;
      result.push({ color, index: index as PieceIndex, coord });
    }
  }
  return result;
}

function groupPiecesByCell(pieces: readonly PlacedPiece[]): Map<string, PlacedPiece[]> {
  const map = new Map<string, PlacedPiece[]>();
  for (const piece of pieces) {
    const key = `${piece.coord.row},${piece.coord.col}`;
    const list = map.get(key);
    if (list === undefined) {
      map.set(key, [piece]);
    } else {
      list.push(piece);
    }
  }
  return map;
}

function cellClassName(model: ReturnType<typeof getCellModel>): string {
  const classes = [styles.cell];
  if (model.kind !== 'empty') {
    classes.push(styles[model.kind]);
  }
  if (model.color !== undefined) {
    classes.push(styles[`tint-${model.color}`]);
  }
  return classes.join(' ');
}
