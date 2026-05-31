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
import { turnTimerApplies, type PlayerColor, type PlayerKind } from '@game/types';
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

/**
 * Single, explicit turn state machine driving the dice/animation sequence.
 *
 *   idle              -> waiting for the active player to act
 *   revealing(die)    -> dice shows the rolled value; locked, no input
 *   moving(die)       -> piece animation is in flight; dice still shows die
 *
 * Transitions:
 *   idle      --ROLL_REQUESTED(die)-->  revealing(die)
 *   revealing --REVEAL_DONE-->          (dispatch reducer roll) idle | moving
 *   moving    --MOVE_DONE-->            idle
 *
 * Notes:
 *  - We only call the game reducer's `roll` AFTER the reveal window completes,
 *    so the rolled number is always visible for the full reveal duration even
 *    when there's no legal move (reducer auto-passes the turn).
 *  - The reducer transitions roll->move synchronously, so after dispatch we
 *    inspect the new state: if `phase === 'move'` we enter `moving`, otherwise
 *    (no legal move, third six, etc.) we return to `idle`.
 *  - `moving` is exited when the piece animation finishes — detected by
 *    `usePieceAnimations.isAnimating` transitioning true -> false (or by no
 *    animation being needed, in which case we exit on the next render).
 */
type TurnPhase =
  | { readonly kind: 'idle' }
  | { readonly kind: 'revealing'; readonly die: DieValue; readonly source: 'human' | 'cpu' }
  | { readonly kind: 'moving'; readonly die: DieValue };

/**
 * Reveal durations.
 *
 * When the roll yields at least one legal move, the value will continue to be
 * shown throughout the piece's move animation, so the explicit reveal window
 * only needs to cover the tumble. We use a single short value (500 ms) for
 * both human and CPU rolls in that case.
 *
 * When the roll has no legal move (or the reducer auto-forfeits — e.g. third
 * consecutive 6), the rolled number must be visible long enough for the
 * player to read it before the turn passes. Humans clicked the dice so they
 * already saw the tumble; CPUs need a longer beat.
 */
const SHORT_REVEAL_MS = 500;
const HUMAN_NO_MOVE_REVEAL_MS = 1500;
const CPU_NO_MOVE_REVEAL_MS = 2000;

/**
 * Predict whether dispatching `roll(die)` against `state` will end up in the
 * `move` phase with at least one legal move available. Mirrors the rollDice
 * logic in `rules.ts` (third-six forfeit + no-legal-move auto-pass).
 */
