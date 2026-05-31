import { activeColor, createGame } from '@game/rules';
import { describe, expect, it } from 'vitest';
import { localGameReducer } from './localGameReducer.ts';
import { defaultSetup } from './types.ts';

describe('localGameReducer', () => {
  it('starts and forfeits a turn', () => {
    const setup = defaultSetup(2);
    let state = localGameReducer(null, { type: 'start', setup });
    expect(state).not.toBeNull();
    expect(activeColor(state!)).toBe('red');

    state = localGameReducer(state, { type: 'forfeit' });
    expect(activeColor(state!)).toBe('green');
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
    expect(restarted?.board.positions).toEqual(
      createGame({ players: ['red', 'green'] }).board.positions,
    );
  });
});
