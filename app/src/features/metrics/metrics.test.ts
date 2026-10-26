import { describe, it, expect } from 'vitest';
import {
  addDays,
  windowsFor,
  computeTelemetry,
  weeklyVolume,
  collectMarks,
  bestMarks,
  computeGoals,
  deriveGoal,
  anchorProgress,
  anchoredEntries,
  matchesAnchor,
  dedupeAnchors,
  planDistribution,
  compareSessions,
  exerciseSeries,
  unitForExercise,
  delta,
  metricsView,
} from './metrics';
import type { SessionRecord } from '@/db';
import type { AnchorLike, MarkEntry } from './metrics';

const ses = (date: string, over: Partial<SessionRecord> = {}): SessionRecord => ({
  id: over.id ?? 'ses-mock',
  updatedAt: over.updatedAt ?? '2026-10-20T12:00:00.000Z',
  date,
  planId: 'p1',
  modelId: 'm1',
  durationSec: 3600,
  completed: true,
  ...over,
});

describe('metricsView', () => {
  it('shows the error state after a failed read even when no day was resolved', () => {
    expect(
      metricsView({ loading: false, error: 'No se pudieron leer los datos de este dispositivo.', today: '' }),
    ).toBe('error');
  });

  it('stays loading while the read is in flight', () => {
    expect(metricsView({ loading: true, error: null, today: '' })).toBe('loading');
  });
});

describe('addDays', () => {
  it('moves across month boundaries', () => {
    expect(addDays('2026-10-20', -9)).toBe('2026-10-11');
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });
});

describe('windowsFor', () => {
  it('builds a 7 day window and the previous 7 days', () => {
    const w = windowsFor('7d', '2026-10-20');
    expect(w.current).toEqual({ start: '2026-10-14', end: '2026-10-20' });
    expect(w.previous).toEqual({ start: '2026-10-07', end: '2026-10-13' });
    expect(w.days).toBe(7);
  });

  it('builds a 30 day window and the previous 30 days', () => {
    const w = windowsFor('30d', '2026-10-20');
    expect(w.current).toEqual({ start: '2026-09-21', end: '2026-10-20' });
    expect(w.previous).toEqual({ start: '2026-08-22', end: '2026-09-20' });
  });

  it('builds a 90 day window and the previous 90 days', () => {
    const w = windowsFor('90d', '2026-10-20');
    expect(w.current).toEqual({ start: '2026-07-23', end: '2026-10-20' });
    expect(w.previous).toEqual({ start: '2026-04-24', end: '2026-07-22' });
  });

  it('uses the earliest known day for the all range and has no previous window', () => {
    const w = windowsFor('all', '2026-10-20', '2026-01-05');
    expect(w.current).toEqual({ start: '2026-01-05', end: '2026-10-20' });
    expect(w.previous).toBeNull();
  });
});

describe('computeTelemetry', () => {
  const sessions = [
    ses('2026-10-20', { durationSec: 3600 }),
    ses('2026-10-18', { durationSec: 1800 }),
    ses('2026-10-10', { durationSec: 600 }),
    ses('2026-09-10', { durationSec: 3000 }),
    ses('2026-08-21', { durationSec: 1200 }),
    ses('2026-08-20', { durationSec: 1200 }),
  ];

  it('counts sessions, minutes and average inside the window', () => {
    const t = computeTelemetry(sessions, windowsFor('30d', '2026-10-20'));
    expect(t.sessions).toBe(3);
    expect(t.minutes).toBe(100);
    expect(t.avgMinutes).toBe(33);
  });

  it('compares against the previous window of the same length', () => {
    const t = computeTelemetry(sessions, windowsFor('30d', '2026-10-20'));
    expect(t.prevSessions).toBe(1);
    expect(t.prevMinutes).toBe(50);
  });

  it('leaves previous values empty when there is no previous window', () => {
    const t = computeTelemetry(sessions, windowsFor('all', '2026-10-20', '2026-01-05'));
    expect(t.prevSessions).toBeNull();
    expect(t.prevMinutes).toBeNull();
    expect(t.prevAvgMinutes).toBeNull();
  });

  it('measures the current streak and the best streak over all history', () => {
    const t = computeTelemetry(sessions, windowsFor('all', '2026-10-20', '2026-01-05'));
    expect(t.streak).toBe(1);
    expect(t.bestStreak).toBe(2);
  });

  it('counts the streak backwards from today while it holds', () => {
    const t = computeTelemetry(
      [ses('2026-10-20'), ses('2026-10-19'), ses('2026-10-18')],
      windowsFor('all', '2026-10-20', '2026-01-05'),
    );
    expect(t.streak).toBe(3);
  });

  it('ignores sessions without a recorded duration in the time average', () => {
    const t = computeTelemetry(
      [ses('2026-10-20', { durationSec: 0 }), ses('2026-10-19', { durationSec: 1200 })],
      windowsFor('30d', '2026-10-20'),
    );
    expect(t.sessions).toBe(2);
    expect(t.minutes).toBe(20);
    expect(t.avgMinutes).toBe(20);
  });
});

