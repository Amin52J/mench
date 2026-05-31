export { GameSetupView, type GameSetupProps } from './GameSetup.tsx';
export { LocalGameView, type LocalGameViewProps } from './LocalGameView.tsx';
export { useLocalGame, type UseLocalGameResult, type LocalScreen } from './useLocalGame.ts';
export { TURN_TIMER_MS } from './useTurnTimer.ts';
export {
  defaultSetup,
  playersForCount,
  QUICK_SETUP_PRESETS,
  type GameSetup,
  type QuickSetupPreset,
  type SeatKind,
} from './types.ts';
