/** Build a shareable URL for an online room (link-only discovery). */
export function buildJoinUrl(roomId: string, joinCode: string): string {
  const url = new URL(globalThis.location.href);
  url.searchParams.set('room', roomId);
  url.searchParams.set('join', joinCode.toUpperCase());
  url.searchParams.delete('play');
  url.searchParams.delete('fixture');
  return url.href;
}

export interface JoinLinkParams {
  readonly roomId: string;
  readonly joinCode: string;
}

export function parseJoinLink(search = globalThis.location.search): JoinLinkParams | null {
  const params = new URLSearchParams(search);
  const roomId = params.get('room');
  const joinCode = params.get('join');
  if (!roomId || !joinCode) return null;
  return { roomId, joinCode: joinCode.toUpperCase() };
}

export function wsUrlForRoom(roomId: string): string {
  const protocol = globalThis.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${globalThis.location.host}/api/rooms/${encodeURIComponent(roomId)}/ws`;
}

/** Credentials for `useOnlineGame` — always routes WS through the current origin (Vite proxy in dev). */
export function buildOnlineCredentials(
  roomId: string,
  joinCode: string,
  options?: { readonly displayName?: string; readonly resumeToken?: string },
): {
  readonly roomId: string;
  readonly joinCode: string;
  readonly wsUrl: string;
  readonly displayName?: string;
  readonly resumeToken?: string;
} {
  const stored = loadRoomSession(roomId);
  return {
    roomId,
    joinCode: joinCode.toUpperCase(),
    wsUrl: wsUrlForRoom(roomId),
    displayName: options?.displayName ?? stored?.displayName,
    resumeToken: options?.resumeToken ?? stored?.resumeToken,
  };
}

const STORAGE_PREFIX = 'mench:online:';

export interface StoredRoomSession {
  readonly roomId: string;
  readonly joinCode: string;
  readonly wsUrl: string;
  readonly resumeToken: string;
  readonly displayName?: string;
}

export function loadRoomSession(roomId: string): StoredRoomSession | null {
  try {
    const raw = sessionStorage.getItem(`${STORAGE_PREFIX}${roomId}`);
    if (!raw) return null;
    return JSON.parse(raw) as StoredRoomSession;
  } catch {
    return null;
  }
}

export function saveRoomSession(session: StoredRoomSession): void {
  sessionStorage.setItem(`${STORAGE_PREFIX}${session.roomId}`, JSON.stringify(session));
}

export function clearRoomSession(roomId: string): void {
  sessionStorage.removeItem(`${STORAGE_PREFIX}${roomId}`);
}
