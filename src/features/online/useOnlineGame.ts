/**
 * Online room hook — connect, lobby sync, dispatch intents, server snapshots only.
 */

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import type { GameIntent } from '@game/rules';
import type { PlayerKind } from '@game/types';
import type {
  LobbyState,
  OnlinePlayerCount,
  PublicGameState,
  RoomNotice,
  SeatAssignment,
  ServerMessage,
} from '@game/online/protocol.ts';
import {
  connectToRoom,
  type ConnectionStatus,
  type RoomConnection,
} from './connection.ts';
import { loadRoomSession, saveRoomSession } from './joinLink.ts';

export interface OnlineRoomCredentials {
  readonly wsUrl: string;
  readonly roomId: string;
  readonly joinCode: string;
  readonly displayName?: string;
  readonly resumeToken?: string;
}

export interface OnlineGameSnapshot {
  readonly status: ConnectionStatus;
  readonly connectionId: string | null;
  readonly isHost: boolean;
  readonly resumeToken: string | null;
  readonly seat: SeatAssignment | null;
  readonly lobby: LobbyState | null;
  readonly state: PublicGameState | null;
  readonly seq: number;
  readonly error: string | null;
  readonly roomClosedReason: string | null;
  readonly secondsRemaining: number;
  readonly disconnected: boolean;
  readonly roomNotice: RoomNotice | null;
}

interface InternalState {
  readonly status: ConnectionStatus;
  readonly connectionId: string | null;
  readonly isHost: boolean;
  readonly resumeToken: string | null;
  readonly seat: SeatAssignment | null;
  readonly lobby: LobbyState | null;
  readonly state: PublicGameState | null;
  readonly seq: number;
  readonly error: string | null;
  readonly roomClosedReason: string | null;
  readonly disconnected: boolean;
  readonly roomNotice: RoomNotice | null;
}

type Action =
  | { type: 'status'; status: ConnectionStatus }
  | { type: 'server'; message: ServerMessage }
  | { type: 'reset' }
  | { type: 'disconnected' }
  | { type: 'clear_disconnect' }
  | { type: 'clear_room_notice' };

const initialState: InternalState = {
  status: 'connecting',
  connectionId: null,
  isHost: false,
  resumeToken: null,
  seat: null,
  lobby: null,
  state: null,
  seq: 0,
  error: null,
  roomClosedReason: null,
  disconnected: false,
  roomNotice: null,
};

function reducer(state: InternalState, action: Action): InternalState {
  switch (action.type) {
    case 'status':
      return {
        ...state,
        status: action.status,
        disconnected: action.status === 'closed' ? true : state.disconnected,
      };
    case 'disconnected':
      return { ...state, disconnected: true, status: 'closed' };
    case 'clear_disconnect':
      return { ...state, disconnected: false, error: null };
    case 'clear_room_notice':
      return { ...state, roomNotice: null };
    case 'reset':
      return initialState;
    case 'server': {
      const msg = action.message;
      if (msg.type === 'welcome') {
        return {
          ...state,
          connectionId: msg.connectionId,
          isHost: msg.isHost,
          resumeToken: msg.resumeToken,
          seat: msg.seat,
          lobby: msg.lobby,
          state: msg.state,
          seq: msg.seq,
          error: null,
          disconnected: false,
          status: 'open',
        };
      }
      if (msg.type === 'lobby') {
        if (msg.seq <= state.seq && state.lobby !== null) {
          return state;
        }
        return { ...state, lobby: msg.lobby, seq: msg.seq };
      }
      if (msg.type === 'state') {
        if (msg.seq <= state.seq && state.state !== null) {
          return state;
        }
        return {
          ...state,
          state: msg.state,
          seq: msg.seq,
          lobby:
            state.lobby === null
              ? null
              : { ...state.lobby, started: true },
        };
      }
      if (msg.type === 'room_notice') {
        if (msg.seq <= state.seq && state.roomNotice !== null) {
          return state;
        }
        return { ...state, roomNotice: msg.notice, seq: msg.seq };
      }
      if (msg.type === 'room_closed') {
        return { ...state, roomClosedReason: msg.reason };
      }
      if (msg.type === 'error') {
        return { ...state, error: `${msg.code}: ${msg.message}` };
      }
      return state;
    }
  }
}