describe('weeklyVolume', () => {
  it('buckets sessions into monday based weeks', () => {
    const sessions = [ses('2026-10-19'), ses('2026-10-20'), ses('2026-10-14')];
    const w = weeklyVolume(sessions, 3, '2026-10-20');
    expect(w).toHaveLength(3);
    expect(w[2]).toMatchObject({ start: '2026-10-19', sessions: 2, current: true });
    expect(w[1]).toMatchObject({ start: '2026-10-12', sessions: 1 });
    expect(w[0]).toMatchObject({ start: '2026-10-05', sessions: 0 });
  });

  it('sums minutes per week', () => {
    const sessions = [ses('2026-10-19', { durationSec: 1800 }), ses('2026-10-20', { durationSec: 600 })];
    const w = weeklyVolume(sessions, 1, '2026-10-20');
    expect(w[0].minutes).toBe(40);
  });
});

describe('marks', () => {
  const sessions = [
    ses('2026-10-01', { sets: [{ exercise: 'Tuck planche', setIndex: 1, value: '10', unit: 'sec', bloqueOrden: 0, orden: 0 }] }),
    ses('2026-10-10', { sets: [{ exercise: 'Tuck planche', setIndex: 1, value: '15', unit: 'sec', bloqueOrden: 0, orden: 0 }] }),
    ses('2026-10-12', { sets: [{ exercise: 'Dominadas pronas', setIndex: 1, value: '6', unit: 'reps', bloqueOrden: 0, orden: 0 }] }),
    ses('2026-10-19', { sets: [{ exercise: 'Dominadas pronas', setIndex: 1, value: '8', unit: 'reps', bloqueOrden: 0,orden: 0 }] }),
  ];

  it('collects marks from logged session sets', () => {
    const marks = collectMarks(sessions, []);
    expect(marks).toHaveLength(4);
    expect(marks[0]).toMatchObject({ exercise: 'Tuck planche', value: 10, unit: 'sec', source: 'sesion' });
  });

  it('collects explicit marks', () => {
    const marks = collectMarks([], [
      { id: 'mark-mock', updatedAt: '2026-10-15T12:00:00.000Z', exercise: 'Flexiones', unit: 'reps', value: 20, date: '2026-10-15', mesoInicio: '2026-10-01' },
    ]);
    expect(marks[0]).toMatchObject({ exercise: 'Flexiones', value: 20, unit: 'reps', source: 'marca', date: '2026-10-15' });
  });

  it('keeps the best value per exercise and the previous best as delta', () => {
    const best = bestMarks(collectMarks(sessions, []), '2026-10-20');
    const planche = best.find((m) => m.exercise === 'Tuck planche')!;
    expect(planche.value).toBe(15);
    expect(planche.previous).toBe(10);
    expect(planche.delta).toBe(5);
    expect(planche.date).toBe('2026-10-10');
  });

  it('marks records from the last seven days as fresh', () => {
    const best = bestMarks(collectMarks(sessions, []), '2026-10-20');
    expect(best.find((m) => m.exercise === 'Dominadas pronas')!.isFresh).toBe(true);
    expect(best.find((m) => m.exercise === 'Tuck planche')!.isFresh).toBe(false);
  });

  it('does not mix seconds and reps of the same exercise', () => {
    const mixed = [
      ...sessions,
      ses('2026-10-11', { sets: [{ exercise: 'Tuck planche', setIndex: 1, value: '40', unit: 'reps', bloqueOrden: 0, orden: 0 }] }),
    ];
    const best = bestMarks(collectMarks(mixed, []), '2026-10-20');
    expect(best.filter((m) => m.exercise === 'Tuck planche')).toHaveLength(2);
  });

  it('orders skills before basics', () => {
    const best = bestMarks(collectMarks(sessions, []), '2026-10-20');
    expect(best.map((m) => m.exercise)).toEqual(['Tuck planche', 'Dominadas pronas']);
  });

  it('classifies the group of the exercise', () => {
    const best = bestMarks(collectMarks(sessions, []), '2026-10-20');
    expect(best.find((m) => m.exercise === 'Tuck planche')!.group).toBe('skill');
    expect(best.find((m) => m.exercise === 'Dominadas pronas')!.group).toBe('basico');
  });
});

