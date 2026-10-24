import { describe, expect, it } from 'vitest';
import type { MarkRecord, SessionRecord, SessionSet } from '@/repositories';
import {
  anchorsFor,
  bestMarksFrom,
  chainFor,
  completedProgramsFrom,
  describeLock,
  reportFrom,
  touchedAnchors,
  type ProgressionData,
} from './progression';

function serie(exercise: string, value: number, unit: 'sec' | 'reps' = 'sec'): SessionSet {
  return { exercise, setIndex: 1, value: String(value), unit, bloqueOrden: 0, orden: 0 };
}

function sesion(
  planId: string,
  modelId: string,
  sets: SessionSet[] = [],
  completed = true,
): SessionRecord {
  return {
    id: `${planId}:${modelId}`,
    date: '2026-03-02',
    planId,
    modelId,
    durationSec: 900,
    completed,
    sets,
    updatedAt: '2026-03-02T00:00:00.000Z',
    deletedAt: null,
  };
}

function marca(exercise: string, value: number, unit: 'sec' | 'reps' = 'sec'): MarkRecord {
  return {
    id: `marca:${exercise}:${value}`,
    exercise,
    unit,
    value,
    mesoInicio: '2026-03-01',
    date: '2026-03-02',
    updatedAt: '2026-03-02T00:00:00.000Z',
    deletedAt: null,
  };
}

function datos(
  sessions: SessionRecord[],
  marks: MarkRecord[] = [],
  startedPlans: string[] = [],
): ProgressionData {
  return {
    bests: bestMarksFrom(sessions, marks),
    sessionsDone: completedProgramsFrom(sessions, startedPlans),
  };
}

type Objetivo = [string, number, 'sec' | 'reps'];

/** Objetivos del desafío de Tuck Planche (techo del rango prescrito). */
const PLANCHE_TUCK_OBJETIVOS: Objetivo[] = [
  ['Intentos Tuck Planche', 10, 'sec'],
  ['De pica a tuck planche (despegando pies)', 3, 'reps'],
  ['Flexiones lean planche', 6, 'reps'],
  ['Lean planche', 10, 'sec'],
  ['Flexiones en pica', 10, 'reps'],
];

const FUERZA_OBJETIVOS: Objetivo[] = [
  ['Dominadas pronas', 10, 'reps'],
  ['Fondos en paralelas', 10, 'reps'],
  ['Australian pull ups', 15, 'reps'],
  ['Flexiones en pica', 8, 'reps'],
  ['Leg raises colgado', 8, 'reps'],
];

const HEFESTO_OBJETIVOS: Objetivo[] = [
  ['Hefestos (max reps hasta fallo técnico)', 3, 'reps'],
  ['Korean dips (agarre supino)', 12, 'reps'],
  ['Skin the cat (supino)', 7, 'reps'],
];

const HANDSTAND_OBJETIVOS: Objetivo[] = [
  ['Plancha en T dinámica', 20, 'sec'],
  ['Flexiones en pica (buscando profundidad)', 8, 'reps'],
  ['Empujes de pino con cadencia 5-3 (banda)', 3, 'reps'],
];

function sesionConObjetivos(planId: string, modelId: string, objetivos: Objetivo[]): SessionRecord {
  return sesion(
    planId,
    modelId,
    objetivos.map(([ejercicio, valor, unidad]) => serie(ejercicio, valor, unidad)),
  );
}

describe('bestMarksFrom', () => {
  it('toma las marcas registradas en sesiones completadas', () => {
    const bests = bestMarksFrom([sesion('planche-tuck', 'pl-r1', [serie('Tuck planche', 12)])], []);

    expect(bests.get('tuck planche')).toBe(12);
  });

  it('ignora sesiones sin completar y valores no positivos', () => {
    const bests = bestMarksFrom(
      [
        sesion('planche-tuck', 'pl-r1', [serie('Tuck planche', 12)], false),
        sesion('planche-tuck', 'pl-r2', [serie('Tuck planche', 0), serie('Lean planche', 0)]),
      ],
      [],
    );

    expect(bests.size).toBe(0);
  });

  it('se queda con el mejor valor entre sesiones y marcas guardadas, sin distinguir mayúsculas ni espacios', () => {
    const bests = bestMarksFrom(
      [sesion('planche-tuck', 'pl-r1', [serie('Tuck  Planche', 8)])],
      [marca('tuck planche', 11)],
    );

    expect(bests.get('tuck planche')).toBe(11);
  });
});

