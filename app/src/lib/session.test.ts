import { describe, it, expect } from 'vitest';
import { elapsedSeconds } from './session';

describe('elapsedSeconds', () => {
  it('returns the seconds between two timestamps', () => {
    expect(elapsedSeconds(1_000, 61_000)).toBe(60);
  });

  it('rounds partial seconds', () => {
    expect(elapsedSeconds(1_600, 3_200)).toBe(2);
  });

  it('never returns a negative duration', () => {
    expect(elapsedSeconds(61_000, 1_000)).toBe(0);
  });

  it('returns zero when the session has no start timestamp', () => {
    expect(elapsedSeconds(0, 61_000)).toBe(0);
  });
});
