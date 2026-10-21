import { describe, it, expect } from 'vitest';
import {
  addDays,
  windowsFor,
  computeTelemetry,
  weeklyVolume,
  collectMarks,
  bestMarks,
  computeGoals,
  planDistribution,
  delta,
} from './metrics';
import type { SessionRecord } from '../db';

const ses = (date: string, over: Partial<SessionRecord> = {}): SessionRecord => ({
  date,
  planId: 'p1',
  modelId: 'm1',
  durationSec: 3600,
  completed: true,
  ...over,
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
      { exercise: 'Flexiones', unit: 'reps', value: 20, date: '2026-10-15', mesoInicio: '2026-10-01' },
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