describe('completedProgramsFrom', () => {
  it('no completa un programa hasta que corrieron todas sus rutinas', () => {
    const parcial = completedProgramsFrom([
      sesion('planche-tuck', 'pl-r1'),
      sesion('planche-tuck', 'pl-r2'),
    ]);
    expect(parcial.has('planche-tuck')).toBe(false);

    const completo = completedProgramsFrom([
      sesion('planche-tuck', 'pl-r1'),
      sesion('planche-tuck', 'pl-r2'),
      sesion('planche-tuck', 'pl-r3'),
      sesion('planche-tuck', 'pl-r4'),
      sesion('planche-tuck', 'pl-r5'),
      sesion('planche-tuck', 'pl-pro1'),
      sesion('planche-tuck', 'res-n1-pr1'),
      sesion('planche-tuck', 'res-n1-pr2'),
      sesion('planche-tuck', 'res-n1-pr3'),
    ]);
    expect(completo.has('planche-tuck')).toBe(true);
  });
});

describe('reportFrom', () => {
  it('completa el nivel y desbloquea el siguiente cuando están todas las marcas del desafío', () => {
    const report = reportFrom(
      'planche-tuck',
      datos([sesionConObjetivos('planche-tuck', 'pl-pro1', PLANCHE_TUCK_OBJETIVOS)]),
    );

    expect(report.next?.id).toBe('planche-tuckadv');
    expect(report.next?.unlocked).toBe(true);
    expect(report.completed).toBe(true);
    expect(report.missing).toEqual([]);
    expect(report.position).toBe(1);
    expect(report.total).toBe(4);
  });

  it('no completa el nivel con una sola marca de un ejercicio que no es del desafío', () => {
    const report = reportFrom(
      'planche-tuck',
      datos([sesion('planche-tuck', 'pl-pro1', [serie('Tuck planche', 10)])]),
    );

    expect(report.next?.unlocked).toBe(false);
    expect(report.completed).toBe(false);
    expect(report.missing).toHaveLength(PLANCHE_TUCK_OBJETIVOS.length);
  });

  it('exige el techo del rango y dice qué falta con la mejor marca registrada', () => {
    const parcial = PLANCHE_TUCK_OBJETIVOS.map(([ejercicio, valor, unidad]) =>
      ejercicio === 'Intentos Tuck Planche' ? serie(ejercicio, 8, unidad) : serie(ejercicio, valor, unidad),
    );
    const report = reportFrom('planche-tuck', datos([sesion('planche-tuck', 'pl-pro1', parcial)]));

    expect(report.completed).toBe(false);
    expect(report.missing).toHaveLength(1);
    expect(report.missing[0]).toMatchObject({
      ejercicio: 'Intentos Tuck Planche',
      unidad: 'sec',
      objetivo: 10,
      mejor: 8,
      met: false,
    });
  });

  it('acepta la marca registrada con el mismo ejercicio escrito distinto', () => {
    const report = reportFrom(
      'planche-tuck',
      datos([
        sesion('planche-tuck', 'pl-pro1', [
          serie('intentos   tuck planche', 10),
          ...PLANCHE_TUCK_OBJETIVOS.slice(1).map(([ejercicio, valor, unidad]) => serie(ejercicio, valor, unidad)),
        ]),
      ]),
    );

    expect(report.completed).toBe(true);
    expect(report.next?.unlocked).toBe(true);
  });

  it('no adelanta más de un nivel con las marcas de un solo desafío', () => {
    const report = reportFrom(
      'planche-tuck',
      datos([sesionConObjetivos('planche-tuck', 'pl-pro1', PLANCHE_TUCK_OBJETIVOS)]),
    );

    expect(report.levels.find((l) => l.id === 'planche-straddle')?.unlocked).toBe(false);
    expect(report.levels.find((l) => l.id === 'planche-full')?.unlocked).toBe(false);
  });

  it('desbloquea el nivel siguiente cuando el actual corrió todas sus rutinas', () => {
    const report = reportFrom(
      'planche-tuck',
      datos([
        sesion('planche-tuck', 'pl-r1'),
        sesion('planche-tuck', 'pl-r2'),
        sesion('planche-tuck', 'pl-r3'),
        sesion('planche-tuck', 'pl-r4'),
        sesion('planche-tuck', 'pl-r5'),
        sesion('planche-tuck', 'pl-pro1'),
        sesion('planche-tuck', 'res-n1-pr1'),
        sesion('planche-tuck', 'res-n1-pr2'),
        sesion('planche-tuck', 'res-n1-pr3'),
      ]),
    );

    expect(report.completed).toBe(true);
    expect(report.next?.unlocked).toBe(true);
  });

  it('recorre una cadena de varios niveles con los criterios de su propio desafío', () => {
    const report = reportFrom(
      'fuerza-principiantes',
      datos([sesionConObjetivos('fuerza-principiantes', 'fuerza-principiantes-benchmark', FUERZA_OBJETIVOS)]),
    );

    expect(report.completed).toBe(true);
    expect(report.next).toMatchObject({ id: 'fuerza-intermedios', unlocked: true });
    expect(report.levels.find((l) => l.id === 'fuerza-avanzados')?.unlocked).toBe(false);
  });

  it('informa el nivel anterior y sus criterios de entrada cuando el programa está bloqueado', () => {
    const report = reportFrom('fuerza-intermedios', datos([]));

    expect(report.unlocked).toBe(false);
    expect(report.previous?.id).toBe('fuerza-principiantes');
    expect(report.requirements).toHaveLength(FUERZA_OBJETIVOS.length);
    expect(report.requirements.every((a) => !a.met)).toBe(true);
  });

  it('deja libre un programa fuera de una cadena y sin nivel siguiente', () => {
    const report = reportFrom('cardio-casa', datos([]));

    expect(report.unlocked).toBe(true);
    expect(report.next).toBeNull();
    expect(report.position).toBeNull();
    expect(report.anchors).toEqual([]);
    expect(report.requirements).toEqual([]);
  });
});

