// Pure derivations for the metrics screen.
// No database access: takes data in, returns numbers. Testable in isolation.

import { clasificar, type Grupo, type Subgrupo } from './clasificar';
import { allModels, getProgram } from './plans';
import type { SessionRecord, MarkRecord } from '../db';
import type { Goal } from '../types';

export type RangeKey = '7d' | '30d' | '90d' | 'all';

export interface RangeOption {
  key: RangeKey;
  short: string;
  label: string;
  days: number | null;
}

export const RANGE_OPTIONS: RangeOption[] = [
  { key: '7d', short: '7 D', label: 'últimos 7 días', days: 7 },
  { key: '30d', short: '30 D', label: 'últimos 30 días', days: 30 },
  { key: '90d', short: '90 D', label: 'últimos 90 días', days: 90 },
  { key: 'all', short: 'TODO', label: 'todo el historial', days: null },
];

/** Days that count as a fresh record worth highlighting. */
export const FRESH_DAYS = 7;

export interface DayWindow {
  start: string; // inclusive, YYYY-MM-DD
  end: string; // inclusive, YYYY-MM-DD
}

export interface RangeWindows {
  current: DayWindow;
  previous: DayWindow | null;
  days: number | null;
}

export function addDays(isoDay: string, n: number): string {
  const [y, m, d] = isoDay.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) + n * 86400000).toISOString().slice(0, 10);
}

export function inWindow(day: string, w: DayWindow): boolean {
  return day >= w.start && day <= w.end;
}

export function windowsFor(range: RangeKey, today: string, earliest?: string): RangeWindows {
  if (range === 'all') {
    return { current: { start: earliest ?? today, end: today }, previous: null, days: null };
  }
  const days = RANGE_OPTIONS.find((o) => o.key === range)?.days ?? 30;
  return {
    current: { start: addDays(today, -(days - 1)), end: today },
    previous: { start: addDays(today, -(2 * days - 1)), end: addDays(today, -days) },
    days,
  };
}

export interface Telemetry {
  sessions: number;
  minutes: number;
  avgMinutes: number;
  prevSessions: number | null;
  prevMinutes: number | null;
  prevAvgMinutes: number | null;
  streak: number;
  bestStreak: number;
}

function minutesOf(list: SessionRecord[]): number {
  return Math.round(list.reduce((a, s) => a + (s.durationSec || 0), 0) / 60);
}

function averageOf(list: SessionRecord[]): number {
  const timed = list.filter((s) => (s.durationSec || 0) > 0);
  if (timed.length === 0) return 0;
  return Math.round(minutesOf(timed) / timed.length);
}

export function currentStreak(days: Set<string>, today: string): number {
  let streak = 0;
  let day = days.has(today) ? today : addDays(today, -1);
  while (days.has(day)) {
    streak++;
    day = addDays(day, -1);
  }
  return streak;
}

export function bestStreak(days: string[]): number {
  const sorted = [...new Set(days)].sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const day of sorted) {
    run = prev !== null && addDays(prev, 1) === day ? run + 1 : 1;
    best = Math.max(best, run);
    prev = day;
  }
  return best;
}

export function computeTelemetry(sessions: SessionRecord[], win: RangeWindows): Telemetry {
  const today = win.current.end;
  const inCurrent = sessions.filter((s) => inWindow(s.date, win.current));
  const previous = win.previous;
  const inPrevious = previous ? sessions.filter((s) => inWindow(s.date, previous)) : null;
  const daySet = new Set(sessions.map((s) => s.date));
  return {
    sessions: inCurrent.length,
    minutes: minutesOf(inCurrent),
    avgMinutes: averageOf(inCurrent),
    prevSessions: inPrevious ? inPrevious.length : null,
    prevMinutes: inPrevious ? minutesOf(inPrevious) : null,
    prevAvgMinutes: inPrevious ? averageOf(inPrevious) : null,
    streak: currentStreak(daySet, today),
    bestStreak: bestStreak(sessions.map((s) => s.date)),
  };
}

export interface WeekVolume {
  start: string; // monday of the week
  label: string; // dd/mm
  minutes: number;
  sessions: number;
  current: boolean;
}