describe('computeGoals', () => {
  it('computes percentage and reached state', () => {
    const goals = computeGoals(
      [{ goalId: 'g1', current: 15 }],
      [{ goal: { id: 'g1', name: 'Flexiones', unit: 'reps', target: 30 }, program: 'Fuerza' }],
    );
    expect(goals[0]).toMatchObject({ current: 15, target: 30, pct: 50, reached: false });
  });

  it('marks a goal as reached and caps the percentage at 100', () => {
    const goals = computeGoals(
      [{ goalId: 'g1', current: 40 }],
      [{ goal: { id: 'g1', name: 'Flexiones', unit: 'reps', target: 30 }, program: 'Fuerza' }],
    );
    expect(goals[0]).toMatchObject({ pct: 100, reached: true });
  });

  it('defaults to zero when no current value was recorded', () => {
    const goals = computeGoals([], [
      { goal: { id: 'g1', name: 'Flexiones', unit: 'reps', target: 30 }, program: 'Fuerza' },
    ]);
    expect(goals[0]).toMatchObject({ current: 0, pct: 0, reached: false });
  });
});

describe('planDistribution', () => {
  it('counts sessions per plan and sorts by count', () => {
    const sessions = [ses('2026-10-19', { planId: 'a' }), ses('2026-10-18', { planId: 'a' }), ses('2026-10-17', { planId: 'b' })];
    const dist = planDistribution(sessions, { start: '2026-10-01', end: '2026-10-20' });
    expect(dist[0]).toMatchObject({ planId: 'a', count: 2 });
    expect(dist[1]).toMatchObject({ planId: 'b', count: 1 });
    expect(dist[0].pct).toBe(67);
  });

  it('ignores sessions outside the window', () => {
    const sessions = [ses('2026-09-01', { planId: 'a' }), ses('2026-10-19', { planId: 'b' })];
    const dist = planDistribution(sessions, { start: '2026-10-01', end: '2026-10-20' });
    expect(dist).toHaveLength(1);
    expect(dist[0].planId).toBe('b');
  });
});

describe('delta', () => {
  it('signs the difference between two values', () => {
    expect(delta(5, 3)).toBe('+2');
    expect(delta(3, 5)).toBe('−2');
    expect(delta(3, 3)).toBe('0');
  });

  it('has no direction without a previous value', () => {
    expect(delta(3, null)).toBe('—');
  });
});

