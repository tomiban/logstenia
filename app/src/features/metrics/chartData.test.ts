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
    week({ start: '2026-10-05', label: '05/10', minutes: 120, sessions: 3 }),
    week({ start: '2026-10-12', label: '12/10', minutes: 90, sessions: 2, current: true }),
  ];

  it('gives every weekly bar a row with its week label and its value in minutes', () => {
    expect(volumeRows(weeks, 'min')).toEqual([
      { id: '2026-10-05', label: '05/10', value: 120, unit: 'min' },
      { id: '2026-10-12', label: '12/10', value: 90, unit: 'min' },
    ]);
  });

  it('counts sessions when the panel measures sessions', () => {
    expect(volumeRows(weeks, 'sesiones')).toEqual([
      { id: '2026-10-05', label: '05/10', value: 3, unit: 'sesiones' },
      { id: '2026-10-12', label: '12/10', value: 2, unit: 'sesiones' },
    ]);
  });

  it('identifies a week by its own start date, not by the label the axis prints', () => {
    const rows = volumeRows(
      [
        week({ start: '2025-10-05', label: '05/10', minutes: 60 }),
        week({ start: '2026-10-05', label: '05/10', minutes: 60 }),
      ],
      'min',
    );
    expect(rows.map((row) => row.id)).toEqual(['2025-10-05', '2026-10-05']);
  });

  it('yields no rows for an empty series', () => {
    expect(volumeRows([], 'min')).toEqual([]);
  });
});

describe('measureRows', () => {
  const bars = [
    { id: 'sesion-1', label: '12/10', amount: 45, marker: 'lime' as const },
    { id: 'sesion-2', label: '14/10', amount: 50 },
  ];

  it('gives every session bar a row with its date label and its value', () => {
    expect(measureRows(bars, 'min')).toEqual([
      { id: 'sesion-1', label: '12/10', value: 45, unit: 'min' },
      { id: 'sesion-2', label: '14/10', value: 50, unit: 'min' },
    ]);
  });

  it('carries the series unit when the panel measures series', () => {
    expect(measureRows(bars, 'series').map((row) => row.unit)).toEqual(['series', 'series']);
  });

  it('keeps two sessions of the same day with the same value as two rows with different ids', () => {
    const rows = measureRows(
      [
        { id: 'sesion-1', label: '12/10', amount: 45 },
        { id: 'sesion-2', label: '12/10', amount: 45 },
      ],
      'min',
    );
    expect(rows).toHaveLength(2);
    expect(rows[0].id).not.toBe(rows[1].id);
  });

  it('yields no rows for an empty series', () => {
    expect(measureRows([], 'min')).toEqual([]);
  });
});

describe('seriesRows', () => {
  const points = [point('2026-09-28', 40), point('2026-10-12', 55)];

  it('names the date of every point, the only thing the sparkline hides', () => {
    expect(seriesRows(points, 'seg')).toEqual([
      { id: '2026-09-28|seg|1', label: '28/09/2026', value: 40, unit: 'seg' },
      { id: '2026-10-12|seg|1', label: '12/10/2026', value: 55, unit: 'seg' },
    ]);
  });

  it('keeps two records of the same day as two rows', () => {
    expect(seriesRows([point('2026-10-12', 40), point('2026-10-12', 55)], 'reps')).toEqual([
      { id: '2026-10-12|reps|1', label: '12/10/2026', value: 40, unit: 'reps' },
      { id: '2026-10-12|reps|2', label: '12/10/2026', value: 55, unit: 'reps' },
    ]);
  });

  it('identifies a point by its own date and the unit it measures', () => {
    const [seconds] = seriesRows([point('2026-10-12', 40)], 'seg');
    const [reps] = seriesRows([point('2026-10-12', 40)], 'reps');
    expect(seconds.id).not.toBe(reps.id);
  });

  it('yields no rows for an empty series', () => {
    expect(seriesRows([], 'seg')).toEqual([]);
  });
});
