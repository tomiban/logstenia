import { useEffect, useState } from 'react';
import { toISODate } from '@/lib/date';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { createMarkRepository, createSessionRepository } from '@/repositories';
import type { MarkRecord, SessionRecord } from '@/repositories';
import {
  RANGE_OPTIONS,
  anchorProgress,
  bestMarks,
  collectMarks,
  compareSessions,
  computeTelemetry,
  dedupeAnchors,
  delta,
  exerciseSeries,
  planDistribution,
  weeklyVolume,
  windowsFor,
  type BestMark,
  type RangeKey,
  type SessionComparison,
} from './metrics';
import { ANCLAS } from '@/features/progress/marks';
import { Bar, BarChart, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartTooltip, ValueTick } from '@/components/ui/chart';
import { cn } from '@/lib/utils';

const UNIT_LABEL: Record<'sec' | 'reps', string> = { sec: 'seg', reps: 'reps' };
const nf = new Intl.NumberFormat('es-AR');
const WEEKS_SHOWN = 8;
const SESSIONS_SHOWN = 12;
const ANCHORS = dedupeAnchors(ANCLAS);
const sessionRepository = createSessionRepository();
const markRepository = createMarkRepository();

function todayIso(): string {
  return toISODate();
}

function dayLabel(isoDay: string): string {
  const [, m, d] = isoDay.split('-');
  return `${d}/${m}`;
}

function signed(value: number): string {
  if (value === 0) return '0';
  return `${value > 0 ? '+' : '−'}${nf.format(Math.abs(value))}`;
}

