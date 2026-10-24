import type { SessionSet } from '@/repositories';
import type { Exercise } from '@/types';

/** Coerce an unknown value to a number (NaN if not parseable). */
export function num(v: unknown): number {
  const n = Number(v);
  return isNaN(n) ? NaN : n;
}

/** Find a registered set for an exercise within a block. */
export function buscarSerie(
  sets: SessionSet[],
  ejercicio: string,
  bloqueOrden: number,
  setIndex: number,
): SessionSet | undefined {
  return sets.find(
    (l) => l.exercise === ejercicio && l.setIndex === setIndex && l.bloqueOrden === bloqueOrden,
  );
}

/**
 * A round is complete when every exercise of the block registered that set index.
 * In a block with a single exercise this is just its own set.
 */
export function rondaCompleta(
  sets: SessionSet[],
  bloqueOrden: number,
  ejercicios: Exercise[],
  setIndex: number,
): boolean {
  return ejercicios.length > 0 && ejercicios.every((ex) =>
    buscarSerie(sets, ex.name, bloqueOrden, setIndex) !== undefined);
}

/** Tells whether `setIndex` is the last round of the block (no rows left after it). */
export function esUltimaVuelta(filasPorEjercicio: number[], setIndex: number): boolean {
  return filasPorEjercicio.every((filas) => filas <= setIndex);
}
