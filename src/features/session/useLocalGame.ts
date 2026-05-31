import {
  activeColor,
  activeSeatKind,
  getLegalMoves,
  IllegalIntentError,
  type GameState,
  type LegalMove,
} from '@game/rules';
import { chooseMove, pickCpuThinkDelayMs } from '@game/ai';
import type { PlayerKind } from '@game/types';
import { pieceKey, type PieceId } from '@game/types';
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { localGameReducer, randomDie } from './localGameReducer.ts';
import { devAllowAllCpuStart } from './devFlags.ts';
import {
  defaultSetup,
  normalizeSetup,
  type GameSetup,
  type SeatConfig,
} from './types.ts';
import { useTurnTimer } from './useTurnTimer.ts';

export type LocalScreen = 'setup' | 'play';

export interface LocalGameFeedback {
  readonly shakePieceKey: string | null;
  readonly toast: string | null;
}

export interface UseLocalGameResult {
  readonly screen: LocalScreen;
  readonly setup: GameSetup;
  readonly setPlayerCount: (count: GameSetup['playerCount']) => void;
  readonly setSeatKind: (seatIndex: number, kind: SeatConfig['kind']) => void;
  readonly applySetup: (setup: GameSetup) => void;
  readonly startGame: () => void;
  readonly restartGame: () => void;
  readonly backToSetup: () => void;
  readonly game: GameState | null;
  readonly seatKinds: readonly PlayerKind[];
  readonly activeColor: ReturnType<typeof activeColor> | null;
  readonly activeSeatKind: PlayerKind | null;
  readonly legalMoves: readonly LegalMove[];
  readonly legalPieceKeys: ReadonlySet<string>;
  readonly canRoll: boolean;
  readonly isHumanTurn: boolean;
  readonly timerSeconds: number;
  readonly timerProgress: number;
  readonly feedback: LocalGameFeedback;
  readonly roll: () => void;
  readonly move: (piece: PieceId) => void;
  readonly tryMove: (piece: PieceId) => void;
}

const FEEDBACK_MS = 1400;