function Panel({
  title,
  meta,
  children,
}: {
  title: string;
  meta?: string;
  children: ReactNode;
}) {
  return (
    <section className="border border-border bg-card">
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
            <span className="label-status shrink-0 border border-ink bg-accent px-1 text-on-accent">
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
          {nf.format(mark.value)} <span className="label-caps text-muted-foreground">{UNIT_LABEL[mark.unit]}</span>
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
        const [s, m] = await Promise.all([sessionRepository.list(), markRepository.list()]);
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

  const comparisons = compareSessions(sessions);
  const recent = comparisons.slice(-SESSIONS_SHOWN);
  const comparable = recent.filter((c) => c.gained !== null);
  const gained = comparable.filter((c) => c.gained).length;
  const newBests = recent.reduce((total, c) => total + c.newBests.length, 0);
  const hasDuration = sessions.some((s) => (s.durationSec || 0) > 0);
  const measure = (c: SessionComparison) => (hasDuration ? c.summary.durationMin : c.summary.series);
  const measureUnit = hasDuration ? 'min' : 'series';
  const bestSession = recent.reduce<SessionComparison | null>(
    (bestOne, c) => (bestOne === null || measure(c) > measure(bestOne) ? c : bestOne),
    null,
  );
  const sessionData = recent.map((c) => ({
    label: dayLabel(c.summary.date),
    amount: measure(c),
    marker: c.gained === true ? ('lime' as const) : undefined,
  }));
  const series = exerciseSeries(entries).filter((s) => s.points.length > 1);
  const anchors = anchorProgress(ANCHORS, entries).sort(
    (a, b) => Number(b.reached) - Number(a.reached) || b.pct - a.pct,
  );

  const rangeOpt = RANGE_OPTIONS.find((o) => o.key === range);
  const prevNote = win.previous ? `vs ${win.days} d previos` : 'histórico completo';

  const volumeValue = (w: (typeof volume)[number]) => (hasDuration ? w.minutes : w.sessions);
  const volumeUnit = hasDuration ? 'min' : 'sesiones';
  const volumeData = volume.map((w) => ({
    label: w.label,
    amount: volumeValue(w),
    marker: w.current ? ('ink' as const) : undefined,
  }));

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
                  ? 'bg-primary text-primary-foreground'
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
            className="label-caps mt-4 inline-flex h-11 items-center border border-ink bg-accent px-4 text-on-accent transition-colors hover:bg-transparent hover:text-ink hover:border-accent dark:hover:text-accent"
          >
            Empezar a entrenar
          </Link>
        </section>
      ) : null}

      {/* Telemetría del período */}
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

      {/* Sesiones ganadas */}
      <section className="border border-border" aria-label="Sesiones ganadas">
        <div className="grid grid-cols-1 gap-px bg-border sm:grid-cols-3">
          <Readout
            label="Sesiones ganadas"
            value={`${gained}/${comparable.length}`}
            note="vs la sesión anterior del mismo plan"
          />
          <Readout
            label="Mejor sesión"
            value={bestSession ? nf.format(measure(bestSession)) : '—'}
            unit={bestSession ? measureUnit : undefined}
            note={bestSession ? dayLabel(bestSession.summary.date) : undefined}
          />
          <Readout label="Marcas superadas" value={nf.format(newBests)} note={`en ${recent.length} sesiones`} />
        </div>
      </section>

      {/* Duración por sesión */}
      <Panel title="Duración por sesión" meta={`${measureUnit} · ${recent.length} sesiones`}>
        <div className="p-4">
          <div className="text-foreground">
            <ResponsiveContainer width="100%" height={150}>
              <BarChart data={sessionData} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                <XAxis
                  dataKey="label"
                  height={44}
                  interval={0}
                  tick={(props) => <ValueTick {...props} data={sessionData} />}
                  axisLine={{ stroke: 'var(--border)' }}
                  tickLine={false}
                />
                <Tooltip content={<ChartTooltip unit={measureUnit} />} cursor={{ fill: 'var(--muted-surface)' }} />
                <Bar dataKey="amount" fill="currentColor" maxBarSize={72} radius={0} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </Panel>

      {/* Comparación por sesión */}
      <Panel title="Comparación por sesión" meta={`${recent.length} sesiones`}>
        {recent.length === 0 ? (
          <p className="label-caps px-4 py-4 text-muted-foreground">sin sesiones registradas</p>
        ) : (
          <ul className="divide-y divide-border">
            {[...recent].reverse().map((c) => (
              <li key={c.summary.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">{c.summary.planName}</span>
                    {c.newBests.length > 0 ? (
                      <span className="label-status shrink-0 border border-ink bg-accent px-1 text-on-accent">PR</span>
                    ) : null}
                  </div>
                  <div className="label-caps mt-1 text-muted-foreground">
                    {dayLabel(c.summary.date)} · {nf.format(c.summary.series)} series
                    {c.seriesDelta === null ? '' : ` (${signed(c.seriesDelta)})`}
                  </div>
                  {c.newBests.length > 0 ? (
                    <div className="mt-1 text-xs text-muted-foreground">superaste: {c.newBests.join(', ')}</div>
                  ) : null}
                </div>
                <div className="shrink-0 text-right">
                  <div className="metric text-lg text-foreground">
                    {nf.format(c.summary.durationMin)}{' '}
                    <span className="label-caps text-muted-foreground">min</span>
                  </div>
                  <div className="label-caps mt-1 text-muted-foreground">
                    {c.durationDelta === null ? 'sin comparación' : `${signed(c.durationDelta)} vs anterior`}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {/* Volumen semanal */}
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
                  <Tooltip content={<ChartTooltip unit={volumeUnit} />} cursor={{ fill: 'var(--muted-surface)' }} />
                  <Bar dataKey="amount" fill="currentColor" maxBarSize={72} radius={0} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </Panel>

      {/* Marcas */}
      <Panel title="Marcas" meta={`${best.length} ejercicios · histórico`}>
        {best.length === 0 ? (
          <p className="label-caps px-4 py-4 text-muted-foreground">
            sin marcas todavía: aparecen cuando registrás el valor de una serie (segundos en isométricos,
            reps en básicos)
          </p>
        ) : (
          <>
            {['skill', 'basico'].map((group) => {
              const rows = best.filter((m) => m.group === group);
              if (rows.length === 0) return null;
              return (
                <div key={group}>
                  <div className="border-b border-border bg-secondary px-4 py-1.5">
                    <span className="label-caps text-muted-foreground">
                      {group === 'skill' ? 'SKILL' : 'BÁSICO'}
                    </span>
                  </div>
                  <ul className="divide-y divide-border">
                    {rows.map((mark) => (
                      <MarkRow key={`${mark.exercise}-${mark.unit}`} mark={mark} />
                    ))}
                  </ul>
                </div>
              );
            })}
          </>
        )}
      </Panel>

      {/* Evolución por ejercicio */}
      <Panel title="Evolución por ejercicio" meta={`${series.length} con historial`}>
        {series.length === 0 ? (
          <p className="label-caps px-4 py-4 text-muted-foreground">
            con dos registros del mismo ejercicio vas a ver acá la curva de progreso
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {series.map((s) => (
              <li key={`${s.exercise}-${s.unit}`} className="px-4 py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-sm font-medium">{s.exercise}</span>
                  <span className="metric shrink-0 text-sm text-foreground">
                    {nf.format(s.best)} <span className="label-caps text-muted-foreground">{UNIT_LABEL[s.unit]}</span>
                  </span>
                </div>
                <div className="mt-2 text-foreground">
                  <ResponsiveContainer width="100%" height={56}>
                    <LineChart data={s.points} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
                      <XAxis dataKey="date" hide />
                      <YAxis hide domain={[0, 'dataMax']} />
                      <Tooltip content={<ChartTooltip unit={UNIT_LABEL[s.unit]} />} cursor={{ stroke: 'var(--muted-surface)' }} />
                      <Line
                        type="linear"
                        dataKey="value"
                        stroke="currentColor"
                        strokeWidth={2}
                        dot={{ r: 2.5, fill: 'currentColor', strokeWidth: 0 }}
                        activeDot={{ r: 4, fill: 'var(--voltage-lime)', stroke: 'var(--ink)' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="label-caps mt-1 text-muted-foreground">
                  {nf.format(s.improvements)} mejoras · {nf.format(s.points.length)} registros
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {/* Metas: tus anclas de progresión */}
      <Panel title="Metas" meta={`${anchors.length} anclas`}>
        <ul className="divide-y divide-border">
          {anchors.map((anchor) => (
            <li key={`${anchor.exercise}-${anchor.unit}`} className="px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-medium">{anchor.exercise}</span>
                {anchor.reached ? (
                  <span className="label-status shrink-0 border border-ink bg-accent px-1 text-on-accent">LISTO</span>
                ) : null}
              </div>
              <div className="mt-2 flex items-baseline justify-between gap-2">
                <div className="h-1 flex-1 bg-border">
                  <div className="h-full bg-foreground" style={{ width: `${anchor.pct}%` }} />
                </div>
                <span className="metric shrink-0 text-sm text-foreground">
                  {nf.format(anchor.current)}
                  <span className="label-caps ml-1 text-muted-foreground">
                    / {nf.format(anchor.target)} {UNIT_LABEL[anchor.unit]}
                  </span>
                </span>
              </div>
              <div className="label-caps mt-1 text-muted-foreground">
                {anchor.source ? `mejor ${anchor.source}` : 'sin registros'}
              </div>
            </li>
          ))}
        </ul>
      </Panel>

      {/* Distribución por plan */}
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
  );
}
