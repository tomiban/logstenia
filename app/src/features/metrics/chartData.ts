// Pure derivations for the tables that stand in for the charts on /metrics.
// The screen reader gets the same numbers as the SVG, so the mapping lives
// outside React and is covered by tests.

import type { ExercisePoint, WeekVolume } from './metrics';

export type VolumeUnit = 'min' | 'sesiones';

export interface ChartRow {
  /** Stable identity of the datum behind the row, independent of its position. */
  id: string;
  label: string;
  value: number;
  unit: string;
}

function rowsOf(
  items: readonly { id: string; label: string; value: number }[],
  unit: string,
): ChartRow[] {
  return items
    .filter((item) => Number.isFinite(item.value))
    .map((item) => ({ id: item.id, label: item.label, value: item.value, unit }));
}

/** Value a weekly bar plots, chosen by the unit the panel shows. */
export function weekValue(week: WeekVolume, unit: VolumeUnit): number {
  return unit === 'min' ? week.minutes : week.sessions;
}

/** One row per weekly bar: the week label the axis prints and the value it plots. */
export function volumeRows(weeks: readonly WeekVolume[], unit: VolumeUnit): ChartRow[] {
  return rowsOf(
    weeks.map((week) => ({ id: week.start, label: week.label, value: weekValue(week, unit) })),
    unit,
  );
}

/** One row per session bar: the date label the axis prints and the value it plots. */
export function measureRows(
  bars: readonly { id: string; label: string; amount: number }[],
  unit: string,
): ChartRow[] {
  return rowsOf(
    bars.map((bar) => ({ id: bar.id, label: bar.label, value: bar.amount })),
    unit,
  );
}

/** Day, month and year, so a record stays locatable when the history spans years. */
export function fullDayLabel(isoDay: string): string {
  const [year, month, day] = isoDay.split('-');
  return `${day}/${month}/${year}`;
}

/** One row per sparkline point, dated: the axis of the sparkline is hidden. */
export function seriesRows(points: readonly ExercisePoint[], unit: string): ChartRow[] {
  // Two marks of the same exercise and unit can land on the same day, and the points carry no
  // identity of their own; the occurrence within that day is what tells them apart.
  const seen = new Map<string, number>();
  return rowsOf(
    points.map((point) => {
      const base = `${point.date}|${unit}`;
      const occurrence = (seen.get(base) ?? 0) + 1;
      seen.set(base, occurrence);
      return {
        id: `${base}|${occurrence}`,
        label: fullDayLabel(point.date),
        value: point.value,
      };
    }),
    unit,
  );
}
