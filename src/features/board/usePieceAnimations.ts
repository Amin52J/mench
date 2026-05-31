import { pieceKey } from '@game/types';
import type { BoardState, PieceId, PieceIndex, PlayerColor } from '@game/types';
import { useCallback, useEffect, useRef, useState } from 'react';
import { usePrefersReducedMotion } from '@/shared/hooks';
import { buildPieceCoordPath, positionsEqual } from './piecePath.ts';
import type { GridCoord } from './boardLayout.ts';

const STEP_MS = 90;
const CAPTURE_FLASH_MS = 420;
const CAPTURE_RETURN_MS = 380;

export interface PieceVisual {
  readonly id: PieceId;
  readonly color: PlayerColor;
  readonly index: PieceIndex;
  readonly coord: GridCoord;
  readonly stackIndex: number;
}

export interface UsePieceAnimationsResult {
  readonly pieces: readonly PieceVisual[];
  readonly captureFlash: GridCoord | null;
}

function collectPieceIds(board: BoardState, players: readonly PlayerColor[]): PieceId[] {
  const ids: PieceId[] = [];
  for (const color of players) {
    for (let index = 0; index < 4; index++) {
      const key = pieceKey({ color, index: index as PieceIndex });
      if (board.positions[key] !== undefined) {
        ids.push({ color, index: index as PieceIndex });
      }
    }
  }
  return ids;
}

function stackIndexFor(
  coord: GridCoord,
  id: PieceId,
  coordsByPiece: ReadonlyMap<string, GridCoord>,
): number {
  const key = `${coord.row},${coord.col}`;
  const sameCell: string[] = [];
  for (const [pieceKeyStr, c] of coordsByPiece) {
    if (`${c.row},${c.col}` === key) {
      sameCell.push(pieceKeyStr);
    }
  }
  sameCell.sort();
  return sameCell.indexOf(pieceKey(id));
}

export function usePieceAnimations(
  board: BoardState,
  players: readonly PlayerColor[],
): UsePieceAnimationsResult {
  const reducedMotion = usePrefersReducedMotion();
  const prevBoardRef = useRef<BoardState | null>(null);
  const [visualCoords, setVisualCoords] = useState<ReadonlyMap<string, GridCoord>>(() => new Map());
  const [captureFlash, setCaptureFlash] = useState<GridCoord | null>(null);
  const runIdRef = useRef(0);

  const syncStaticCoords = useCallback((targetBoard: BoardState) => {
    const next = new Map<string, GridCoord>();
    for (const id of collectPieceIds(targetBoard, players)) {
      const pos = targetBoard.positions[pieceKey(id)];
      if (pos === undefined) continue;
      const path = buildPieceCoordPath(id.color, id.index, pos, pos);
      const coord = path[0];
      if (coord !== undefined) {
        next.set(pieceKey(id), coord);
      }
    }
    setVisualCoords(next);
  }, [players]);

  useEffect(() => {
    const prev = prevBoardRef.current;
    prevBoardRef.current = board;

    if (prev === null) {
      syncStaticCoords(board);
      return;
    }

    const runId = ++runIdRef.current;
    const prevIds = collectPieceIds(prev, players);
    const animations: {
      id: PieceId;
      path: GridCoord[];
      captureFlashAt: GridCoord | null;
      isCaptureReturn: boolean;
    }[] = [];

    for (const id of prevIds) {
      const key = pieceKey(id);
      const fromPos = prev.positions[key];
      const toPos = board.positions[key];
      if (fromPos === undefined || toPos === undefined) continue;
      if (positionsEqual(fromPos, toPos)) continue;

      const path = buildPieceCoordPath(id.color, id.index, fromPos, toPos);
      const isCaptureReturn = fromPos.zone === 'track' && toPos.zone === 'yard';
      const captureFlashAt =
        isCaptureReturn && path[0] !== undefined ? path[0] : null;
      animations.push({ id, path, captureFlashAt, isCaptureReturn });
    }

    if (animations.length === 0) {
      syncStaticCoords(board);
      return;
    }

    if (reducedMotion) {
      syncStaticCoords(board);
      return;
    }

    const startCoords = new Map<string, GridCoord>();
    for (const id of collectPieceIds(board, players)) {
      const pos = board.positions[pieceKey(id)];
      if (pos === undefined) continue;
      const staticPath = buildPieceCoordPath(id.color, id.index, pos, pos);
      const coord = staticPath[0];
      if (coord !== undefined) {
        startCoords.set(pieceKey(id), coord);
      }
    }

    for (const anim of animations) {
      const first = anim.path[0];
      if (first !== undefined) {
        startCoords.set(pieceKey(anim.id), first);
      }
    }
    setVisualCoords(startCoords);

    const sleep = (ms: number): Promise<void> =>
      new Promise((resolve) => {
        globalThis.setTimeout(resolve, ms);
      });

    void (async () => {
      const flash = animations.find((a) => a.captureFlashAt !== null)?.captureFlashAt ?? null;
      if (flash !== null && !reducedMotion) {
        setCaptureFlash(flash);
        await sleep(CAPTURE_FLASH_MS);
        if (runId !== runIdRef.current) return;
        setCaptureFlash(null);
      }

      const maxLen = Math.max(...animations.map((a) => a.path.length), 1);
      for (let step = 1; step < maxLen; step += 1) {
        if (runId !== runIdRef.current) return;

        setVisualCoords((current) => {
          const next = new Map(current);
          for (const anim of animations) {
            const coord = anim.path[Math.min(step, anim.path.length - 1)];
            if (coord !== undefined) {
              next.set(pieceKey(anim.id), coord);
            }
          }
          return next;
        });

        const stepDuration = reducedMotion
          ? 0
          : animations.some((a) => a.isCaptureReturn)
            ? CAPTURE_RETURN_MS
            : STEP_MS;
        if (stepDuration > 0) {
          await sleep(stepDuration);
        }
      }

      if (runId !== runIdRef.current) return;
      syncStaticCoords(board);
    })();
  }, [board, players, reducedMotion, syncStaticCoords]);

  const pieces: PieceVisual[] = [];
  const coordMap = visualCoords;
  for (const id of collectPieceIds(board, players)) {
    const coord = coordMap.get(pieceKey(id));
    if (coord === undefined) continue;
    pieces.push({
      id,
      color: id.color,
      index: id.index,
      coord,
      stackIndex: Math.max(0, stackIndexFor(coord, id, coordMap)),
    });
  }

  return { pieces, captureFlash };
}