describe('compareSessions', () => {
  const sessions = [
    ses('2026-10-01', {
      planId: 'a',
      durationSec: 1800,
      sets: [{ exercise: 'Tuck planche', setIndex: 1, value: '10', unit: 'sec', bloqueOrden: 0, orden: 0 }],
    }),
    ses('2026-10-05', {
      planId: 'a',
      durationSec: 2400,
      sets: [{ exercise: 'Tuck planche', setIndex: 1, value: '15', unit: 'sec', bloqueOrden: 0, orden: 0 }],
    }),
    ses('2026-10-06', {
      planId: 'a',
      durationSec: 2400,
      sets: [
        { exercise: 'Tuck planche', setIndex: 1, value: '15', unit: 'sec', bloqueOrden: 0, orden: 0 },
        { exercise: 'Flexiones', setIndex: 1, value: '20', unit: 'reps', bloqueOrden: 1, orden: 0 },
      ],
    }),
    ses('2026-10-07', { planId: 'a', durationSec: 1200, sets: [] }),
  ];

  it('has no comparison for the first session', () => {
    const [first] = compareSessions(sessions);
    expect(first.previous).toBeNull();
    expect(first.gained).toBeNull();
    expect(first.durationDelta).toBeNull();
  });

  it('compares each session against the previous one of the same plan', () => {
    const all = compareSessions(sessions);
    expect(all[1].previous?.date).toBe('2026-10-01');
    expect(all[1].durationDelta).toBe(10);
    expect(all[1].gained).toBe(true);
  });

  it('marks a session as lost when it lasted less than the previous one', () => {
    const all = compareSessions(sessions);
    expect(all[3].durationDelta).toBe(-20);
    expect(all[3].gained).toBe(false);
  });

  it('marks a session as gained when it kept the time and added series', () => {
    const all = compareSessions(sessions);
    expect(all[2].durationDelta).toBe(0);
    expect(all[2].seriesDelta).toBe(1);
    expect(all[2].gained).toBe(true);
  });

  it('detects the new bests of each session', () => {
    const all = compareSessions(sessions);
    expect(all[0].newBests).toEqual([]);
    expect(all[1].newBests).toEqual(['Tuck planche']);
    expect(all[2].newBests).toEqual([]);
    expect(all[3].newBests).toEqual([]);
  });

  it('summarizes the work of a session', () => {
    const [first] = compareSessions(sessions);
    expect(first.summary).toMatchObject({ durationMin: 30, series: 1, seconds: 10, reps: 0 });
  });
});

describe('exerciseSeries', () => {
  it('groups the values of an exercise over time and counts the improvements', () => {
    const entries = collectMarks(
      [
        ses('2026-10-01', { sets: [{ exercise: 'Tuck planche', setIndex: 1, value: '10', unit: 'sec', bloqueOrden: 0, orden: 0 }] }),
        ses('2026-10-05', { sets: [{ exercise: 'Tuck planche', setIndex: 1, value: '15', unit: 'sec', bloqueOrden: 0, orden: 0 }] }),
        ses('2026-10-06', { sets: [{ exercise: 'Tuck planche', setIndex: 1, value: '12', unit: 'sec', bloqueOrden: 0, orden: 0 }] }),
      ],
      [],
    );
    const series = exerciseSeries(entries);
    expect(series).toHaveLength(1);
    expect(series[0]).toMatchObject({ exercise: 'Tuck planche', unit: 'sec', best: 15, improvements: 2 });
    expect(series[0].points.map((p) => p.value)).toEqual([10, 15, 12]);
  });

  it('orders the exercises by how many times they improved', () => {
    const entries = collectMarks(
      [
        ses('2026-10-01', {
          sets: [
            { exercise: 'Tuck planche', setIndex: 1, value: '10', unit: 'sec', bloqueOrden: 0, orden: 0 },
            { exercise: 'Flexiones', setIndex: 1, value: '10', unit: 'reps', bloqueOrden: 1, orden: 0 },
          ],
        }),
        ses('2026-10-05', {
          sets: [
            { exercise: 'Tuck planche', setIndex: 1, value: '12', unit: 'sec', bloqueOrden: 0, orden: 0 },
            { exercise: 'Tuck planche', setIndex: 2, value: '14', unit: 'sec', bloqueOrden: 0, orden: 0 },
            { exercise: 'Flexiones', setIndex: 1, value: '12', unit: 'reps', bloqueOrden: 1, orden: 0 },
          ],
        }),
      ],
      [],
    );
    const series = exerciseSeries(entries);
    expect(series[0].exercise).toBe('Tuck planche');
    expect(series[0].improvements).toBe(3);
    expect(series[1].exercise).toBe('Flexiones');
    expect(series[1].improvements).toBe(2);
  });
});

