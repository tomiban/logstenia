import { describe, it, expect } from 'vitest';
import { buildSteps } from './steps';
import type { Model } from '../types';

const modelo = (blocks: any[]): Model => ({ id: 'm1', name: 'M1', intensity: 2, totalTimeMin: 10, blocks });

describe('buildSteps', () => {
  it('devuelve un paso por ejercicio con sus descansos', () => {
    const steps = buildSteps(modelo([
      {
        type: 'single', sets: 3, restBetweenSetsSec: 90, restBetweenExercisesSec: 120,
        exercises: [{ name: 'Plancha', timeSec: 30 }],
      },
    ]));

    expect(steps).toHaveLength(1);
    expect(steps[0]).toMatchObject({
      blockIdx: 0,
      exIdx: 0,
      restAfterSetSec: 90,
      restAfterExerciseSec: 120,
    });
    expect(steps[0].exercise.name).toBe('Plancha');
  });

  it('deriva los descansos del bloque', () => {
    const steps = buildSteps(modelo([
      {
        type: 'biseries', sets: 2, restBetweenSetsSec: 60, restBetweenExercisesSec: 15,
        exercises: [{ name: 'A' }, { name: 'B' }],
      },
    ]));

    expect(steps).toHaveLength(2);
    expect(steps[0]).toMatchObject({ restAfterSetSec: 60, restAfterExerciseSec: 15 });
    expect(steps[1]).toMatchObject({ restAfterSetSec: 60, restAfterExerciseSec: 15 });
  });

  it('sin descanso entre ejercicios usa el descanso entre series', () => {
    const steps = buildSteps(modelo([
      {
        type: 'biseries', sets: 2, restBetweenSetsSec: 60,
        exercises: [{ name: 'A' }, { name: 'B' }],
      },
    ]));

    expect(steps[0]).toMatchObject({ restAfterSetSec: 60, restAfterExerciseSec: 60 });
    expect(steps[1]).toMatchObject({ restAfterSetSec: 60, restAfterExerciseSec: 60 });
  });

  it('devuelve vacío para un modelo sin bloques', () => {
    expect(buildSteps(modelo([]))).toEqual([]);
  });
});
