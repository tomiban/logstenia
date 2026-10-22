import { describe, it, expect } from 'vitest';
import { num, buscarSerie } from './runnerLogic';
import type { SessionSet } from '@/db';

describe('num', () => {
  it('parses numbers and returns NaN for invalid', () => {
    expect(num('5')).toBe(5);
    expect(num(3)).toBe(3);
    expect(isNaN(num('abc'))).toBe(true);
    expect(isNaN(num(undefined))).toBe(true);
  });
});

describe('buscarSerie', () => {
  const sets: SessionSet[] = [
    { exercise: 'Push', setIndex: 1, bloqueOrden: 2, value: '10', unit: 'reps', orden: 1 } as SessionSet,
  ];
  it('finds matching set', () => {
    expect(buscarSerie(sets, 'Push', 2, 1)).toBeDefined();
  });
  it('returns undefined when no match', () => {
    expect(buscarSerie(sets, 'Push', 2, 2)).toBeUndefined();
    expect(buscarSerie(sets, 'Other', 2, 1)).toBeUndefined();
  });
});
