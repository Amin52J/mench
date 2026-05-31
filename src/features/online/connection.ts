/**
 * Thin WebSocket wrapper for the online room (`api-design.mdc`).
 *
 * Phase 4.2 keeps this dumb on purpose: open a socket, parse incoming
 * `ServerMessage`s, expose `send(ClientMessage)`. No reconnect, no buffering;
 * `phase 4.3` will add reconnect + presence.
 */

import type {
  ClientMessage,
  ServerMessage,
} from '@game/online/protocol.ts';

export interface ConnectOptions {
  readonly wsUrl: string;
  readonly onMessage: (msg: ServerMessage) => void;
  readonly onStatus: (status: ConnectionStatus) => void;
}

export type ConnectionStatus = 'connecting' | 'open' | 'closed' | 'error';

export interface RoomConnection {
  send(message: ClientMessage): void;
  close(): void;
}

export function connectToRoom(options: ConnectOptions): RoomConnection {
  const socket = new WebSocket(options.wsUrl);
  options.onStatus('connecting');

  socket.addEventListener('open', () => options.onStatus('open'));
  socket.addEventListener('close', () => options.onStatus('closed'));
  socket.addEventListener('error', () => options.onStatus('error'));
  socket.addEventListener('message', (event) => {
    if (typeof event.data !== 'string') return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(event.data);
    } catch {
      return;
    }
    if (isServerMessage(parsed)) {
      options.onMessage(parsed);
    }
  });

  return {
    send(message) {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(message));
      }
    },
    close() {
      socket.close();
    },
  };
}

function isServerMessage(value: unknown): value is ServerMessage {
  if (typeof value !== 'object' || value === null) return false;
  const t = (value as { type?: unknown }).type;
  return (
    t === 'welcome' || t === 'state' || t === 'error' || t === 'pong'
  );
}