describe('describeLock', () => {
  it('sigue explicando el bloqueo con lo que certifica al nivel anterior', () => {
    const report = reportFrom('fuerza-intermedios', datos([]));

    expect(report.unlocked).toBe(false);
    expect(describeLock(report)).toContain('Fuerza Principiante');
    expect(describeLock(report)).toContain('Dominadas pronas ≥ 10 reps');
  });
});

describe('anchorsFor', () => {
  it('devuelve los criterios del desafío del propio nivel', () => {
    expect(anchorsFor('planche-tuck')).toEqual([
      expect.objectContaining({ ejercicio: 'Intentos Tuck Planche', unidad: 'sec', objetivo: 10 }),
      expect.objectContaining({ ejercicio: 'De pica a tuck planche (despegando pies)', unidad: 'reps', objetivo: 3 }),
      expect.objectContaining({ ejercicio: 'Flexiones lean planche', unidad: 'reps', objetivo: 6 }),
      expect.objectContaining({ ejercicio: 'Lean planche', unidad: 'sec', objetivo: 10 }),
      expect.objectContaining({ ejercicio: 'Flexiones en pica', unidad: 'reps', objetivo: 10 }),
    ]);
    expect(anchorsFor('fuerza-principiantes')).toHaveLength(FUERZA_OBJETIVOS.length);
  });

  it('mantiene el certificado del último nivel de la cadena', () => {
    const criterios = anchorsFor('planche-full');

    expect(criterios).toHaveLength(6);
    expect(criterios.map((a) => a.ejercicio)).toContain('Tuck planche');
    expect(criterios.map((a) => a.ejercicio)).toContain('De tuck a full planche y volver');
    expect(criterios).toEqual(
      expect.arrayContaining([expect.objectContaining({ ejercicio: 'Tuck planche', unidad: 'sec', objetivo: 10 })]),
    );
  });

  it('no inventa criterios cuando el desafío no tiene objetivos numéricos', () => {
    expect(anchorsFor('cardio-casa')).toEqual([]);
  });

  it('certifica el hold de straddle con 5 segundos', () => {
    expect(anchorsFor('planche-straddle')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ejercicio: 'Straddle Planche (intentos)', unidad: 'sec', objetivo: 5 }),
      ]),
    );
  });

  it('certifica el front lever full sin banda con 5 segundos', () => {
    const criterios = anchorsFor('front-full');

    expect(criterios).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ejercicio: 'Hold en front lever full', unidad: 'sec', objetivo: 5 }),
      ]),
    );
    expect(criterios.map((a) => a.ejercicio)).not.toContain('Hold en Front lever full (banda)');
  });
});