function mondayOf(isoDay: string): string {
  const [y, m, d] = isoDay.split('-').map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = sunday
  return addDays(isoDay, -((weekday + 6) % 7));
}

function dayLabel(isoDay: string): string {
  const [, m, d] = isoDay.split('-');
  return `${d}/${m}`;
}

export function weeklyVolume(sessions: SessionRecord[], weeks: number, today: string): WeekVolume[] {
  const thisMonday = mondayOf(today);
  const buckets: WeekVolume[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const start = addDays(thisMonday, -7 * i);
    buckets.push({ start, label: dayLabel(start), minutes: 0, sessions: 0, current: i === 0 });
  }
  const index = new Map(buckets.map((b) => [b.start, b]));
  const seconds = new Map(buckets.map((b) => [b.start, 0]));
  for (const s of sessions) {
    const key = mondayOf(s.date);
    const bucket = index.get(key);
    if (!bucket) continue;
    bucket.sessions += 1;
    seconds.set(key, (seconds.get(key) ?? 0) + (s.durationSec || 0));
  }
  buckets.forEach((b) => {
    b.minutes = Math.round((seconds.get(b.start) ?? 0) / 60);
  });
  return buckets;
}

export type MarkSource = 'sesion' | 'marca' | 'registro';

export interface MarkEntry {
  exercise: string;
  value: number;
  unit: 'sec' | 'reps';
  date: string;
  source: MarkSource;
}

export interface ProgressRecordLike {
  exerciseId: string;
  week: string;
  value: number;
  date: string;
}

/** Exercise unit taken from the plan catalog, so manual records can be compared. */
const EXERCISE_UNITS = new Map<string, 'sec' | 'reps'>();
for (const { model } of allModels()) {
  for (const block of model.blocks) {
    for (const ex of block.exercises) {
      const unit: 'sec' | 'reps' = ex.timeSec && !ex.reps ? 'sec' : 'reps';
      const key = normalizeExercise(ex.name);
      if (unit === 'sec' || !EXERCISE_UNITS.has(key)) EXERCISE_UNITS.set(key, unit);
    }
  }
}

export function unitForExercise(exercise: string): 'sec' | 'reps' {
  return EXERCISE_UNITS.get(normalizeExercise(exercise)) ?? 'reps';
}

export interface BestMark extends MarkEntry {
  previous: number | null;
  delta: number | null;
  isFresh: boolean;
  group: Grupo;
  subgroup: Subgrupo;
}

