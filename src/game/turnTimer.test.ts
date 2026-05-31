import { describe, expect, it } from 'vitest';
import { turnTimerApplies } from './types.ts';

describe('turnTimerApplies', () => {
  it('is false for solo human vs CPUs', () => {
    expect(turnTimerApplies(['human', 'cpu', 'cpu', 'cpu'])).toBe(false);
  });

  it('is false for all-CPU', () => {
    expect(turnTimerApplies(['cpu', 'cpu'])).toBe(false);
  });

  it('is true for hotseat and mixed multi-human games', () => {
    expect(turnTimerApplies(['human', 'human'])).toBe(true);
    expect(turnTimerApplies(['human', 'cpu', 'human', 'cpu'])).toBe(true);
  });
});