describe('hefesto', () => {
  it('desbloquea Hefesto Avanzado con las tres marcas del desafío', () => {
    const report = reportFrom(
      'hefesto-principiantes',
      datos([sesionConObjetivos('hefesto-principiantes', 'hefesto-principiantes-benchmark', HEFESTO_OBJETIVOS)]),
    );

    expect(report.completed).toBe(true);
    expect(report.next).toMatchObject({ id: 'backlever-hefesto', unlocked: true });
  });

  it('no cuenta un hefesto asistido como hefesto', () => {
    const report = reportFrom(
      'hefesto-principiantes',
      datos([sesion('hefesto-principiantes', 'hef-h1', [serie('Hefesto asistido (barra baja)', 8, 'reps')])]),
    );

    expect(report.next?.unlocked).toBe(false);
    expect(report.missing[0]).toMatchObject({
      ejercicio: 'Hefestos (max reps hasta fallo técnico)',
      objetivo: 3,
      mejor: 0,
    });
  });
});

describe('handstand', () => {
  it('es una cadena de tres niveles con el primero abierto', () => {
    expect(chainFor('handstand-principiante')).toEqual([
      'handstand-principiante',
      'handstand-intermedio',
      'handstand-avanzado',
    ]);

    const report = reportFrom('handstand-principiante', datos([]));

    expect(report.unlocked).toBe(true);
    expect(report.position).toBe(1);
    expect(report.total).toBe(3);
    expect(report.next).toMatchObject({ id: 'handstand-intermedio', unlocked: false });
  });

  it('mantiene Intermedio bloqueado sin marcas y lo abre al completar Principiante', () => {
    const bloqueado = reportFrom('handstand-intermedio', datos([]));

    expect(bloqueado.unlocked).toBe(false);
    expect(bloqueado.previous?.id).toBe('handstand-principiante');
    expect(bloqueado.requirements).toHaveLength(HANDSTAND_OBJETIVOS.length);
    expect(bloqueado.requirements.every((a) => !a.met)).toBe(true);

    const sesionPrincipiante = sesionConObjetivos(
      'handstand-principiante',
      'handstand-principiante-benchmark',
      HANDSTAND_OBJETIVOS,
    );

    expect(reportFrom('handstand-intermedio', datos([sesionPrincipiante])).unlocked).toBe(true);
    expect(reportFrom('handstand-principiante', datos([sesionPrincipiante])).completed).toBe(true);
  });
});

describe('touchedAnchors', () => {
  it('detecta que la sesión registró alguna marca del criterio', () => {
    const anchors = anchorsFor('planche-tuck');
    expect(touchedAnchors(anchors, [serie('Intentos Tuck Planche', 10)])).toBe(true);
    expect(touchedAnchors(anchors, [serie('Tuck planche', 10)])).toBe(false);
  });
});
