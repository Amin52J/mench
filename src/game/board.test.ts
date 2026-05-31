import { describe, expect, it } from 'vitest';
import {
  HOME_FINISH_INDEX,
  LAP_LENGTH,
  SAFE_TRACK_INDICES,
  START_TRACK_INDEX,
  TRACK_LENGTH,
  TRACK_RENDER_ORDER,
  advanceAlongTrack,
  getLastLapTrackIndex,
  getPreStartTrackIndex,
  getStartTrackIndex,
  isInHomeStretch,
  isPreStartTrackForColor,
  isSafeTrackIndex,
  renderOrderToTrackIndex,
  stepsToFinish,
  trackIndexToRenderOrder,
  trackStepsFromStart,
} from './board.ts';
import { PLAYER_COLORS, createInitialBoardState, createPieceId } from './types.ts';

describe('track layout', () => {
  it('has 52 cells with identity render order', () => {
    expect(TRACK_LENGTH).toBe(52);
    expect(TRACK_RENDER_ORDER).toHaveLength(52);
    for (let i = 0; i < TRACK_LENGTH; i++) {
      expect(trackIndexToRenderOrder(i)).toBe(i);
      expect(renderOrderToTrackIndex(i)).toBe(i);
    }
  });

  it('marks eight safe squares (starts + stars)', () => {
    expect(SAFE_TRACK_INDICES.size).toBe(8);
    for (const index of [0, 8, 13, 21, 26, 34, 39, 47]) {
      expect(isSafeTrackIndex(index)).toBe(true);
    }
    expect(isSafeTrackIndex(1)).toBe(false);
  });

  it('uses start at along 0 and pre-start at along 51 (red only skips pre-start)', () => {
    expect(trackStepsFromStart('red', 0)).toBe(0);
    expect(trackStepsFromStart('red', 51)).toBe(51);
    expect(getPreStartTrackIndex('red')).toBe(51);
    expect(getLastLapTrackIndex('red')).toBe(50);
    expect(isPreStartTrackForColor('red', 51)).toBe(true);
    expect(isPreStartTrackForColor('blue', 51)).toBe(false);
  });
});

describe('per-color entry offsets', () => {
  it.each([
    ['red', 0],
    ['green', 13],
    ['yellow', 26],
    ['blue', 39],
  ] as const)(
    '%s starts at track index %i',
    (color, expectedStart) => {
      expect(getStartTrackIndex(color)).toBe(expectedStart);
      expect(START_TRACK_INDEX[color]).toBe(expectedStart);
      expect(trackStepsFromStart(color, expectedStart)).toBe(0);
    },
  );

  it('places pre-start one step before each start (clockwise)', () => {
    for (const color of PLAYER_COLORS) {
      const start = getStartTrackIndex(color);
      expect(getPreStartTrackIndex(color)).toBe((start + TRACK_LENGTH - 1) % TRACK_LENGTH);
      expect(getLastLapTrackIndex(color)).toBe((start + LAP_LENGTH - 1) % TRACK_LENGTH);
    }
  });
});

describe('advanceAlongTrack', () => {
  it('moves clockwise on the shared track', () => {
    const pos = advanceAlongTrack('red', { zone: 'track', index: 0 }, 3);
    expect(pos).toEqual({ zone: 'track', index: 3 });
  });

  it('never lands same-color pieces on the pre-start cell', () => {
    expect(getPreStartTrackIndex('blue')).toBe(38);
    const fromLastLap = advanceAlongTrack('blue', { zone: 'track', index: 37 }, 1);
    expect(fromLastLap).toEqual({ zone: 'home', index: 0 });
    expect(fromLastLap.zone === 'track' && fromLastLap.index === 38).toBe(false);
  });

  it('enters home from the last lap cell in one step (skips pre-start)', () => {
    const lastLap = getLastLapTrackIndex('green');
    expect(lastLap).toBe(11);
    expect(getPreStartTrackIndex('green')).toBe(12);

    const intoHome = advanceAlongTrack('green', { zone: 'track', index: lastLap }, 1);
    expect(intoHome).toEqual({ zone: 'home', index: 0 });
  });

  it('caps at finish when home column is overshot', () => {
    const finished = advanceAlongTrack('yellow', { zone: 'home', index: 4 }, 4);
    expect(finished).toEqual({ zone: 'home', index: HOME_FINISH_INDEX });
  });

  it('does not move pieces in the yard', () => {
    const yard = { zone: 'yard' as const };
    expect(advanceAlongTrack('blue', yard, 6)).toBe(yard);
  });
});

describe('stepsToFinish', () => {
  it('counts from yard through track and home', () => {
    expect(stepsToFinish('red', { zone: 'yard' })).toBe(56);
  });

  it('decreases along track and home', () => {
    expect(stepsToFinish('blue', { zone: 'track', index: 39 })).toBe(56);
    expect(stepsToFinish('blue', { zone: 'track', index: getLastLapTrackIndex('blue') })).toBe(6);
    expect(stepsToFinish('blue', { zone: 'home', index: 0 })).toBe(5);
    expect(stepsToFinish('blue', { zone: 'home', index: HOME_FINISH_INDEX })).toBe(0);
  });
});

describe('isInHomeStretch', () => {
  it('is true only in the home column', () => {
    expect(isInHomeStretch({ zone: 'yard' })).toBe(false);
    expect(isInHomeStretch({ zone: 'track', index: 10 })).toBe(false);
    expect(isInHomeStretch({ zone: 'home', index: 2 })).toBe(true);
  });
});

describe('BoardState', () => {
  it('starts all active pieces in the yard', () => {
    const board = createInitialBoardState(PLAYER_COLORS);
    for (const color of PLAYER_COLORS) {
      for (let index = 0; index < 4; index++) {
        expect(board.positions[`${color}-${index}`]).toEqual({ zone: 'yard' });
      }
    }
    expect(createPieceId('red', 0)).toEqual({ color: 'red', index: 0 });
  });
});
