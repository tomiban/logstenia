import { describe, it, expect } from 'vitest';
import { restAfterExercise, restAfterSet, seriesCount } from './rest';
import type { Block } from '@/types';

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
    expect(restAfterExercise(b)).toBe(30);
  });

  it('cae en el descanso entre series cuando el bloque no define descanso entre ejercicios', () => {
    expect(restAfterExercise(block({ restBetweenSetsSec: 90 }))).toBe(90);
    expect(restAfterExercise(block({ restBetweenSetsSec: 90, restBetweenExercisesSec: 0 }))).toBe(90);
  });

  it('cae en cero cuando el bloque no define ningún descanso', () => {
    expect(restAfterExercise(block({ restBetweenSetsSec: 0 }))).toBe(0);
  });
});
