import { describe, it, expect } from 'vitest';
import { fmt } from './useCronometro';

describe('fmt', () => {
  it('formats seconds as mm:ss', () => {
    expect(fmt(0)).toBe('00:00');
    expect(fmt(5)).toBe('00:05');
    expect(fmt(60)).toBe('01:00');
    expect(fmt(65)).toBe('01:05');
    expect(fmt(3600)).toBe('60:00');
  });
});