const RECONNECT_DELAY_MS = 2_000;
/** Presence banners (`player_left` / `player_rejoined`) auto-dismiss after this delay. */
export const ROOM_NOTICE_DISMISS_MS = 5_000;

export function useOnlineGame(credentials: OnlineRoomCredentials | null): OnlineGameSnapshot & {
  readonly sendIntent: (intent: GameIntent) => void;
  readonly sendSetup: (
    playerCount: OnlinePlayerCount,
    seats: readonly { kind: PlayerKind }[],
  ) => void;
  readonly sendStartGame: () => void;
  readonly disconnect: () => void;
} {
  const [state, dispatch] = useReducer(reducer, initialState);
  const connRef = useRef<RoomConnection | null>(null);
  const resumeTokenRef = useRef<string | undefined>(credentials?.resumeToken);
  const [reconnectNonce, setReconnectNonce] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    resumeTokenRef.current =
      credentials?.resumeToken ??
      loadRoomSession(credentials?.roomId ?? '')?.resumeToken;
  }, [credentials]);

  useEffect(() => {
    if (credentials === null) {
      dispatch({ type: 'reset' });
      return;
    }
    dispatch({ type: 'clear_disconnect' });
    const resumeToken = resumeTokenRef.current;
    const conn = connectToRoom({
      wsUrl: credentials.wsUrl,
      onStatus: (status) => {
        dispatch({ type: 'status', status });
        if (status === 'open') {
          conn.send({
            type: 'join',
            joinCode: credentials.joinCode,
            displayName: credentials.displayName,
            resumeToken,
          });
        }
        if (status === 'closed') {
          dispatch({ type: 'disconnected' });
        }
      },
      onMessage: (message) => {
        dispatch({ type: 'server', message });
        if (message.type === 'welcome') {
          resumeTokenRef.current = message.resumeToken;
          saveRoomSession({
            roomId: credentials.roomId,
            joinCode: credentials.joinCode,
            wsUrl: credentials.wsUrl,
            resumeToken: message.resumeToken,
            displayName: credentials.displayName,
          });
        }
      },
    });
    connRef.current = conn;
    return () => {
      conn.close();
      connRef.current = null;
    };
  }, [credentials, reconnectNonce]);

  useEffect(() => {
    if (!state.disconnected || state.roomClosedReason || credentials === null) {
      return;
    }
    const token =
      resumeTokenRef.current ?? loadRoomSession(credentials.roomId)?.resumeToken;
    if (!token) return;
    const id = window.setTimeout(() => {
      setReconnectNonce((n) => n + 1);
    }, RECONNECT_DELAY_MS);
    return () => window.clearTimeout(id);
  }, [state.disconnected, state.roomClosedReason, credentials]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (state.roomNotice === null) return;
    const id = window.setTimeout(() => {
      dispatch({ type: 'clear_room_notice' });
    }, ROOM_NOTICE_DISMISS_MS);
    return () => window.clearTimeout(id);
  }, [state.roomNotice]);

  const deadline = state.state?.turnDeadline ?? null;
  const secondsRemaining =
    deadline === null ? 0 : Math.max(0, Math.ceil((deadline - now) / 1000));

  const sendIntent = useCallback((intent: GameIntent) => {
    connRef.current?.send({ type: 'intent', intent });
  }, []);

  const sendSetup = useCallback(
    (playerCount: OnlinePlayerCount, seats: readonly { kind: PlayerKind }[]) => {
      connRef.current?.send({ type: 'update_setup', playerCount, seats });
    },
    [],
  );

  const sendStartGame = useCallback(() => {
    connRef.current?.send({ type: 'start_game' });
  }, []);

  const disconnect = useCallback(() => {
    connRef.current?.close();
    connRef.current = null;
    dispatch({ type: 'reset' });
  }, []);

  return {
    status: state.status,
    connectionId: state.connectionId,
    isHost: state.isHost,
    resumeToken: state.resumeToken,
    seat: state.seat,
    lobby: state.lobby,
    state: state.state,
    seq: state.seq,
    error: state.error,
    roomClosedReason: state.roomClosedReason,
    secondsRemaining,
    disconnected: state.disconnected,
    roomNotice: state.roomNotice,
    sendIntent,
    sendSetup,
    sendStartGame,
    disconnect,
  };
}
