import { activeColor, createGame } from '@game/rules';
import { describe, expect, it } from 'vitest';
import { localGameReducer } from './localGameReducer.ts';
import { defaultSetup } from './types.ts';

describe('localGameReducer', () => {
  it('starts and forfeits a turn', () => {
    const setup = defaultSetup(2);
    let state = localGameReducer(null, { type: 'start', setup });
    expect(state).not.toBeNull();
    expect(state!.seatKinds).toEqual(['human', 'human']);
    expect(activeColor(state!)).toBe('blue');

    state = localGameReducer(state, { type: 'forfeit' });
    expect(activeColor(state!)).toBe('red');
  });

  it('restart clears winner and placements', () => {
    const setup = defaultSetup(2);
    const started = localGameReducer(null, { type: 'start', setup });
    const ended = {
      ...started!,
      winner: 'red' as const,
      placements: ['red' as const],
    };
    const restarted = localGameReducer(ended, { type: 'restart', setup });
    expect(restarted?.winner).toBeNull();
    expect(restarted?.placements).toEqual([]);
  });

  it('resets to null', () => {
    const setup = defaultSetup(2);
    const started = localGameReducer(null, { type: 'start', setup });
    expect(localGameReducer(started, { type: 'reset' })).toBeNull();
  });

  it('restart replaces state', () => {
    const setup = defaultSetup(2);
    const game = createGame({ players: ['red', 'green'] });
    const restarted = localGameReducer(game, { type: 'restart', setup });
    const fresh = localGameReducer(null, { type: 'start', setup });
    expect(restarted?.board.positions).toEqual(fresh!.board.positions);
  });
});
