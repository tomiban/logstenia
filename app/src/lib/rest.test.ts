import { describe, it, expect } from 'vitest';
import { restAfterExercise, restAfterSet, seriesCount } from './rest';
import type { Block } from '../types';

const block = (extra: Partial<Block> = {}): Block => ({
  type: 'single',
  sets: 3,
  restBetweenSetsSec: 90,
  exercises: [],
  ...extra,
});

describe('seriesCount', () => {
  it('devuelve las vueltas del bloque', () => {
    expect(seriesCount(block({ sets: 4 }))).toBe(4);
  });

  it('devuelve al menos una serie cuando el bloque no define vueltas', () => {
    expect(seriesCount(block({ sets: 0 }))).toBe(1);
    expect(seriesCount({} as Block)).toBe(1);
  });
});

describe('restAfterSet', () => {
  it('devuelve el descanso entre series del bloque', () => {
    expect(restAfterSet(block({ restBetweenSetsSec: 120 }))).toBe(120);
  });

  it('cae en cero cuando el bloque no define descanso', () => {
    expect(restAfterSet(block({ restBetweenSetsSec: undefined }))).toBe(0);
  });
});

describe('restAfterExercise', () => {
  it('usa el descanso entre ejercicios del bloque', () => {
    const b = block({ restBetweenSetsSec: 90, restBetweenExercisesSec: 30 });
    expect(restAfterExercise(b, false)).toBe(30);
    expect(restAfterExercise(b, true)).toBe(30);
  });

  it('usa cero entre ejercicios del bloque cuando el bloque no define ese descanso', () => {
    expect(restAfterExercise(block({ restBetweenSetsSec: 90 }), false)).toBe(0);
  });

  it('el último ejercicio del bloque hereda el descanso entre series', () => {
    expect(restAfterExercise(block({ restBetweenSetsSec: 90 }), true)).toBe(90);
  });
});
