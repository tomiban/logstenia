import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { db, type MarkRecord, type SessionRecord } from '../db';
import { allPrograms } from '../lib/plans';
import {
  RANGE_OPTIONS,
  bestMarks,
  collectMarks,
  computeGoals,
  computeTelemetry,
  deriveGoal,
  delta,
  planDistribution,
  weeklyVolume,
  windowsFor,
  type BestMark,
  type GoalDerivation,
  type RangeKey,
} from '../lib/metrics';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { ChartTooltip, ValueTick } from '@/components/ui/chart';
import { cn } from '@/lib/utils';

const UNIT_LABEL: Record<'sec' | 'reps', string> = { sec: 'seg', reps: 'reps' };
const nf = new Intl.NumberFormat('es-AR');
const WEEKS_SHOWN = 8;

const PLAN_GOALS = allPrograms().flatMap((p) => p.goals.map((goal) => ({ goal, program: p.name, programId: p.id })));

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function goalNote(derivation: GoalDerivation | undefined): string {
  if (!derivation || derivation.kind === 'sin') return 'sin registros';
  if (derivation.kind === 'sesiones') return `${nf.format(derivation.value)} sesiones del plan`;
  return `mejor ${derivation.source}`;
}


function Panel({
  title,
  meta,
  className,
  children,
}: {
  title: string;
  meta?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn('border border-border bg-card', className)}>
      <header className="flex items-baseline justify-between gap-3 border-b border-border px-4 py-2">
        <h2 className="label-caps text-foreground">{title}</h2>
        {meta ? <span className="label-caps text-muted-foreground">{meta}</span> : null}
      </header>
      {children}
    </section>
  );
}

function Readout({
  label,
  value,
  unit,
  deltaText,
  deltaNote,
  note,
}: {
  label: string;
  value: string;
  unit?: string;
  deltaText?: string;
  deltaNote?: string;
  note?: string;
}) {
  return (
    <div className="bg-card p-4">
      <div className="label-caps text-muted-foreground">{label}</div>
      <div className="mt-1.5 flex items-baseline gap-1.5">
        <span className="metric text-3xl text-foreground">{value}</span>
        {unit ? <span className="label-caps text-muted-foreground">{unit}</span> : null}
      </div>
      {deltaText ? (
        <div className="mt-1.5 flex items-baseline gap-1.5">
          <span className="metric text-sm text-foreground">{deltaText}</span>
          <span className="label-caps text-muted-foreground">{deltaNote}</span>
        </div>
      ) : note ? (
        <div className="mt-1.5 label-caps text-muted-foreground">{note}</div>
      ) : null}
    </div>
  );
}

function MarkRow({ mark }: { mark: BestMark }) {
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{mark.exercise}</span>
          {mark.delta !== null && mark.delta > 0 ? (
            <span className="label-status shrink-0 border border-ink bg-accent px-1 text-ink">
              PR
            </span>
          ) : null}
        </div>
        <div className="label-caps mt-1 text-muted-foreground">
          {mark.date} · {mark.source === 'sesion' ? 'sesión' : 'marca'}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div className="metric text-lg text-foreground">
          {nf.format(mark.value)}{' '}
          <span className="label-caps text-muted-foreground">{UNIT_LABEL[mark.unit]}</span>
        </div>
        <div className="label-caps mt-1 text-muted-foreground">
          {mark.delta === null ? 'primer registro' : `+${nf.format(mark.delta)} vs anterior`}
        </div>
      </div>
    </li>
  );
}

