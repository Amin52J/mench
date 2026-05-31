import { pieceKey } from '@game/types';
import type { BoardState, PieceId, PlayerColor } from '@game/types';
import { PLAYER_COLORS } from '@game/types';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { CENTER_TRIANGLES, GRID_SIZE, getCellModel, type GridCoord } from './boardLayout.ts';
import {
  computeStackLayouts,
  groupPiecesByCell,
  pickLegalPieceInCell,
} from './pieceStackLayout.ts';
import { usePieceAnimations, type PieceVisual } from './usePieceAnimations.ts';
import styles from './BoardView.module.css';

export interface BoardViewProps {
  readonly board: BoardState;
  readonly activeColor?: PlayerColor;
  readonly players?: readonly PlayerColor[];
  readonly legalPieceKeys?: ReadonlySet<string>;
  readonly shakePieceKey?: string | null;
  readonly interactive?: boolean;
  readonly onPieceSelect?: (piece: PieceId) => void;
  /** When set, the parent runs `usePieceAnimations` (e.g. to gate CPU turns). */
  readonly pieceVisuals?: readonly PieceVisual[];
  readonly captureFlash?: GridCoord | null;
}

export function BoardView({
  board,
  activeColor,
  players = PLAYER_COLORS,
  legalPieceKeys,
  shakePieceKey = null,
  interactive = false,
  onPieceSelect,
  pieceVisuals: pieceVisualsProp,
  captureFlash: captureFlashProp,
}: BoardViewProps) {
  const internalAnim = usePieceAnimations(board, players, {
    enabled: pieceVisualsProp === undefined,
  });
  const pieces = pieceVisualsProp ?? internalAnim.pieces;
  const captureFlash = captureFlashProp ?? internalAnim.captureFlash;
  const canSelect = interactive && onPieceSelect !== undefined;

  const stackLayouts = useMemo(() => computeStackLayouts(pieces), [pieces]);
  const piecesByCell = useMemo(() => groupPiecesByCell(pieces), [pieces]);
  const stackCycleRef = useRef<Record<string, number>>({});

  useEffect(() => {
    stackCycleRef.current = {};
  }, [legalPieceKeys]);

  const handleStackCellPress = useCallback(
    (coord: GridCoord, piecesInCell: readonly PieceVisual[]) => {
      if (!canSelect || onPieceSelect === undefined) return;
      const cellKey = `${coord.row},${coord.col}`;
      const cycle = stackCycleRef.current[cellKey] ?? 0;
      const picked = pickLegalPieceInCell(piecesInCell, legalPieceKeys ?? new Set(), cycle);
      if (picked === null) return;
      stackCycleRef.current[cellKey] = cycle + 1;
      onPieceSelect(picked);
    },
    [canSelect, legalPieceKeys, onPieceSelect],
  );

  const stackHitTargets = useMemo(() => {
    if (!canSelect || legalPieceKeys === undefined || legalPieceKeys.size === 0) {
      return [];
    }
    const targets: { readonly coord: GridCoord; readonly pieces: readonly PieceVisual[] }[] = [];
    for (const [cellKey, cellPieces] of piecesByCell) {
      const hasLegal = cellPieces.some((p) => legalPieceKeys.has(pieceKey(p.id)));
      if (!hasLegal) continue;
      const [row, col] = cellKey.split(',').map(Number);
      targets.push({ coord: { row: row!, col: col! }, pieces: cellPieces });
    }
    return targets;
  }, [canSelect, legalPieceKeys, piecesByCell]);

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
          <div className={styles.centerHub} aria-hidden>
            {CENTER_TRIANGLES.map(({ color, side }) => (
              <div
                key={side}
                className={`${styles.centerTriangle} ${styles[`centerTriangle-${side}`]} ${styles[`tint-${color}`]}`}
              />
            ))}
          </div>
          {stackHitTargets.map(({ coord, pieces: cellPieces }) => {
            const legalCount = cellPieces.filter((p) =>
              legalPieceKeys?.has(pieceKey(p.id)),
            ).length;
            return (
              <button
                key={`stack-${coord.row}-${coord.col}`}
                type="button"
                className={styles.stackHitTarget}
                style={cellHitStyle(coord)}
                aria-label={`Move stacked piece (${legalCount} available)`}
                onClick={() => handleStackCellPress(coord, cellPieces)}
              />
            );
          })}
          {pieces.map((piece) => {
            const key = pieceKey(piece.id);
            const layout = stackLayouts.get(key);
            const isLegal = legalPieceKeys?.has(key) ?? false;
            const isShaking = shakePieceKey === key;
            const stackCount = layout?.stackCount ?? 1;
            return (
              <span
                key={key}
                className={styles.piece}
                data-color={piece.color}
                data-stack-count={stackCount}
                data-motion={piece.motion ?? 'step'}
                data-legal={isLegal ? 'true' : 'false'}
                data-shake={isShaking ? 'true' : 'false'}
                style={pieceStyle(piece.coord, layout)}
                title={`${piece.color} piece ${piece.index + 1}`}
                aria-hidden
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

function pieceStyle(
  coord: { readonly row: number; readonly col: number },
  layout?: { readonly scale: number; readonly offsetX: number; readonly offsetY: number },
): { left: string; top: string; ['--piece-scale']: string } {
  const cell = 100 / GRID_SIZE;
  const offsetX = layout?.offsetX ?? 0;
  const offsetY = layout?.offsetY ?? 0;
  const centerCol = Number.isInteger(coord.col) ? coord.col + 0.5 : coord.col;
  const centerRow = Number.isInteger(coord.row) ? coord.row + 0.5 : coord.row;
  return {
    left: `${(centerCol + offsetX) * cell}%`,
    top: `${(centerRow + offsetY) * cell}%`,
    '--piece-scale': String(layout?.scale ?? 0.88),
  };
}

function cellHitStyle(coord: { readonly row: number; readonly col: number }): {
  left: string;
  top: string;
  width: string;
  height: string;
} {
  const cell = 100 / GRID_SIZE;
  const row = Math.floor(coord.row);
  const col = Math.floor(coord.col);
  return {
    left: `${col * cell}%`,
    top: `${row * cell}%`,
    width: `${cell}%`,
    height: `${cell}%`,
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
