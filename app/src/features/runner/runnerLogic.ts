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

/** One pending decision about a set: what the user typed, and what is already registered. */
export interface PendingSet {
  value: string;
  registeredValue: string | null;
}

/** Series waiting on the user: typed-but-unconfirmed (registered on continue) and empty (skipped). */
export interface PendingSets {
  typed: number;
  empty: number;
}

/**
 * Split the pending sets of a block into the two things that can happen to them: a value typed but
 * not confirmed gets registered on continue, an untouched set gets skipped. The skip dialog states
 * both numbers, so this is the only place that decides them.
 */
export function countPendingSets(sets: Iterable<PendingSet>): PendingSets {
  const out: PendingSets = { typed: 0, empty: 0 };
  for (const set of sets) {
    const typed = set.value.trim() !== '';
    if (!typed) {
      if (set.registeredValue === null) out.empty += 1;
    } else if (set.registeredValue === null || set.registeredValue !== set.value) {
      out.typed += 1;
    }
  }
  return out;
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