export default function Metrics() {
  const [range, setRange] = useState<RangeKey>('30d');
  const [today, setToday] = useState('');
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [marks, setMarks] = useState<MarkRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [s, m] = await Promise.all([db.sessions.toArray(), db.marks.toArray()]);
        if (cancelled) return;
        setSessions(s);
        setMarks(m);
        setToday(todayIso());
      } catch {
        if (!cancelled) setError('No se pudieron leer los datos de este dispositivo.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading || !today) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Cargando">
        <div className="h-8 w-40 animate-pulse bg-secondary" />
        <div className="grid grid-cols-2 gap-px bg-border md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse bg-secondary" />
          ))}
        </div>
        <div className="h-48 animate-pulse bg-secondary" />
        <div className="h-64 animate-pulse bg-secondary" />
      </div>
    );
  }

  const earliest = sessions.reduce<string | undefined>(
    (acc, s) => (acc === undefined || s.date < acc ? s.date : acc),
    undefined,
  );
  const win = windowsFor(range, today, earliest);
  const telemetry = computeTelemetry(sessions, win);
  const volume = weeklyVolume(sessions, WEEKS_SHOWN, today);
  const entries = collectMarks(sessions, marks);
  const best = bestMarks(entries, today);
  const dist = planDistribution(sessions, win.current);
  const derivations = new Map(
    PLAN_GOALS.map(({ goal, programId }) => [goal.id, deriveGoal(goal, programId, entries, sessions)]),
  );
  const goals = computeGoals(
    PLAN_GOALS.map(({ goal }) => ({ goalId: goal.id, current: derivations.get(goal.id)?.value ?? 0 })),
    PLAN_GOALS,
  );

  const rangeOpt = RANGE_OPTIONS.find((o) => o.key === range);
  const prevNote = win.previous ? `vs ${win.days} d previos` : 'histórico completo';

  const hasDuration = sessions.some((s) => (s.durationSec || 0) > 0);
  const volumeValue = (w: (typeof volume)[number]) => (hasDuration ? w.minutes : w.sessions);
  const volumeUnit = hasDuration ? 'min' : 'sesiones';
  const volumeData = volume.map((w) => ({
    label: w.label,
    amount: volumeValue(w),
    current: w.current,
  }));

  const markGroups: { key: string; title: string; rows: BestMark[] }[] = [];
  for (const mark of best) {
    const key = `${mark.group}|${mark.subgroup}`;
    const group = markGroups.find((g) => g.key === key);
    if (group) group.rows.push(mark);
    else {
      markGroups.push({
        key,
        title: `${mark.group === 'skill' ? 'SKILL' : 'BÁSICO'} · ${mark.subgroup.toUpperCase()}`,
        rows: [mark],
      });
    }
  }


  const sinSesiones = sessions.length === 0;

  return (
    <div className="space-y-4">
      {error ? (
        <section className="border border-border bg-card p-4" role="alert">
          <h2 className="font-heading text-base font-bold">{error}</h2>
          <p className="label-caps mt-2 text-muted-foreground">
            recargá la página: los datos viven solo en este dispositivo
          </p>
        </section>
      ) : null}
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-2xl font-bold tracking-tight">Métricas</h1>
          <p className="label-caps text-muted-foreground">
            {rangeOpt?.label}
            {win.previous ? ` · vs ${win.days} días previos` : ''}
          </p>
        </div>
        <div
          role="group"
          aria-label="Rango de tiempo"
          className="flex w-full divide-x divide-border border border-border md:w-auto"
        >
          {RANGE_OPTIONS.map((o) => (
            <button
              key={o.key}
              type="button"
              aria-pressed={range === o.key}
              onClick={() => setRange(o.key)}
              className={cn(
                'label-caps h-11 flex-1 px-3 transition-colors md:flex-none',
                range === o.key
                  ? 'bg-primary text-primary-foreground dark:bg-[var(--text)] dark:text-[var(--bg)]'
                  : 'bg-card text-muted-foreground hover:bg-secondary hover:text-foreground',
              )}
            >
              {o.short}
            </button>
          ))}
        </div>
      </header>

      {sinSesiones ? (
        <section className="border border-border bg-card p-4">
          <h2 className="font-heading text-base font-bold">Todavía no hay nada que medir</h2>
          <p className="mt-2 max-w-prose text-sm text-muted-foreground">
            Esta pantalla se arma con lo que registrás: una sesión te da volumen, racha y tiempo; cada serie
            con valor te da una marca. Empezá entrenando y volvé acá.
          </p>
          <Link
            to="/"
            className="label-caps mt-4 inline-flex h-11 items-center border border-ink bg-accent px-4 text-ink transition-colors hover:bg-primary hover:text-primary-foreground"
          >
            Empezar a entrenar
          </Link>
        </section>
      ) : null}

      {/* Telemetry strip */}
      <section className="border border-border" aria-label="Telemetría del período">
        <div className="grid grid-cols-2 gap-px bg-border md:grid-cols-4">
          <Readout
            label="Sesiones"
            value={nf.format(telemetry.sessions)}
            deltaText={delta(telemetry.sessions, telemetry.prevSessions)}
            deltaNote={prevNote}
          />
          <Readout
            label="Minutos"
            value={nf.format(telemetry.minutes)}
            unit="min"
            deltaText={delta(telemetry.minutes, telemetry.prevMinutes)}
            deltaNote={prevNote}
          />
          <Readout
            label="Racha"
            value={nf.format(telemetry.streak)}
            unit={telemetry.streak === 1 ? 'día' : 'días'}
            note={`mejor ${nf.format(telemetry.bestStreak)} días`}
          />
          <Readout
            label="Media por sesión"
            value={telemetry.avgMinutes > 0 ? nf.format(telemetry.avgMinutes) : '—'}
            unit={telemetry.avgMinutes > 0 ? 'min' : undefined}
            deltaText={
              telemetry.avgMinutes > 0 ? delta(telemetry.avgMinutes, telemetry.prevAvgMinutes) : undefined
            }
            deltaNote={prevNote}
          />
        </div>
      </section>

      {/* Weekly volume */}
      <Panel title="Volumen por semana" meta={`${volumeUnit} · ${WEEKS_SHOWN} semanas`}>
        <div className="p-4">
          {sinSesiones ? (
            <p className="label-caps text-muted-foreground">sin sesiones para graficar</p>
          ) : (
            <div className="text-foreground">
              <ResponsiveContainer width="100%" height={150}>
                <BarChart data={volumeData} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                  <XAxis
                    dataKey="label"
                    height={44}
                    interval={0}
                    tick={(props) => <ValueTick {...props} data={volumeData} />}
                    axisLine={{ stroke: 'var(--border)' }}
                    tickLine={false}
                  />
                  <Tooltip
                    content={<ChartTooltip unit={volumeUnit} />}
                    cursor={{ fill: 'var(--muted-surface)' }}
                  />
                  <Bar dataKey="amount" fill="currentColor" maxBarSize={72} radius={0} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </Panel>

      {/* Marks */}
      <Panel title="Marcas" meta={`${best.length} ejercicios · histórico`}>
        {best.length === 0 ? (
          <p className="label-caps px-4 py-4 text-muted-foreground">
            sin marcas todavía: aparecen cuando registrás el valor de una serie (segundos en isométricos,
            reps en básicos)
          </p>
        ) : (
          markGroups.map((group) => (
            <div key={group.key}>
              <div className="border-b border-border bg-secondary px-4 py-1.5">
                <span className="label-caps text-muted-foreground">{group.title}</span>
              </div>
              <ul className="divide-y divide-border">
                {group.rows.map((mark) => (
                  <MarkRow key={`${mark.exercise}-${mark.unit}`} mark={mark} />
                ))}
              </ul>
            </div>
          ))
        )}
      </Panel>

      {/* Goals + plan distribution */}
      <div className="grid gap-4 md:grid-cols-2">
        <Panel title="Metas" meta={`${goals.length} objetivos`}>
          {goals.length === 0 ? (
            <p className="label-caps px-4 py-4 text-muted-foreground">ningún plan define metas todavía</p>
          ) : (
            <ul className="divide-y divide-border">
              {goals.map((goal) => (
                <li key={goal.id} className="px-4 py-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-medium">{goal.name}</span>
                    <span className="label-caps shrink-0 text-muted-foreground">{goal.program}</span>
                  </div>
                  <div className="mt-2 h-1 w-full bg-border">
                    <div
                      className={cn('h-full', goal.reached ? 'bg-accent' : 'bg-foreground')}
                      style={{ width: `${goal.pct}%` }}
                    />
                  </div>
                  <div className="mt-2 flex items-baseline justify-between gap-2">
                    <span className="label-caps text-muted-foreground">
                      <span className="metric text-foreground">{nf.format(goal.current)}</span> /{' '}
                      {nf.format(goal.target)} {UNIT_LABEL[goal.unit]}
                    </span>
                    <span className="label-caps text-muted-foreground">{goalNote(derivations.get(goal.id))}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Sesiones por plan" meta={`${dist.length} planes`}>
          {dist.length === 0 ? (
            <p className="label-caps px-4 py-4 text-muted-foreground">sin sesiones en el período</p>
          ) : (
            <ul className="divide-y divide-border">
              {dist.map((slice) => (
                <li key={slice.planId} className="px-4 py-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm">{slice.name}</span>
                    <span className="metric shrink-0 text-sm text-foreground">
                      {nf.format(slice.count)}
                      <span className="label-caps ml-1 text-muted-foreground">{slice.pct}%</span>
                    </span>
                  </div>
                  <div className="mt-2 h-1 w-full bg-border">
                    <div className="h-full bg-foreground" style={{ width: `${slice.pct}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
