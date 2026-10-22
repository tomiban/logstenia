import type { Block, Exercise, Model } from '@/types';
import { restAfterExercise, restAfterSet } from './rest';

export interface WorkoutStep {
  /** Indice del bloque dentro del modelo. */
  blockIdx: number;
  /** Indice del primer ejercicio dentro del bloque (0). */
  exIdx: number;
  block: Block;
  /** Primer ejercicio del bloque (compatibilidad). */
  exercise: Exercise;
  /** Todos los ejercicios del bloque, mostrados juntos en el runner. */
  exercises: Exercise[];
  /** Descanso entre series del ejercicio. */
  restAfterSetSec: number;
  /** Descanso al terminar el ejercicio, antes del siguiente. */
  restAfterExerciseSec: number;
}

/** Aplana un modelo en los pasos del runner: un paso por bloque, con sus descansos. */
export function buildSteps(model: Model): WorkoutStep[] {
  const steps: WorkoutStep[] = [];
  const blocks = model?.blocks ?? [];
  blocks.forEach((block, blockIdx) => {
    const ejercicios = block?.exercises ?? [];
    if (ejercicios.length === 0) return;
    // Un paso por bloque: los ejercicios de una biserie/superserie se muestran juntos.
    steps.push({
      blockIdx,
      exIdx: 0,
      block,
      exercise: ejercicios[0],
      exercises: ejercicios,
      restAfterSetSec: restAfterSet(block),
      restAfterExerciseSec: restAfterExercise(block),
    });
  });
  return steps;
}
