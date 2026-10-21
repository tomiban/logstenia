import type { Block, Exercise, Model } from '../types';
import { restAfterExercise, restAfterSet } from './rest';

export interface WorkoutStep {
  /** Índice del bloque dentro del modelo. */
  blockIdx: number;
  /** Índice del ejercicio dentro del bloque. */
  exIdx: number;
  block: Block;
  exercise: Exercise;
  /** Descanso entre series del ejercicio. */
  restAfterSetSec: number;
  /** Descanso al terminar el ejercicio, antes del siguiente. */
  restAfterExerciseSec: number;
}

/** Aplana un modelo en los pasos del runner: un paso por ejercicio, con sus descansos. */
export function buildSteps(model: Model): WorkoutStep[] {
  const steps: WorkoutStep[] = [];
  const blocks = model?.blocks ?? [];
  blocks.forEach((block, blockIdx) => {
    const ejercicios = block?.exercises ?? [];
    ejercicios.forEach((exercise, exIdx) => {
      steps.push({
        blockIdx,
        exIdx,
        block,
        exercise,
        restAfterSetSec: restAfterSet(block),
        restAfterExerciseSec: restAfterExercise(block),
      });
    });
  });
  return steps;
}
