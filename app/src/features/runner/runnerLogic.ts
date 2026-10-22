import type { SessionSet } from '@/db';

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
