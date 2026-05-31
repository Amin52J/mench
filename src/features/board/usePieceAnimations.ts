import { pieceKey } from '@game/types';
import type { BoardState, PieceId, PieceIndex, PlayerColor } from '@game/types';
import { useCallback, useEffect, useRef, useState } from 'react';
import { usePrefersReducedMotion } from '@/shared/hooks';
import { CAPTURE_DRAG_MS, CAPTURE_FLASH_MS, PIECE_STEP_MS } from './pieceMotion.ts';
import { buildPieceCoordPath, positionsEqual } from './piecePath.ts';
import type { GridCoord, PieceCoord } from './boardLayout.ts';

export type PieceMotionStyle = 'step' | 'capture-drag';

export interface PieceVisual {
  readonly id: PieceId;
  readonly color: PlayerColor;
  readonly index: PieceIndex;
  readonly coord: PieceCoord;
  readonly stackIndex: number;
  readonly motion?: PieceMotionStyle;
}

export interface UsePieceAnimationsOptions {
  /** When false, skips diffing and reports `isAnimating: false` (parent drives visuals). */
  readonly enabled?: boolean;
  /** Bumps when a new local session starts so piece coords do not leak across games. */
  readonly resetKey?: number;
}

export interface UsePieceAnimationsResult {
  readonly pieces: readonly PieceVisual[];
  readonly captureFlash: GridCoord | null;
  readonly isAnimating: boolean;
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
  coord: PieceCoord,
  id: PieceId,
  coordsByPiece: ReadonlyMap<string, PieceCoord>,
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
  board: BoardState | null,
  players: readonly PlayerColor[],
  options: UsePieceAnimationsOptions = {},
): UsePieceAnimationsResult {
  const enabled = options.enabled !== false && board !== null;
  const resetKey = options.resetKey ?? 0;
  const reducedMotion = usePrefersReducedMotion();
  const prevBoardRef = useRef<BoardState | null>(null);
  const [visualCoords, setVisualCoords] = useState<ReadonlyMap<string, PieceCoord>>(() => new Map());
  const [captureFlash, setCaptureFlash] = useState<GridCoord | null>(null);
  const [captureDragKeys, setCaptureDragKeys] = useState<ReadonlySet<string>>(() => new Set());
  const [isAnimating, setIsAnimating] = useState(false);
  const runIdRef = useRef(0);

  useEffect(() => {
    prevBoardRef.current = null;
    setVisualCoords(new Map());
    setCaptureFlash(null);
    setCaptureDragKeys(new Set());
    setIsAnimating(false);
    runIdRef.current += 1;
  }, [resetKey]);

  const syncStaticCoords = useCallback((targetBoard: BoardState) => {
    const next = new Map<string, PieceCoord>();
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
    if (!enabled || board === null) {
      prevBoardRef.current = null;
      setIsAnimating(false);
      setCaptureFlash(null);
      setCaptureDragKeys(new Set());
      return;
    }

    const prev = prevBoardRef.current;
    prevBoardRef.current = board;

    if (prev === null) {
      setIsAnimating(false);
      syncStaticCoords(board);
      return;
    }

    const runId = ++runIdRef.current;
    const prevIds = collectPieceIds(prev, players);
    const animations: {
      id: PieceId;
      path: PieceCoord[];
      captureFlashAt: GridCoord | null;
      mode: 'step' | 'drag';
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
        isCaptureReturn && path[0] !== undefined
          ? ({ row: Math.floor(path[0].row), col: Math.floor(path[0].col) } satisfies GridCoord)
          : null;
      animations.push({
        id,
        path,
        captureFlashAt,
        mode: isCaptureReturn ? 'drag' : 'step',
      });
    }

    if (animations.length === 0) {
      setIsAnimating(false);
      syncStaticCoords(board);
      return;
    }

    if (reducedMotion) {
      setIsAnimating(false);
      syncStaticCoords(board);
      return;
    }

    setIsAnimating(true);

    const startCoords = new Map<string, PieceCoord>();
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

    /** Let React commit coords before the CSS step transition runs. */
    const waitForPaint = (): Promise<void> =>
      new Promise((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => resolve());
        });
      });

    const runStepAnimations = async (stepAnims: typeof animations): Promise<void> => {
      const maxLen = Math.max(...stepAnims.map((a) => a.path.length), 1);
      for (let step = 1; step < maxLen; step += 1) {
        if (runId !== runIdRef.current) return;

        setVisualCoords((current) => {
          const next = new Map(current);
          for (const anim of stepAnims) {
            const coord =
              anim.path[step] ?? anim.path[Math.min(step, anim.path.length - 1)];
            if (coord !== undefined) {
              next.set(pieceKey(anim.id), coord);
            }
          }
          return next;
        });

        await waitForPaint();
        await sleep(PIECE_STEP_MS);
      }
    };

    const runDragAnimations = async (dragAnims: typeof animations): Promise<void> => {
      if (dragAnims.length === 0) return;

      const dragKeys = new Set(dragAnims.map((a) => pieceKey(a.id)));
      setCaptureDragKeys(dragKeys);

      setVisualCoords((current) => {
        const next = new Map(current);
        for (const anim of dragAnims) {
          const end = anim.path.at(-1);
          if (end !== undefined) {
            next.set(pieceKey(anim.id), end);
          }
        }
        return next;
      });

      await waitForPaint();
      await sleep(CAPTURE_DRAG_MS);

      if (runId !== runIdRef.current) return;
      setCaptureDragKeys(new Set());
    };

    void (async () => {
      const flash = animations.find((a) => a.captureFlashAt !== null)?.captureFlashAt ?? null;
      if (flash !== null && !reducedMotion) {
        setCaptureFlash(flash);
        await sleep(CAPTURE_FLASH_MS);
        if (runId !== runIdRef.current) return;
        setCaptureFlash(null);
      }

      const stepAnims = animations.filter((a) => a.mode === 'step');
      const dragAnims = animations.filter((a) => a.mode === 'drag');

      await Promise.all([runStepAnimations(stepAnims), runDragAnimations(dragAnims)]);

      if (runId !== runIdRef.current) return;
      setCaptureDragKeys(new Set());
      syncStaticCoords(board);
      setIsAnimating(false);
    })();
  }, [board, players, reducedMotion, syncStaticCoords, enabled]);

  const pieces: PieceVisual[] = [];
  const coordMap = visualCoords;
  if (!enabled || board === null) {
    return { pieces, captureFlash, isAnimating: false };
  }

  for (const id of collectPieceIds(board, players)) {
    const coord = coordMap.get(pieceKey(id));
    if (coord === undefined) continue;
    const key = pieceKey(id);
    pieces.push({
      id,
      color: id.color,
      index: id.index,
      coord,
      stackIndex: Math.max(0, stackIndexFor(coord, id, coordMap)),
      motion: captureDragKeys.has(key) ? 'capture-drag' : undefined,
    });
  }

  return { pieces, captureFlash, isAnimating };
}
