import type { Block } from '../types';

/**
 * Descansos de la rutina.
 *
 * Los tiempos salen del bloque: `restBetweenSetsSec` es el descanso entre series (vueltas) y
 * `restBetweenExercisesSec` el descanso entre ejercicios. Son datos de la rutina: el runner los
 * informa y los respeta, no se editan en el timer de descanso.
 */

/** Series (vueltas) configuradas para un bloque. Siempre al menos una. */
export function seriesCount(block: Block): number {
  const n = Number(block?.sets);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

function seg(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.floor(n);
}

/** Descanso entre series del bloque. */
export function restAfterSet(block: Block): number {
  return seg(block?.restBetweenSetsSec) ?? 0;
}

/**
 * Descanso al terminar un ejercicio del bloque.
 * Los ejercicios que no cierran el bloque usan el descanso entre ejercicios; el último
 * ejercicio hereda ese descanso o, si el bloque no lo define, el descanso entre series.
 */
export function restAfterExercise(block: Block, isLastInBlock: boolean): number {
  const entreEjercicios = seg(block?.restBetweenExercisesSec);
  if (entreEjercicios !== null) return entreEjercicios;
  return isLastInBlock ? restAfterSet(block) : 0;
}
