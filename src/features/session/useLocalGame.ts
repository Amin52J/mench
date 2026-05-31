import {
  activeColor,
  activeSeatKind,
  getLegalMoves,
  IllegalIntentError,
  isGameOver,
  type DieValue,
  type GameState,
  type LegalMove,
} from '@game/rules';
import { chooseMove, pickCpuThinkDelayMs } from '@game/ai';
import { turnTimerApplies, type PlayerKind } from '@game/types';
import { pieceKey, type PieceId } from '@game/types';
import { usePieceAnimations } from '@/features/board/usePieceAnimations.ts';
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { localGameReducer, randomDie } from './localGameReducer.ts';
import { devAllowAllCpuStart } from './devFlags.ts';
import {
  defaultSetup,
  normalizeSetup,
  playersForCount,
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
  readonly showTurnTimer: boolean;
  readonly timerSeconds: number;
  readonly timerProgress: number;
  readonly isPieceAnimating: boolean;
  readonly pieceVisuals: ReturnType<typeof usePieceAnimations>['pieces'];
  readonly captureFlash: ReturnType<typeof usePieceAnimations>['captureFlash'];
  readonly feedback: LocalGameFeedback;
  readonly roll: (die?: DieValue) => void;
  readonly move: (piece: PieceId) => void;
  readonly tryMove: (piece: PieceId) => void;
  readonly sessionKey: number;
  readonly showWinOverlay: boolean;
  readonly continueForPlacements: () => void;
}

const FEEDBACK_MS = 1400;

export function useLocalGame(): UseLocalGameResult {
  const [screen, setScreen] = useState<LocalScreen>('setup');
  const [setup, setSetup] = useState<GameSetup>(() => defaultSetup(4));
  const [game, dispatch] = useReducer(localGameReducer, null);
  const [sessionKey, setSessionKey] = useState(0);
  const [hideWinOverlay, setHideWinOverlay] = useState(false);
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
    setSessionKey((key) => key + 1);
    setHideWinOverlay(false);
    setScreen('play');
    setShakePieceKey(null);
    setToast(null);
  }, [setup]);

  const restartGame = useCallback(() => {
    const normalized = normalizeSetup(setup);
    dispatch({ type: 'restart', setup: normalized });
    setSessionKey((key) => key + 1);
    setHideWinOverlay(false);
    setShakePieceKey(null);
    setToast(null);
  }, [setup]);

  const backToSetup = useCallback(() => {
    setScreen('setup');
    dispatch({ type: 'reset' });
    setSessionKey((key) => key + 1);
    setHideWinOverlay(false);
    setShakePieceKey(null);
    setToast(null);
  }, []);

  const continueForPlacements = useCallback(() => {
    setHideWinOverlay(true);
  }, []);

  const boardPlayers = useMemo(
    () => (game === null ? [] : [...playersForCount(setup.playerCount)]),
    [game, setup.playerCount],
  );

  const {
    pieces: pieceVisuals,
    captureFlash,
    isAnimating: isPieceAnimating,
  } = usePieceAnimations(game?.board ?? null, boardPlayers, { resetKey: sessionKey });

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
    game !== null &&
    !isGameOver(game) &&
    currentActiveSeatKind === 'human';

  const showTurnTimer = isHumanTurn && turnTimerApplies(seatKinds);

  const canRoll = isHumanTurn && game.phase === 'roll';

  const autoPlayOnTimeout = useCallback(() => {
    dispatch({ type: 'auto_play' });
  }, []);

  const { secondsLeft: timerSeconds, progress: timerProgress } = useTurnTimer({
    enabled: showTurnTimer,
    turnKey: activePlayerIndex,
    onExpire: autoPlayOnTimeout,
  });

  const roll = useCallback(
    (die?: DieValue) => {
      if (!canRoll || game === null) return;
      const value = die ?? randomDie();
      try {
        dispatch({ type: 'roll', die: value });
      } catch (error) {
        if (error instanceof IllegalIntentError) {
          showFeedback({ toast: 'Cannot roll now' });
        }
      }
    },
    [canRoll, game, showFeedback],
  );

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
    if (screen !== 'play' || game === null || isGameOver(game)) {
      return;
    }
    if (isPieceAnimating) {
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
  }, [currentActiveSeatKind, game, screen, isPieceAnimating]);

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
    showTurnTimer,
    timerSeconds,
    timerProgress,
    isPieceAnimating,
    pieceVisuals,
    captureFlash,
    feedback: { shakePieceKey, toast },
    roll,
    move,
    tryMove,
    sessionKey,
    showWinOverlay: game !== null && game.winner !== null && !hideWinOverlay,
    continueForPlacements,
  };
}
