import { describe, it, expect } from 'vitest';
import { measureRows, seriesRows, volumeRows, weekValue } from './chartData';
import type { ExercisePoint, WeekVolume } from './metrics';

const week = (over: Partial<WeekVolume> & { label: string }): WeekVolume => ({
  start: '2026-10-05',
  minutes: 0,
  sessions: 0,
  current: false,
  ...over,
});

const point = (date: string, value: number): ExercisePoint => ({ date, value });

describe('weekValue', () => {
  it('plots minutes for the minutes panel and sessions for the sessions panel', () => {
    const w = week({ label: '05/10', minutes: 120, sessions: 3 });
    expect(weekValue(w, 'min')).toBe(120);
    expect(weekValue(w, 'sesiones')).toBe(3);
  });
});

describe('volumeRows', () => {
  const weeks = [
    week({ label: '05/10', minutes: 120, sessions: 3 }),
    week({ label: '12/10', minutes: 90, sessions: 2, current: true }),
  ];

  it('gives every weekly bar a row with its week label and its value in minutes', () => {
    expect(volumeRows(weeks, 'min')).toEqual([
      { label: '05/10', value: 120, unit: 'min' },
      { label: '12/10', value: 90, unit: 'min' },
    ]);
  });

  it('counts sessions when the panel measures sessions', () => {
    expect(volumeRows(weeks, 'sesiones')).toEqual([
      { label: '05/10', value: 3, unit: 'sesiones' },
      { label: '12/10', value: 2, unit: 'sesiones' },
    ]);
  });

  it('yields no rows for an empty series', () => {
    expect(volumeRows([], 'min')).toEqual([]);
  });
});

describe('measureRows', () => {
  const bars = [
    { label: '12/10', amount: 45, marker: 'lime' as const },
    { label: '14/10', amount: 50 },
  ];

  it('gives every session bar a row with its date label and its value', () => {
    expect(measureRows(bars, 'min')).toEqual([
      { label: '12/10', value: 45, unit: 'min' },
      { label: '14/10', value: 50, unit: 'min' },
    ]);
  });

  it('carries the series unit when the panel measures series', () => {
    expect(measureRows(bars, 'series').map((row) => row.unit)).toEqual(['series', 'series']);
  });

  it('yields no rows for an empty series', () => {
    expect(measureRows([], 'min')).toEqual([]);
  });
});

describe('seriesRows', () => {
  const points = [point('2026-09-28', 40), point('2026-10-12', 55)];

  it('names the date of every point, the only thing the sparkline hides', () => {
    expect(seriesRows(points, 'seg')).toEqual([
      { label: '28/09/2026', value: 40, unit: 'seg' },
      { label: '12/10/2026', value: 55, unit: 'seg' },
    ]);
  });

  it('keeps two records of the same day as two rows', () => {
    expect(seriesRows([point('2026-10-12', 40), point('2026-10-12', 55)], 'reps')).toEqual([
      { label: '12/10/2026', value: 40, unit: 'reps' },
      { label: '12/10/2026', value: 55, unit: 'reps' },
    ]);
  });

  it('yields no rows for an empty series', () => {
    expect(seriesRows([], 'seg')).toEqual([]);
  });
});
