/**
 * Online room hook — connect, dispatch intents, apply server snapshots only.
 *
 * Phase 4.2: the client never mutates `GameState` locally; it only renders
 * what the DO broadcasts. A local 1Hz ticker recomputes seconds remaining
 * from the absolute `turnDeadline` so the countdown does not drift between
 * snapshots, but the server is always the source of truth (`api-design.mdc`).
 */

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import type { GameIntent } from '@game/rules';
import type {
  PublicGameState,
  SeatAssignment,
  ServerMessage,
} from '@game/online/protocol.ts';
import {
  connectToRoom,
  type ConnectionStatus,
  type RoomConnection,
} from './connection.ts';

export interface OnlineRoomCredentials {
  readonly wsUrl: string;
  readonly joinCode: string;
  readonly displayName?: string;
}

export interface OnlineGameSnapshot {
  readonly status: ConnectionStatus;
  readonly seat: SeatAssignment | null;
  readonly state: PublicGameState | null;
  readonly seq: number;
  readonly error: string | null;
  /** Seconds remaining until the active human turn auto-skips. */
  readonly secondsRemaining: number;
}

interface InternalState {
  readonly status: ConnectionStatus;
  readonly seat: SeatAssignment | null;
  readonly state: PublicGameState | null;
  readonly seq: number;
  readonly error: string | null;
}

type Action =
  | { type: 'status'; status: ConnectionStatus }
  | { type: 'server'; message: ServerMessage }
  | { type: 'reset' };

const initialState: InternalState = {
  status: 'connecting',
  seat: null,
  state: null,
  seq: 0,
  error: null,
};

function reducer(state: InternalState, action: Action): InternalState {
  switch (action.type) {
    case 'status':
      return { ...state, status: action.status };
    case 'reset':
      return initialState;
    case 'server': {
      const msg = action.message;
      if (msg.type === 'welcome') {
        return {
          ...state,
          seat: msg.seat,
          state: msg.state,
          seq: msg.seq,
          error: null,
        };
      }
      if (msg.type === 'state') {
        // Reject out-of-order snapshots (`api-design.mdc` reconnect/seq policy).
        if (msg.seq <= state.seq && state.state !== null) {
          return state;
        }
        return { ...state, state: msg.state, seq: msg.seq };
      }
      if (msg.type === 'error') {
        return { ...state, error: `${msg.code}: ${msg.message}` };
      }
      return state;
    }
  }
}

export function useOnlineGame(
  credentials: OnlineRoomCredentials | null,
): OnlineGameSnapshot & {
  readonly sendIntent: (intent: GameIntent) => void;
  readonly disconnect: () => void;
} {
  const [state, dispatch] = useReducer(reducer, initialState);
  const connRef = useRef<RoomConnection | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (credentials === null) {
      dispatch({ type: 'reset' });
      return;
    }
    const conn = connectToRoom({
      wsUrl: credentials.wsUrl,
      onStatus: (status) => {
        dispatch({ type: 'status', status });
        if (status === 'open') {
          conn.send({
            type: 'join',
            joinCode: credentials.joinCode,
            displayName: credentials.displayName,
          });
        }
      },
      onMessage: (message) => dispatch({ type: 'server', message }),
    });
    connRef.current = conn;
    return () => {
      conn.close();
      connRef.current = null;
    };
  }, [credentials]);

  // 1 Hz local ticker — derives remaining seconds from the server deadline so
  // the displayed countdown stays smooth between snapshot broadcasts.
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const deadline = state.state?.turnDeadline ?? null;
  const secondsRemaining =
    deadline === null ? 0 : Math.max(0, Math.ceil((deadline - now) / 1000));

  const sendIntent = useCallback((intent: GameIntent) => {
    connRef.current?.send({ type: 'intent', intent });
  }, []);

  const disconnect = useCallback(() => {
    connRef.current?.close();
    connRef.current = null;
    dispatch({ type: 'reset' });
  }, []);

  return {
    status: state.status,
    seat: state.seat,
    state: state.state,
    seq: state.seq,
    error: state.error,
    secondsRemaining,
    sendIntent,
    disconnect,
  };
}
