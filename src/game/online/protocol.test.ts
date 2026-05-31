import { describe, expect, it } from 'vitest';
import {
  parseClientMessage,
  RECONNECT_GRACE_MS,
  TURN_TIMER_SECONDS,
} from './protocol.ts';

describe('parseClientMessage', () => {
  it('accepts join with joinCode', () => {
    expect(
      parseClientMessage({ type: 'join', joinCode: 'ABCD1234' }),
    ).toEqual({ type: 'join', joinCode: 'ABCD1234', displayName: undefined, resumeToken: undefined });
  });

  it('accepts join with displayName and resumeToken', () => {
    expect(
      parseClientMessage({
        type: 'join',
        joinCode: 'X',
        displayName: 'Ada',
        resumeToken: 'tok',
      }),
    ).toEqual({
      type: 'join',
      joinCode: 'X',
      displayName: 'Ada',
      resumeToken: 'tok',
    });
  });

  it('rejects join missing joinCode', () => {
    expect(parseClientMessage({ type: 'join' })).toBeNull();
  });

  it('accepts update_setup', () => {
    expect(
      parseClientMessage({
        type: 'update_setup',
        playerCount: 2,
        seats: [{ kind: 'human' }, { kind: 'cpu' }],
      }),
    ).toEqual({
      type: 'update_setup',
      playerCount: 2,
      seats: [{ kind: 'human' }, { kind: 'cpu' }],
    });
  });

  it('accepts start_game', () => {
    expect(parseClientMessage({ type: 'start_game' })).toEqual({ type: 'start_game' });
  });

  it('accepts ping', () => {
    expect(parseClientMessage({ type: 'ping' })).toEqual({ type: 'ping' });
  });

  it('accepts roll intent with valid die', () => {
    expect(
      parseClientMessage({ type: 'intent', intent: { type: 'roll', die: 6 } }),
    ).toEqual({ type: 'intent', intent: { type: 'roll', die: 6 } });
  });

  it('rejects roll intent with die out of range', () => {
    expect(
      parseClientMessage({ type: 'intent', intent: { type: 'roll', die: 7 } }),
    ).toBeNull();
    expect(
      parseClientMessage({ type: 'intent', intent: { type: 'roll', die: 0 } }),
    ).toBeNull();
  });

  it('accepts move intent with valid piece', () => {
    expect(
      parseClientMessage({
        type: 'intent',
        intent: { type: 'move', piece: { color: 'red', index: 2 } },
      }),
    ).toEqual({
      type: 'intent',
      intent: { type: 'move', piece: { color: 'red', index: 2 } },
    });
  });

  it('rejects move intent with bad piece', () => {
    expect(
      parseClientMessage({
        type: 'intent',
        intent: { type: 'move', piece: { color: 'pink', index: 0 } },
      }),
    ).toBeNull();
    expect(
      parseClientMessage({
        type: 'intent',
        intent: { type: 'move', piece: { color: 'red', index: 5 } },
      }),
    ).toBeNull();
  });

  it('accepts forfeit intent', () => {
    expect(
      parseClientMessage({ type: 'intent', intent: { type: 'forfeit' } }),
    ).toEqual({ type: 'intent', intent: { type: 'forfeit' } });
  });

  it('rejects unknown top-level types', () => {
    expect(parseClientMessage({ type: 'nope' })).toBeNull();
    expect(parseClientMessage(null)).toBeNull();
    expect(parseClientMessage('string')).toBeNull();
  });

  it('exposes timer and reconnect constants', () => {
    expect(TURN_TIMER_SECONDS).toBe(30);
    expect(RECONNECT_GRACE_MS).toBe(60_000);
  });
});
