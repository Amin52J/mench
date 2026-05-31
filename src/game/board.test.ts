import { describe, expect, it } from 'vitest';
import {
  HOME_FINISH_INDEX,
  SAFE_TRACK_INDICES,
  START_TRACK_INDEX,
  TRACK_LENGTH,
  TRACK_RENDER_ORDER,
  advanceAlongTrack,
  getHomeGateTrackIndex,
  getStartTrackIndex,
  isInHomeStretch,
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

  it('uses edge indices 0 and 51', () => {
    expect(trackStepsFromStart('red', 0)).toBe(0);
    expect(trackStepsFromStart('red', 51)).toBe(51);
    expect(getHomeGateTrackIndex('red')).toBe(51);
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

  it('places home gate one step before start (clockwise)', () => {
    for (const color of PLAYER_COLORS) {
      const start = getStartTrackIndex(color);
      expect(getHomeGateTrackIndex(color)).toBe((start + TRACK_LENGTH - 1) % TRACK_LENGTH);
    }
  });
});

describe('advanceAlongTrack', () => {
  it('moves clockwise on the shared track', () => {
    const pos = advanceAlongTrack('red', { zone: 'track', index: 0 }, 3);
    expect(pos).toEqual({ zone: 'track', index: 3 });
  });

  it('enters home from the gate cell in one step', () => {
    expect(getHomeGateTrackIndex('green')).toBe(12);

    const atGate = advanceAlongTrack('green', { zone: 'track', index: 12 }, 0);
    expect(atGate).toEqual({ zone: 'track', index: 12 });

    const intoHome = advanceAlongTrack('green', { zone: 'track', index: 12 }, 1);
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
    expect(stepsToFinish('red', { zone: 'yard' })).toBe(57);
  });

  it('decreases along track and home', () => {
    expect(stepsToFinish('blue', { zone: 'track', index: 39 })).toBe(57);
    expect(stepsToFinish('blue', { zone: 'track', index: 38 })).toBe(6);
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