describe('anchorProgress', () => {
  const anchors = dedupeAnchors([
    { ejercicio: 'Dominadas pronas', unidad: 'reps', objetivo: 10 },
    { ejercicio: 'Flexiones', unidad: 'reps', objetivo: 15 },
    { ejercicio: 'Flexiones en pica', unidad: 'reps', objetivo: 8 },
    { ejercicio: 'Tuck planche', unidad: 'sec', objetivo: 10 },
  ]);

  it('keeps the hardest target when an anchor is repeated', () => {
    expect(anchors).toHaveLength(4);
  });

  it('gives a record to the most specific anchor', () => {
    const entries = collectMarks(
      [
        ses('2026-10-01', { sets: [{ exercise: 'Flexiones en pica (pies en altura)', setIndex: 1, value: '8', unit: 'reps', bloqueOrden: 0, orden: 0 }] }),
        ses('2026-10-02', { sets: [{ exercise: 'Flexiones en suelo', setIndex: 1, value: '12', unit: 'reps', bloqueOrden: 0, orden: 0 }] }),
      ],
      [],
    );
    const progress = anchorProgress(anchors, entries);
    const pica = progress.find((p) => p.exercise === 'Flexiones en pica')!;
    const flexiones = progress.find((p) => p.exercise === 'Flexiones')!;
    expect(pica.current).toBe(8);
    expect(flexiones.current).toBe(12);
  });

  it('computes the percentage and the reached state', () => {
    const entries = collectMarks(
      [ses('2026-10-01', { sets: [{ exercise: 'Tuck planche', setIndex: 1, value: '12', unit: 'sec', bloqueOrden: 0, orden: 0 }] })],
      [],
    );
    const progress = anchorProgress(anchors, entries);
    const planche = progress.find((p) => p.exercise === 'Tuck planche')!;
    expect(planche).toMatchObject({ current: 12, target: 10, pct: 100, reached: true, source: 'Tuck planche' });
  });

  it('leaves an anchor without records at zero', () => {
    const progress = anchorProgress(anchors, []);
    expect(progress.find((p) => p.exercise === 'Tuck planche')).toMatchObject({ current: 0, pct: 0, source: null });
  });

  it('does not mix units', () => {
    const entries = collectMarks(
      [ses('2026-10-01', { sets: [{ exercise: 'Tuck planche', setIndex: 1, value: '12', unit: 'reps', bloqueOrden: 0, orden: 0 }] })],
      [],
    );
    const progress = anchorProgress(anchors, entries);
    expect(progress.find((p) => p.exercise === 'Tuck planche')!.current).toBe(0);
  });

  it('matches records through the match prefix of the anchor', () => {
    const withMatch = dedupeAnchors([
      {
        ejercicio: 'Handstand pared',
        ejercicioId: 'handstand-pared',
        match: 'Hold de pino en pared',
        unidad: 'sec' as const,
        objetivo: 30,
      },
    ]);
    const entries = collectMarks(
      [
        ses('2026-10-01', {
          sets: [{ exercise: 'Hold de pino en pared (talones apoyados)', setIndex: 1, value: '20', unit: 'sec', bloqueOrden: 0, orden: 0 }],
        }),
      ],
      [],
    );
    expect(anchorProgress(withMatch, entries)[0]).toMatchObject({
      current: 20,
      source: 'Hold de pino en pared (talones apoyados)',
    });
  });
});

describe('matchesAnchor', () => {
  const planche: AnchorLike = { ejercicio: 'Tuck planche', unidad: 'sec', objetivo: 10 };
  const entry = (over: Partial<MarkEntry> = {}): MarkEntry => ({
    exercise: 'Tuck planche',
    value: 8,
    unit: 'sec',
    date: '2026-10-01',
    source: 'sesion',
    ...over,
  });

  it('matches an entry of the same unit whose name starts with the anchor name', () => {
    expect(matchesAnchor(planche, entry({ exercise: 'Tuck planche (progresión)' }))).toBe(true);
  });

  it('rejects an entry measured in another unit', () => {
    expect(matchesAnchor(planche, entry({ unit: 'reps' }))).toBe(false);
  });

  it('rejects an entry for an exercise the anchor does not name', () => {
    expect(matchesAnchor(planche, entry({ exercise: 'Flexiones Diamante', unit: 'reps' }))).toBe(false);
  });

  it('uses the match prefix when the anchor declares one', () => {
    const handstand: AnchorLike = {
      ejercicio: 'Handstand pared',
      match: 'Hold de pino en pared',
      unidad: 'sec',
      objetivo: 30,
    };
    expect(matchesAnchor(handstand, entry({ exercise: 'Hold de pino en pared (talones apoyados)' }))).toBe(true);
  });
});

