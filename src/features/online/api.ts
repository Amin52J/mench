/**
 * Thin client for the Worker HTTP API (`api-design.mdc`).
 *
 * Phase 4.2 only needs `POST /api/rooms` to bootstrap a room before the
 * WebSocket handshake; phase 4.3 will add lobby + join-by-code flows.
 */

export interface CreatedRoom {
  readonly roomId: string;
  readonly joinCode: string;
  readonly wsUrl: string;
}

export async function createRoom(apiBase = ''): Promise<CreatedRoom> {
  const response = await fetch(`${apiBase}/api/rooms`, { method: 'POST' });
  if (!response.ok) {
    throw new Error(`createRoom failed: ${response.status}`);
  }
  return (await response.json()) as CreatedRoom;
}
