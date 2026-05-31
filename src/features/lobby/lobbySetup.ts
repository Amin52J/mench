import type { LobbyState } from '@game/online/protocol.ts';
import type { GameSetup } from '@/features/session';

export function gameSetupFromLobby(lobby: LobbyState): GameSetup {
  return {
    playerCount: lobby.playerCount,
    seats: lobby.seats.map((seat) => ({ kind: seat.kind })),
  };
}