describe('anchoredEntries', () => {
  const anchors = dedupeAnchors([
    { ejercicio: 'Dominadas pronas', unidad: 'reps' as const, objetivo: 10 },
    { ejercicio: 'Tuck planche', unidad: 'sec' as const, objetivo: 10 },
  ]);
  const entries = collectMarks(
    [
      ses('2026-10-01', {
        sets: [
          { exercise: 'Flexiones Diamante', setIndex: 1, value: '12', unit: 'reps', bloqueOrden: 0, orden: 0 },
          { exercise: 'Tuck planche', setIndex: 1, value: '8', unit: 'sec', bloqueOrden: 1, orden: 0 },
        ],
      }),
      ses('2026-10-02', {
        sets: [{ exercise: 'Tuck planche', setIndex: 1, value: '12', unit: 'reps', bloqueOrden: 0, orden: 0 }],
      }),
    ],
    [
      {
        id: 'mark-1',
        updatedAt: '2026-10-03T12:00:00.000Z',
        exercise: 'Dominadas pronas',
        unit: 'reps',
        value: 9,
        mesoInicio: '2026-10',
        date: '2026-10-03',
      },
    ],
  );

  it('leaves out of the marks panel an exercise no anchor measures', () => {
    const panel = bestMarks(anchoredEntries(anchors, entries), '2026-10-20');
    expect(panel.map((m) => m.exercise).sort()).toEqual(['Dominadas pronas', 'Tuck planche']);
  });

  it('leaves out of the evolution panel an exercise no anchor measures', () => {
    const panel = exerciseSeries(anchoredEntries(anchors, entries));
    expect(panel.map((s) => s.exercise).sort()).toEqual(['Dominadas pronas', 'Tuck planche']);
  });

  it('keeps every record of an exercise the anchors measure', () => {
    expect(anchoredEntries(anchors, entries).map((e) => `${e.exercise}|${e.unit}`)).toEqual([
      'Tuck planche|sec',
      'Dominadas pronas|reps',
    ]);
  });
});
describe('unitForExercise', () => {
  it('reads the unit from the plan catalog', () => {
    expect(unitForExercise('Tuck planche')).toBe('sec');
    expect(unitForExercise('Dominadas pronas')).toBe('reps');
  });

  it('falls back to reps for an exercise outside the catalog', () => {
    expect(unitForExercise('Ejercicio inventado')).toBe('reps');
  });
});

describe('deriveGoal', () => {
  const entries = collectMarks(
    [
      ses('2026-10-01', { sets: [{ exercise: 'Plank', setIndex: 1, value: '45', unit: 'sec', bloqueOrden: 0, orden: 0 }] }),
      ses('2026-10-05', { sets: [{ exercise: 'Plank', setIndex: 1, value: '52', unit: 'sec', bloqueOrden: 0, orden: 0 }] }),
      ses('2026-10-06', {
        sets: [{ exercise: 'Nado en suelo (movilidad de hombros)', setIndex: 1, value: '10', unit: 'reps', bloqueOrden: 0, orden: 0 }],
      }),
    ],
    [],
  );

  it('derives a value goal from the best matching record', () => {
    const goal = deriveGoal({ name: 'Hold plank', unit: 'sec' }, 'cardio-casa', entries, []);
    expect(goal).toEqual({ value: 52, source: 'Plank', kind: 'registro' });
  });

  it('ignores records measured in another unit', () => {
    const goal = deriveGoal({ name: 'Hold plank', unit: 'reps' }, 'cardio-casa', entries, []);
    expect(goal.kind).toBe('sin');
    expect(goal.value).toBe(0);
  });

  it('does not match an exercise that only mentions the word', () => {
    const goal = deriveGoal({ name: 'Flexiones', unit: 'reps' }, 'cardio-casa', entries, []);
    expect(goal.kind).toBe('sin');
  });

  it('counts the sessions of the program for count goals', () => {
    const sessions = [
      ses('2026-10-01', { planId: 'cardio-casa' }),
      ses('2026-10-02', { planId: 'cardio-casa' }),
      ses('2026-10-03', { planId: 'otro-plan' }),
    ];
    const goal = deriveGoal({ name: 'Completar sesiones', unit: 'reps' }, 'cardio-casa', entries, sessions);
    expect(goal).toEqual({ value: 2, source: null, kind: 'sesiones' });
  });

  it('counts the sessions of the program for day goals', () => {
    const sessions = [ses('2026-10-01', { planId: 'movilidad-general' })];
    const goal = deriveGoal({ name: 'Días de movilidad', unit: 'reps' }, 'movilidad-general', entries, sessions);
    expect(goal).toEqual({ value: 1, source: null, kind: 'sesiones' });
  });
});
