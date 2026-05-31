import { pieceKey } from '@game/types';
import type { BoardState, PieceId, PlayerColor } from '@game/types';
import { PLAYER_COLORS } from '@game/types';
import { GRID_SIZE, getCellModel } from './boardLayout.ts';
import { usePieceAnimations } from './usePieceAnimations.ts';
import styles from './BoardView.module.css';

export interface BoardViewProps {
  readonly board: BoardState;
  readonly activeColor?: PlayerColor;
  readonly players?: readonly PlayerColor[];
  readonly legalPieceKeys?: ReadonlySet<string>;
  readonly shakePieceKey?: string | null;
  readonly interactive?: boolean;
  readonly onPieceSelect?: (piece: PieceId) => void;
}

export function BoardView({
  board,
  activeColor,
  players = PLAYER_COLORS,
  legalPieceKeys,
  shakePieceKey = null,
  interactive = false,
  onPieceSelect,
}: BoardViewProps) {
  const { pieces, captureFlash } = usePieceAnimations(board, players);
  const canSelect = interactive && onPieceSelect !== undefined;

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
        <div
          className={styles.pieceLayer}
          data-interactive={canSelect ? 'true' : 'false'}
          aria-hidden={canSelect ? undefined : true}
        >
          {pieces.map((piece) => {
            const key = pieceKey(piece.id);
            const isLegal = legalPieceKeys?.has(key) ?? false;
            const isShaking = shakePieceKey === key;
            const commonProps = {
              className: styles.piece,
              'data-color': piece.color,
              'data-stack': piece.stackIndex,
              'data-legal': isLegal ? 'true' : 'false',
              'data-shake': isShaking ? 'true' : 'false',
              style: pieceStyle(piece.coord),
              title: `${piece.color} piece ${piece.index + 1}`,
            };

            if (canSelect) {
              return (
                <button
                  key={key}
                  type="button"
                  className={commonProps.className}
                  data-color={commonProps['data-color']}
                  data-stack={commonProps['data-stack']}
                  data-legal={commonProps['data-legal']}
                  data-shake={commonProps['data-shake']}
                  style={commonProps.style}
                  title={commonProps.title}
                  aria-label={`${piece.color} piece ${piece.index + 1}${isLegal ? ', legal move' : ''}`}
                  onClick={() => onPieceSelect(piece.id)}
                />
              );
            }

            return <span key={key} {...commonProps} />;
          })}
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