function rollWillHaveMoves(state: GameState, die: DieValue): boolean {
  if (die === 6 && state.consecutiveSixes === 2) return false;
  const tentative: GameState = { ...state, phase: 'move', dice: die };
  return getLegalMoves(tentative).length > 0;
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
  readonly activeColor: PlayerColor | null;
  readonly activeSeatKind: PlayerKind | null;
  readonly legalMoves: readonly LegalMove[];
  readonly legalPieceKeys: ReadonlySet<string>;
  readonly canRoll: boolean;
  readonly isHumanTurn: boolean;
  readonly showTurnTimer: boolean;
  readonly timerSeconds: number;
  readonly timerProgress: number;
  readonly isPieceAnimating: boolean;
  /**
   * Die value currently being revealed (UI gate) — non-null whenever the
   * dice face should show a value before/around the move. Drives the dice
   * face directly so no separate "hold" hook is needed.
   */
  readonly pendingRoll: DieValue | null;
  /** Dice face shown to the user (`null` => prompt `?`). */
  readonly diceFace: DieValue | null;
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

const IDLE: TurnPhase = { kind: 'idle' };

export function useLocalGame(): UseLocalGameResult {
  const [screen, setScreen] = useState<LocalScreen>('setup');
  const [setup, setSetup] = useState<GameSetup>(() => defaultSetup(4));
  const [game, dispatch] = useReducer(localGameReducer, null);
  const [sessionKey, setSessionKey] = useState(0);
  const [hideWinOverlay, setHideWinOverlay] = useState(false);
  const [shakePieceKey, setShakePieceKey] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [turnPhase, setTurnPhase] = useState<TurnPhase>(IDLE);

  const feedbackTimerRef = useRef<ReturnType<typeof globalThis.setTimeout> | null>(null);
  const revealTimerRef = useRef<ReturnType<typeof globalThis.setTimeout> | null>(null);
  const cpuTimerRef = useRef<ReturnType<typeof globalThis.setTimeout> | null>(null);

  const clearTimer = (
    ref: { current: ReturnType<typeof globalThis.setTimeout> | null },
  ): void => {
    if (ref.current !== null) {
      globalThis.clearTimeout(ref.current);
      ref.current = null;
    }
  };

  const clearAllTimers = useCallback(() => {
    clearTimer(revealTimerRef);
    clearTimer(cpuTimerRef);
  }, []);

  const clearFeedbackTimer = useCallback(() => {
    clearTimer(feedbackTimerRef);
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
  useEffect(() => () => clearAllTimers(), [clearAllTimers]);

  const resetUi = useCallback(() => {
    setShakePieceKey(null);
    setToast(null);
    setTurnPhase(IDLE);
    clearAllTimers();
  }, [clearAllTimers]);

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
    resetUi();
  }, [setup, resetUi]);

  const restartGame = useCallback(() => {
    const normalized = normalizeSetup(setup);
    dispatch({ type: 'restart', setup: normalized });
    setSessionKey((key) => key + 1);
    setHideWinOverlay(false);
    resetUi();
  }, [setup, resetUi]);

  const backToSetup = useCallback(() => {
    setScreen('setup');
    dispatch({ type: 'reset' });
    setSessionKey((key) => key + 1);
    setHideWinOverlay(false);
    resetUi();
  }, [resetUi]);

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
  const liveActiveSeatKind = game === null ? null : activeSeatKind(game);
  const liveActiveColor = game === null ? null : activeColor(game);

  // ---------------------------------------------------------------------------
  // Displayed active player — lagged behind the reducer so the next player's
  // seat highlight + per-player Dice only flip after the move animation ends.
  //
  // The turn phase tells us exactly when it's safe to advance: only on the
  // `moving -> idle` transition (or on the initial `idle` state). While we're
  // in `revealing` or `moving`, we keep showing whoever was active when we
  // entered `revealing`.
  // ---------------------------------------------------------------------------
  const displayedRef = useRef<{ color: PlayerColor | null; seatKind: PlayerKind | null }>({
    color: liveActiveColor,
    seatKind: liveActiveSeatKind,
  });

  if (turnPhase.kind === 'idle' && !isPieceAnimating) {
    displayedRef.current = { color: liveActiveColor, seatKind: liveActiveSeatKind };
  }

  const currentActiveColor = displayedRef.current.color;
  const currentActiveSeatKind = displayedRef.current.seatKind;

  // ---------------------------------------------------------------------------
  // Turn-phase transitions.
  // ---------------------------------------------------------------------------

  // moving -> idle when piece animation completes.
  //
  // `usePieceAnimations` flips `isAnimating` to true in a follow-up commit
  // AFTER the board reference changes. That means right when we enter the
  // `moving` phase, `isPieceAnimating` is still false. We must therefore
  // wait until we've observed `isAnimating === true` at least once before
  // treating a `false` value as "animation finished". If the animation never
  // engages (reduced motion, no visible diff) we give it a short grace
  // window and then exit.
  const sawAnimatingRef = useRef(false);
  useEffect(() => {
    if (turnPhase.kind !== 'moving') {
      sawAnimatingRef.current = false;
      return undefined;
    }
    if (isPieceAnimating) {
      sawAnimatingRef.current = true;
      return undefined;
    }
    if (sawAnimatingRef.current) {
      // Animation started and has now finished — advance.
      setTurnPhase(IDLE);
      return undefined;
    }
    // Animation hasn't engaged yet. Wait a short grace window for the
    // animation effect to flip `isAnimating` true; if it never does (e.g.
    // reduced motion or no visual diff), exit `moving` so the turn advances.
    const id = globalThis.setTimeout(() => {
      if (!sawAnimatingRef.current) setTurnPhase(IDLE);
    }, 80);
    return () => globalThis.clearTimeout(id);
  }, [isPieceAnimating, turnPhase]);

  // Reset the turn phase when the game itself resets (back to setup).
  useEffect(() => {
    if (game === null && turnPhase.kind !== 'idle') {
      setTurnPhase(IDLE);
    }
  }, [game, turnPhase]);

  // ---------------------------------------------------------------------------
  // Roll / move dispatch.
  // ---------------------------------------------------------------------------

  /**
   * Begin a roll reveal. Dispatches the reducer `roll` ONLY after the reveal
   * window completes, so the rolled value is always visible for the full
   * duration regardless of whether there's a legal move.
   */
  // Latest game ref so `beginReveal` (stable identity) can predict moves
  // against the current state without re-creating on every render.
  const gameRef = useRef<GameState | null>(game);
  useEffect(() => {
    gameRef.current = game;
  }, [game]);

  const beginReveal = useCallback(
    (die: DieValue, source: 'human' | 'cpu') => {
      clearTimer(revealTimerRef);
      setTurnPhase({ kind: 'revealing', die, source });
      const currentGame = gameRef.current;
      const willHaveMoves = currentGame !== null && rollWillHaveMoves(currentGame, die);
      const duration = willHaveMoves
        ? SHORT_REVEAL_MS
        : source === 'human'
          ? HUMAN_NO_MOVE_REVEAL_MS
          : CPU_NO_MOVE_REVEAL_MS;
      revealTimerRef.current = globalThis.setTimeout(() => {
        revealTimerRef.current = null;
        try {
          dispatch({ type: 'roll', die });
          // Post-dispatch transitions (revealing -> moving | idle) are handled
          // by effects that watch `game` + `turnPhase`.
        } catch (error) {
          if (error instanceof IllegalIntentError) {
            showFeedback({ toast: 'Cannot roll now' });
            setTurnPhase(IDLE);
          }
        }
      }, duration);
    },
    [showFeedback],
  );

  // After the reveal timer fires AND the reducer has been dispatched, OR when
  // a move dispatches from `revealing`, decide the next phase:
  //   * board changed (a move was applied)        => moving(die)
  //   * game.phase === 'roll' (reducer auto-pass) => idle
  //   * game.phase === 'move'                     => stay in revealing(die);
  //     input opens (canMoveNow) for humans; CPU effect picks a move.
  //
  // IMPORTANT: the board-change check must come first. After dispatching
  // `move`, the reducer transitions to the NEXT player's `phase === 'roll'`,
  // so naively reading `game.phase === 'roll'` would otherwise flip us back
  // to `idle` instead of into `moving`, making the dice immediately show `?`.
  const prevBoardRef = useRef<GameState['board'] | null>(game?.board ?? null);
  useEffect(() => {
    if (game === null) {
      prevBoardRef.current = null;
      return;
    }
    const boardChanged = game.board !== prevBoardRef.current;
    prevBoardRef.current = game.board;

    if (turnPhase.kind !== 'revealing') return;
    if (revealTimerRef.current !== null) return; // reveal window still pending

    if (boardChanged) {
      // A move was committed during the revealing phase — keep the die value
      // visible throughout the piece animation.
      setTurnPhase({ kind: 'moving', die: turnPhase.die });
      return;
    }
    if (game.phase === 'roll') {
      // Reducer auto-passed (no legal move / third six) without a move.
      setTurnPhase(IDLE);
    }
  }, [game, turnPhase]);

  // ---------------------------------------------------------------------------
  // Derived flags.
  // ---------------------------------------------------------------------------

  const legalMoves = useMemo(
    () => (game?.phase === 'move' ? getLegalMoves(game) : []),
    [game],
  );

  const legalPieceKeys = useMemo(
    () => new Set(legalMoves.map((move) => pieceKey(move.piece))),
    [legalMoves],
  );

  // Display-side "human turn" (drives turn hint + per-player Dice mount).
  const isHumanTurn =
    game !== null && !isGameOver(game) && currentActiveSeatKind === 'human';

  // Live "human turn" — used for input gating so the lagged display can't
  // accidentally let the previous player keep acting.
  const isLiveHumanTurn =
    game !== null && !isGameOver(game) && liveActiveSeatKind === 'human';

  const showTurnTimer = isHumanTurn && turnTimerApplies(seatKinds);

  // The single, simple input gate: only when we're truly idle.
  const canRoll =
    isLiveHumanTurn && game !== null && game.phase === 'roll' && turnPhase.kind === 'idle';

  const canMoveNow =
    isLiveHumanTurn &&
    game !== null &&
    game.phase === 'move' &&
    turnPhase.kind === 'revealing';

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
      if (!canRoll) return;
      const value = die ?? randomDie();
      beginReveal(value, 'human');
    },
    [canRoll, beginReveal],
  );

  const move = useCallback(
    (piece: PieceId) => {
      if (!canMoveNow) return;
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
    [canMoveNow, showFeedback],
  );

  const tryMove = useCallback(
    (piece: PieceId) => {
      if (!isLiveHumanTurn || game === null) {
        showFeedback({ shakePieceKey: pieceKey(piece), toast: 'Not your turn' });
        return;
      }
      if (game.phase !== 'move' || turnPhase.kind !== 'revealing') {
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
    [game, isLiveHumanTurn, legalPieceKeys, move, showFeedback, turnPhase],
  );

  // ---------------------------------------------------------------------------
  // CPU driver. One job: when it's a CPU's turn and the turn phase is idle,
  // schedule a think delay then either roll or pick a move. The single gate
  // (`turnPhase.kind === 'idle'`) means this effect cannot fire while a
  // previous turn's reveal/animation is still in progress.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (screen !== 'play' || game === null || isGameOver(game)) return;
    if (liveActiveSeatKind !== 'cpu') return;
    if (isPieceAnimating) return;

    if (game.phase === 'roll' && turnPhase.kind === 'idle') {
      const thinkMs = pickCpuThinkDelayMs();
      clearTimer(cpuTimerRef);
      cpuTimerRef.current = globalThis.setTimeout(() => {
        cpuTimerRef.current = null;
        beginReveal(randomDie(), 'cpu');
      }, thinkMs);
      return () => clearTimer(cpuTimerRef);
    }

    if (
      game.phase === 'move' &&
      turnPhase.kind === 'revealing' &&
      turnPhase.source === 'cpu'
    ) {
      // Reveal window for the CPU just ended; pick & dispatch the move.
      // (We wait for `revealing` so the player has seen the die value for the
      // full CPU reveal duration before the piece starts moving.)
      clearTimer(cpuTimerRef);
      cpuTimerRef.current = globalThis.setTimeout(() => {
        cpuTimerRef.current = null;
        const pick = chooseMove(game);
        if (pick !== null) {
          dispatch({ type: 'move', piece: pick.piece });
        } else {
          dispatch({ type: 'forfeit' });
        }
      }, 0);
      return () => clearTimer(cpuTimerRef);
    }

    return undefined;
  }, [
    screen,
    game,
    liveActiveSeatKind,
    turnPhase,
    isPieceAnimating,
    beginReveal,
  ]);

  // ---------------------------------------------------------------------------
  // Dice face: pure projection of turnPhase.
  // ---------------------------------------------------------------------------
  const pendingRoll: DieValue | null =
    turnPhase.kind === 'idle' ? null : turnPhase.die;
  const diceFace: DieValue | null = pendingRoll;

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
    activeColor: currentActiveColor,
    activeSeatKind: currentActiveSeatKind,
    legalMoves,
    legalPieceKeys,
    canRoll,
    isHumanTurn,
    showTurnTimer,
    timerSeconds,
    timerProgress,
    isPieceAnimating,
    pendingRoll,
    diceFace,
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
