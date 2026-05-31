/**
 * Online multiplayer feature (`api-design.mdc`, `roadmap.mdc` wave 4).
 *
 * Phase 4.2 exposes the connection primitives and a thin view that renders
 * server-authoritative state. Phase 4.3 will layer lobby + join-by-code UI
 * over this surface.
 */

export { createRoom, type CreatedRoom } from './api.ts';
export { connectToRoom, type ConnectionStatus, type RoomConnection } from './connection.ts';
export {
  useOnlineGame,
  type OnlineGameSnapshot,
  type OnlineRoomCredentials,
} from './useOnlineGame.ts';
export { OnlineGameView, type OnlineGameViewProps } from './OnlineGameView.tsx';
