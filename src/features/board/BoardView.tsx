import { pieceKey } from '@game/types';
import type { BoardState, PlayerColor } from '@game/types';
import { PLAYER_COLORS } from '@game/types';
import { GRID_SIZE, getCellModel } from './boardLayout.ts';
import { usePieceAnimations } from './usePieceAnimations.ts';
import styles from './BoardView.module.css';

export interface BoardViewProps {
  readonly board: BoardState;
  readonly activeColor?: PlayerColor;
  readonly players?: readonly PlayerColor[];
}

export function BoardView({
  board,
  activeColor,
  players = PLAYER_COLORS,
}: BoardViewProps) {
  const { pieces, captureFlash } = usePieceAnimations(board, players);

  return (
    <div
      className={styles.boardWrap}
      data-active-color={activeColor}
      data-turn-pulse={activeColor !== undefined ? 'true' : 'false'}
      aria-label="Ludo board"
    >
      <div
        className={styles.board}
        role="grid"
        aria-rowcount={GRID_SIZE}
        aria-colcount={GRID_SIZE}
      >
        {Array.from({ length: GRID_SIZE }, (_, row) =>
          Array.from({ length: GRID_SIZE }, (_, col) => {
            const model = getCellModel(row, col);
            const key = `${row}-${col}`;
            const isFlash =
              captureFlash !== null &&
              captureFlash.row === row &&
              captureFlash.col === col;
            return (
              <div
                key={key}
                className={cellClassName(model, isFlash)}
                data-kind={model.kind}
                data-color={model.color}
                data-capture-flash={isFlash ? 'true' : 'false'}
                role="gridcell"
              />
            );
          }),
        )}
        <div className={styles.pieceLayer} aria-hidden>
          {pieces.map((piece) => (
            <span
              key={pieceKey(piece.id)}
              className={styles.piece}
              data-color={piece.color}
              data-stack={piece.stackIndex}
              style={pieceStyle(piece.coord)}
              title={`${piece.color} piece ${piece.index + 1}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function pieceStyle(coord: {
  readonly row: number;
  readonly col: number;
}): { left: string; top: string } {
  const cell = 100 / GRID_SIZE;
  return {
    left: `${(coord.col + 0.5) * cell}%`,
    top: `${(coord.row + 0.5) * cell}%`,
  };
}

function cellClassName(
  model: ReturnType<typeof getCellModel>,
  isFlash: boolean,
): string {
  const classes = [styles.cell];
  if (model.kind !== 'empty') {
    classes.push(styles[model.kind]);
  }
  if (model.color !== undefined) {
    classes.push(styles[`tint-${model.color}`]);
  }
  if (isFlash) {
    classes.push(styles.captureFlash);
  }
  return classes.join(' ');
}