export function useLocalGame(): UseLocalGameResult {
  const [screen, setScreen] = useState<LocalScreen>('setup');
  const [setup, setSetup] = useState<GameSetup>(() => defaultSetup(4));
  const [game, dispatch] = useReducer(localGameReducer, null);
  const [shakePieceKey, setShakePieceKey] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const feedbackTimerRef = useRef<ReturnType<typeof globalThis.setTimeout> | null>(null);

  const clearFeedbackTimer = useCallback(() => {
    if (feedbackTimerRef.current !== null) {
      globalThis.clearTimeout(feedbackTimerRef.current);
      feedbackTimerRef.current = null;
    }
  }, []);

  const showFeedback = useCallback(
    (next: { shakePieceKey?: string | null; toast?: string | null }) => {
      clearFeedbackTimer();
      if (next.shakePieceKey !== undefined) {
        setShakePieceKey(next.shakePieceKey);
      }
      if (next.toast !== undefined) {
        setToast(next.toast);
      }
      feedbackTimerRef.current = globalThis.setTimeout(() => {
        setShakePieceKey(null);
        setToast(null);
        feedbackTimerRef.current = null;
      }, FEEDBACK_MS);
    },
    [clearFeedbackTimer],
  );

  useEffect(() => () => clearFeedbackTimer(), [clearFeedbackTimer]);

  const setPlayerCount = useCallback((playerCount: GameSetup['playerCount']) => {
    setSetup((current) => normalizeSetup({ ...current, playerCount }));
  }, []);

  const setSeatKind = useCallback((seatIndex: number, kind: SeatConfig['kind']) => {
    setSetup((current) => ({
      ...current,
      seats: current.seats.map((seat, index) => (index === seatIndex ? { kind } : seat)),
    }));
  }, []);

  const applySetup = useCallback((next: GameSetup) => {
    setSetup(normalizeSetup(next));
  }, []);

  const startGame = useCallback(() => {
    const normalized = normalizeSetup(setup);
    const hasHuman = normalized.seats.some((seat) => seat.kind === 'human');
    if (!hasHuman && !devAllowAllCpuStart()) {
      return;
    }
    setSetup(normalized);
    dispatch({ type: 'start', setup: normalized });
    setScreen('play');
    setShakePieceKey(null);
    setToast(null);
  }, [setup]);

  const restartGame = useCallback(() => {
    const normalized = normalizeSetup(setup);
    dispatch({ type: 'restart', setup: normalized });
    setShakePieceKey(null);
    setToast(null);
  }, [setup]);

  const backToSetup = useCallback(() => {
    setScreen('setup');
    dispatch({ type: 'reset' });
    setShakePieceKey(null);
    setToast(null);
  }, []);

  const activePlayerIndex = game?.activePlayerIndex ?? 0;
  const seatKinds =
    game === null
      ? normalizeSetup(setup).seats.map((seat) => seat.kind)
      : game.seatKinds;
  const currentActiveSeatKind = game === null ? null : activeSeatKind(game);
  const active = game === null ? null : activeColor(game);

  const legalMoves = useMemo(
    () => (game?.phase === 'move' ? getLegalMoves(game) : []),
    [game],
  );

  const legalPieceKeys = useMemo(
    () => new Set(legalMoves.map((move) => pieceKey(move.piece))),
    [legalMoves],
  );

  const isHumanTurn =
    game !== null && game.winner === null && currentActiveSeatKind === 'human';

  const canRoll = isHumanTurn && game.phase === 'roll';

  const forfeit = useCallback(() => {
    dispatch({ type: 'forfeit' });
  }, []);

  const { secondsLeft: timerSeconds, progress: timerProgress } = useTurnTimer({
    enabled: isHumanTurn,
    turnKey: activePlayerIndex,
    onExpire: forfeit,
  });

  const roll = useCallback(() => {
    if (!canRoll || game === null) return;
    try {
      dispatch({ type: 'roll', die: randomDie() });
    } catch (error) {
      if (error instanceof IllegalIntentError) {
        showFeedback({ toast: 'Cannot roll now' });
      }
    }
  }, [canRoll, game, showFeedback]);

  const move = useCallback(
    (piece: PieceId) => {
      if (!isHumanTurn || game === null || game.phase !== 'move') return;
      try {
        dispatch({ type: 'move', piece });
      } catch (error) {
        if (error instanceof IllegalIntentError) {
          showFeedback({
            shakePieceKey: pieceKey(piece),
            toast: 'That piece cannot move',
          });
        }
      }
    },
    [game, isHumanTurn, showFeedback],
  );

  const tryMove = useCallback(
    (piece: PieceId) => {
      if (!isHumanTurn || game === null) {
        showFeedback({ shakePieceKey: pieceKey(piece), toast: 'Not your turn' });
        return;
      }
      if (game.phase !== 'move') {
        showFeedback({ toast: 'Roll the die first' });
        return;
      }
      if (!legalPieceKeys.has(pieceKey(piece))) {
        showFeedback({
          shakePieceKey: pieceKey(piece),
          toast: 'That piece cannot move',
        });
        return;
      }
      move(piece);
    },
    [game, isHumanTurn, legalPieceKeys, move, showFeedback],
  );

  useEffect(() => {
    if (screen !== 'play' || game === null || game.winner !== null) {
      return;
    }
    if (currentActiveSeatKind !== 'cpu') {
      return;
    }

    const snapshot = game;
    const delayMs = pickCpuThinkDelayMs();
    const timer = globalThis.setTimeout(() => {
      if (snapshot.phase === 'roll') {
        dispatch({ type: 'roll', die: randomDie() });
        return;
      }
      if (snapshot.phase === 'move') {
        const pick = chooseMove(snapshot);
        if (pick !== null) {
          dispatch({ type: 'move', piece: pick.piece });
        } else {
          dispatch({ type: 'forfeit' });
        }
      }
    }, delayMs);

    return () => globalThis.clearTimeout(timer);
  }, [currentActiveSeatKind, game, screen]);

  return {
    screen,
    setup,
    setPlayerCount,
    setSeatKind,
    applySetup,
    startGame,
    restartGame,
    backToSetup,
    game,
    seatKinds,
    activeColor: active,
    activeSeatKind: currentActiveSeatKind,
    legalMoves,
    legalPieceKeys,
    canRoll,
    isHumanTurn,
    timerSeconds,
    timerProgress,
    feedback: { shakePieceKey, toast },
    roll,
    move,
    tryMove,
  };
}