function normalizeExercise(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function collectMarks(
  sessions: SessionRecord[],
  marks: MarkRecord[],
  progress: ProgressRecordLike[] = [],
): MarkEntry[] {
  const out: MarkEntry[] = [];
  for (const s of sessions) {
    for (const set of s.sets ?? []) {
      const value = Number(set.value);
      if (!Number.isFinite(value) || value <= 0) continue;
      out.push({
        exercise: set.exercise,
        value,
        unit: set.unit,
        date: s.date.slice(0, 10),
        source: 'sesion',
      });
    }
  }
  for (const m of marks) {
    if (!Number.isFinite(m.value) || m.value <= 0) continue;
    out.push({
      exercise: m.exercise,
      value: m.value,
      unit: m.unit,
      date: m.date.slice(0, 10),
      source: 'marca',
    });
  }
  for (const p of progress) {
    if (!Number.isFinite(p.value) || p.value <= 0) continue;
    out.push({
      exercise: p.exerciseId,
      value: p.value,
      unit: unitForExercise(p.exerciseId),
      date: p.date.slice(0, 10),
      source: 'registro',
    });
  }
  return out;
}

export function bestMarks(entries: MarkEntry[], today: string): BestMark[] {
  const freshStart = addDays(today, -(FRESH_DAYS - 1));
  const groups = new Map<string, MarkEntry[]>();
  for (const e of entries) {
    const key = `${normalizeExercise(e.exercise)}|${e.unit}`;
    const list = groups.get(key);
    if (list) list.push(e);
    else groups.set(key, [e]);
  }

  const out: BestMark[] = [];
  for (const list of groups.values()) {
    const sorted = [...list].sort((a, b) => a.value - b.value || (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    const best = sorted[sorted.length - 1];
    const previousValue = [...sorted].reverse().find((e) => e.value < best.value)?.value ?? null;
    const { grupo, sub } = clasificar(best.exercise);
    out.push({
      ...best,
      previous: previousValue,
      delta: previousValue === null ? null : best.value - previousValue,
      isFresh: best.date >= freshStart && best.date <= today,
      group: grupo,
      subgroup: sub,
    });
  }

  return out.sort((a, b) => {
    if (a.group !== b.group) return a.group === 'skill' ? -1 : 1;
    if (a.isFresh !== b.isFresh) return a.isFresh ? -1 : 1;
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return a.exercise.localeCompare(b.exercise);
  });
}

export interface GoalProgress {
  id: string;
  name: string;
  unit: 'sec' | 'reps';
  target: number;
  current: number;
  pct: number;
  reached: boolean;
  program: string;
}

const GOAL_STOPWORDS = new Set([
  'de', 'del', 'la', 'el', 'los', 'las', 'y', 'en', 'un', 'una', 'a', 'al',
  'por', 'para', 'con', 'dia', 'dias', 'hold', 'holds',
]);

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function goalCoreToken(goalName: string): string | null {
  const tokens = normalizeText(goalName)
    .split(' ')
    .filter((t) => t.length >= 4 && !GOAL_STOPWORDS.has(t));
  if (tokens.length === 0) return null;
  return tokens.reduce((longest, t) => (t.length > longest.length ? t : longest), tokens[0]);
}

export interface GoalDerivation {
  value: number;
  source: string | null;
  kind: 'registro' | 'sesiones' | 'sin';
}

/**
 * Derives a goal's current value from what was actually trained:
 * count goals ("Completar sesiones") from the sessions of their program,
 * value goals ("Hold plank") from the best matching record.
 */
export function deriveGoal(
  goal: { name: string; unit: 'sec' | 'reps' },
  programId: string,
  entries: MarkEntry[],
  sessions: SessionRecord[],
): GoalDerivation {
  const name = normalizeText(goal.name);
  if (name.includes('sesion') || name.includes('dia')) {
    const count = sessions.filter((s) => s.planId === programId).length;
    return { value: count, source: null, kind: 'sesiones' };
  }
  const token = goalCoreToken(goal.name);
  if (!token) return { value: 0, source: null, kind: 'sin' };
  let best: MarkEntry | null = null;
  for (const entry of entries) {
    if (entry.unit !== goal.unit) continue;
    if (!normalizeText(entry.exercise).startsWith(token)) continue;
    if (!best || entry.value > best.value) best = entry;
  }
  return best ? { value: best.value, source: best.exercise, kind: 'registro' } : { value: 0, source: null, kind: 'sin' };
}

export function computeGoals(
  current: { goalId: string; current: number }[],
  planGoals: { goal: Goal; program: string }[],
): GoalProgress[] {
  const map = new Map(current.map((c) => [c.goalId, c.current]));
  return planGoals.map(({ goal, program }) => {
    const value = map.get(goal.id) ?? 0;
    const pct = goal.target > 0 ? Math.min(100, Math.round((value / goal.target) * 100)) : 0;
    return {
      id: goal.id,
      name: goal.name,
      unit: goal.unit,
      target: goal.target,
      current: value,
      pct,
      reached: goal.target > 0 && value >= goal.target,
      program,
    };
  });
}

export interface PlanSlice {
  planId: string;
  name: string;
  count: number;
  pct: number;
  minutes: number;
}

export function planDistribution(sessions: SessionRecord[], win: DayWindow): PlanSlice[] {
  const inWin = sessions.filter((s) => inWindow(s.date, win));
  const counts = new Map<string, { count: number; seconds: number }>();
  for (const s of inWin) {
    const entry = counts.get(s.planId) ?? { count: 0, seconds: 0 };
    entry.count += 1;
    entry.seconds += s.durationSec || 0;
    counts.set(s.planId, entry);
  }
  const total = inWin.length;
  return [...counts.entries()]
    .map(([planId, v]) => ({
      planId,
      name: getProgram(planId)?.name ?? planId,
      count: v.count,
      pct: total > 0 ? Math.round((v.count / total) * 100) : 0,
      minutes: Math.round(v.seconds / 60),
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/** Signed difference between a value and the previous one. */
export function delta(current: number, previous: number | null): string {
  if (previous === null) return '—';
  const diff = Math.round(current - previous);
  if (diff === 0) return '0';
  return `${diff > 0 ? '+' : '−'}${Math.abs(diff)}`;
}

export interface SessionSummary {
  date: string;
  planId: string;
  planName: string;
  durationMin: number;
  series: number;
  reps: number;
  seconds: number;
}

export function summarizeSession(session: SessionRecord): SessionSummary {
  let series = 0;
  let reps = 0;
  let seconds = 0;
  for (const set of session.sets ?? []) {
    const value = Number(set.value);
    if (!Number.isFinite(value) || value <= 0) continue;
    series += 1;
    if (set.unit === 'sec') seconds += value;
    else reps += value;
  }
  return {
    date: session.date,
    planId: session.planId,
    planName: getProgram(session.planId)?.name ?? session.planId,
    durationMin: Math.round((session.durationSec || 0) / 60),
    series,
    reps,
    seconds,
  };
}

export interface SessionComparison {
  summary: SessionSummary;
  previous: SessionSummary | null;
  durationDelta: number | null;
  seriesDelta: number | null;
  gained: boolean | null;
  newBests: string[];
}

function previousIndex(sorted: SessionRecord[], index: number): number | null {
  const planId = sorted[index].planId;
  for (let j = index - 1; j >= 0; j--) {
    if (sorted[j].planId === planId) return j;
  }
  return index > 0 ? index - 1 : null;
}

/**
 * Compares every session against the previous one (same plan when possible)
 * and flags the sessions that were gained: more time, or the same time with more work.
 */
export function compareSessions(sessions: SessionRecord[]): SessionComparison[] {
  const sorted = [...sessions].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const summaries = sorted.map(summarizeSession);
  const bestSoFar = new Map<string, number>();
  const out: SessionComparison[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const session = sorted[i];
    const current = summaries[i];
    const prevIndex = previousIndex(sorted, i);
    const previous = prevIndex === null ? null : summaries[prevIndex];
    const durationDelta = previous ? current.durationMin - previous.durationMin : null;
    const seriesDelta = previous ? current.series - previous.series : null;
    const gained =
      durationDelta === null ? null : durationDelta > 0 || (durationDelta === 0 && (seriesDelta ?? 0) > 0);

    const newBests: string[] = [];
    for (const set of session.sets ?? []) {
      const value = Number(set.value);
      if (!Number.isFinite(value) || value <= 0) continue;
      const key = `${normalizeExercise(set.exercise)}|${set.unit}`;
      const previousBest = bestSoFar.get(key) ?? 0;
      if (previousBest > 0 && value > previousBest) {
        newBests.push(set.exercise);
      }
      if (value > previousBest) bestSoFar.set(key, value);
    }

    out.push({ summary: current, previous, durationDelta, seriesDelta, gained, newBests: [...new Set(newBests)] });
  }

  return out;
}

export interface ExercisePoint {
  date: string;
  value: number;
}

export interface ExerciseSeries {
  exercise: string;
  unit: 'sec' | 'reps';
  points: ExercisePoint[];
  best: number;
  improvements: number;
}

/** Trajectory of every exercise with recorded values, ordered by how many times it improved. */
export function exerciseSeries(entries: MarkEntry[]): ExerciseSeries[] {
  const groups = new Map<string, { exercise: string; unit: 'sec' | 'reps'; points: ExercisePoint[] }>();
  for (const entry of entries) {
    const key = `${normalizeExercise(entry.exercise)}|${entry.unit}`;
    const group = groups.get(key);
    if (group) group.points.push({ date: entry.date, value: entry.value });
    else groups.set(key, { exercise: entry.exercise, unit: entry.unit, points: [{ date: entry.date, value: entry.value }] });
  }

  const out: ExerciseSeries[] = [];
  for (const group of groups.values()) {
    group.points.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    let best = 0;
    let improvements = 0;
    for (const point of group.points) {
      if (point.value > best) {
        best = point.value;
        improvements += 1;
      }
    }
    out.push({ exercise: group.exercise, unit: group.unit, points: group.points, best, improvements });
  }

  return out.sort((a, b) => b.improvements - a.improvements || b.points.length - a.points.length);
}
