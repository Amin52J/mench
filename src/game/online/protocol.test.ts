import { describe, expect, it } from 'vitest';
import { parseClientMessage, TURN_TIMER_SECONDS } from './protocol.ts';

describe('parseClientMessage', () => {
  it('accepts join with joinCode', () => {
    expect(
      parseClientMessage({ type: 'join', joinCode: 'ABCD1234' }),
    ).toEqual({ type: 'join', joinCode: 'ABCD1234', displayName: undefined });
  });

  it('accepts join with displayName', () => {
    expect(
      parseClientMessage({ type: 'join', joinCode: 'X', displayName: 'Ada' }),
    ).toEqual({ type: 'join', joinCode: 'X', displayName: 'Ada' });
  });

  it('rejects join missing joinCode', () => {
    expect(parseClientMessage({ type: 'join' })).toBeNull();
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

  it('exposes the 30-second timer constant (O14)', () => {
    expect(TURN_TIMER_SECONDS).toBe(30);
  });
});
