import { describe, it, expect } from 'vitest';
import { num, buscarSerie, rondaCompleta, esUltimaVuelta, countPendingSets, setUnlocked, clampSeconds, skipDialogCopy } from './runnerLogic';
import type { SessionSet } from '@/db';
import type { Exercise } from '@/types';

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

const serie = (exercise: string, setIndex: number, bloqueOrden = 0): SessionSet => ({
  exercise,
  setIndex,
  bloqueOrden,
  value: '10',
  unit: 'reps',
  orden: 0,
}) as SessionSet;

describe('rondaCompleta', () => {
  const biserie: Exercise[] = [{ name: 'A' }, { name: 'B' }];

  it('no está completa cuando falta un ejercicio de la vuelta', () => {
    expect(rondaCompleta([serie('A', 1)], 0, biserie, 1)).toBe(false);
  });

  it('está completa cuando todos los ejercicios registraron esa vuelta', () => {
    expect(rondaCompleta([serie('A', 1), serie('B', 1)], 0, biserie, 1)).toBe(true);
  });

  it('no cuenta series de otra vuelta ni de otro bloque', () => {
    expect(rondaCompleta([serie('A', 2), serie('B', 2)], 0, biserie, 1)).toBe(false);
    expect(rondaCompleta([serie('A', 1, 1), serie('B', 1, 1)], 0, biserie, 1)).toBe(false);
  });

  it('con un solo ejercicio depende de su propia serie', () => {
    const simple: Exercise[] = [{ name: 'A' }];
    expect(rondaCompleta([serie('A', 1)], 0, simple, 1)).toBe(true);
    expect(rondaCompleta([], 0, simple, 1)).toBe(false);
  });
});

describe('esUltimaVuelta', () => {
  it('es la última cuando no quedan filas después de la serie', () => {
    expect(esUltimaVuelta([3, 3], 3)).toBe(true);
  });

  it('no es la última cuando todavía quedan vueltas por delante', () => {
    expect(esUltimaVuelta([3, 3], 1)).toBe(false);
    expect(esUltimaVuelta([4, 3], 3)).toBe(false);
  });
});

describe('countPendingSets', () => {
  it('counts an empty set only when nothing was typed and nothing was registered', () => {
    expect(
      countPendingSets([
        { value: '', registeredValue: null },
        { value: '', registeredValue: '5' },
      ]),
    ).toEqual({ typed: 0, empty: 1 });
  });

  it('counts a typed value as pending while it differs from the registered one', () => {
    expect(
      countPendingSets([
        { value: '6', registeredValue: null },
        { value: '7', registeredValue: '6' },
      ]),
    ).toEqual({ typed: 2, empty: 0 });
  });

  it('ignores a typed value that already matches what was registered', () => {
    expect(countPendingSets([{ value: '6', registeredValue: '6' }])).toEqual({ typed: 0, empty: 0 });
  });

  it('reports nothing pending for an empty list of sets', () => {
    expect(countPendingSets([])).toEqual({ typed: 0, empty: 0 });
  });
});

describe('skipDialogCopy', () => {
  it('reports only the empty series when nothing was typed', () => {
    expect(skipDialogCopy({ typed: 0, empty: 3 })).toBe(
      'Quedan 3 series vacías. Si continuás, se omiten.',
    );
  });

  it('agrees in the singular for a single empty series', () => {
    expect(skipDialogCopy({ typed: 0, empty: 1 })).toBe(
      'Queda 1 serie vacía. Si continuás, se omite.',
    );
  });

  it('says the typed series get registered, not omitted', () => {
    expect(skipDialogCopy({ typed: 2, empty: 1 })).toBe(
      'Tenés 2 series cargadas sin confirmar y 1 serie vacía. Si continuás, las cargadas se registran y las vacías se omiten.',
    );
  });
});

describe('setUnlocked', () => {
  const biserie: Exercise[] = [
    { name: 'A', reps: '8' },
    { name: 'B', timeSec: 20 },
  ];

  it('always opens the first row of every exercise', () => {
    expect(setUnlocked([], 0, biserie, 0)).toBe(true);
  });

  it('waits for the whole round, not just for this exercise\'s own previous set', () => {
    // A completed its set 1 but B did not: in a biserie the round is not over.
    expect(setUnlocked([serie('A', 1)], 0, biserie, 1)).toBe(false);
  });

  it('opens the next row once every exercise of the block registered that round', () => {
    expect(setUnlocked([serie('A', 1), serie('B', 1)], 0, biserie, 1)).toBe(true);
  });

  it('keeps a single-exercise block working as before', () => {
    const simple: Exercise[] = [{ name: 'A', reps: '8' }];
    expect(setUnlocked([], 0, simple, 1)).toBe(false);
    expect(setUnlocked([serie('A', 1)], 0, simple, 1)).toBe(true);
  });

  it('does not mix blocks', () => {
    expect(setUnlocked([serie('A', 1, 1), serie('B', 1, 1)], 0, biserie, 1)).toBe(false);
  });
});

describe('clampSeconds', () => {
  it('keeps a value inside the ceiling', () => {
    expect(clampSeconds('8', 10)).toBe(8);
    expect(clampSeconds('20', 10)).toBe(10);
  });
  it('never goes below zero and never returns NaN', () => {
    expect(clampSeconds('-5', 10)).toBe(0);
    expect(clampSeconds('', 10)).toBe(0);
    expect(clampSeconds('abc', 10)).toBe(0);
  });
  it('rounds to whole seconds', () => {
    expect(clampSeconds('7.6', 10)).toBe(8);
  });
});
