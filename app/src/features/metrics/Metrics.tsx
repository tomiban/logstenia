import { useEffect, useState } from 'react';
import { toISODate } from '@/lib/date';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { createMarkRepository, createSessionRepository } from '@/repositories';
import type { MarkRecord, SessionRecord } from '@/repositories';
import {
  RANGE_OPTIONS,
  anchorProgress,
  anchoredEntries,
  bestMarks,
  collectMarks,
  compareSessions,
  computeTelemetry,
  dayLabel,
  dedupeAnchors,
  delta,
  earliestDay,
  exerciseSeries,
  marksWithin,
  metricsView,
  planDistribution,
  sessionMeasure,
  sessionsWithin,
  trendOf,
  volumeChartWindow,
  weeklyVolume,
  windowsFor,
  type BestMark,
  type RangeKey,
  type SessionComparison,
  type Trend,
} from './metrics';
import { ANCLAS } from '@/features/progress/marks';
import { Bar, BarChart, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartTooltip, ValueTick } from '@/components/ui/chart';
import {
  measureRows,
  seriesRows,
  volumeRows,
  weekValue,
  type ChartRow,
  type VolumeUnit,
} from './chartData';
import { cn } from '@/lib/utils';
import { pluralForm } from '@/lib/format';

const UNIT_LABEL: Record<'sec' | 'reps', string> = { sec: 'seg', reps: 'reps' };
const nf = new Intl.NumberFormat('es-AR');
const SESSIONS_SHOWN = 12;
const ANCHORS = dedupeAnchors(ANCLAS);
const sessionRepository = createSessionRepository();
const markRepository = createMarkRepository();

const TREND_WORD: Record<Trend, string> = {
  up: 'en alza',
  down: 'en baja',
  flat: 'estable',
  none: 'sin tendencia',
};

interface ChartMarker {
  marker: 'lime' | 'ink';
  text: string;
}

function todayIso(): string {
  return toISODate();
}

function signed(value: number): string {
  if (value === 0) return '0';
  return `${value > 0 ? '+' : '−'}${nf.format(Math.abs(value))}`;
}

/** A number inside a prose line: mono, tabular, ink. */
function Num({ value }: { value: string }) {
  return <span className="metric tabular-nums text-foreground">{value}</span>;
}

/** A code-shaped datum (a date) inside a prose line. */
function Stamp({ value }: { value: string }) {
  return <span className="font-mono tabular-nums">{value}</span>;
}

function Note({ children }: { children: ReactNode }) {
  return <div className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{children}</div>;
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
        {meta ? <span className="label-caps text-right text-muted-foreground">{meta}</span> : null}
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
  note?: ReactNode;
}) {
  return (
    <div className="bg-card p-4">
      <div className="label-caps text-muted-foreground">{label}</div>
      <div className="mt-1.5 flex items-baseline gap-1.5">
        <span className="metric text-3xl tabular-nums text-foreground">{value}</span>
        {unit ? <span className="label-caps text-muted-foreground">{unit}</span> : null}
      </div>
      {deltaText ? (
        <div className="mt-1.5 flex flex-wrap items-baseline gap-x-1.5 gap-y-1">
          <span className="metric text-sm tabular-nums text-foreground">{deltaText}</span>
          {deltaNote ? <span className="text-xs text-muted-foreground">{deltaNote}</span> : null}
        </div>
      ) : note ? (
        <Note>{note}</Note>
      ) : null}
    </div>
  );
}

/** The legend of a chart: what each marker means, in words. */
function ChartLegend({ markers = [], note }: { markers?: ChartMarker[]; note?: string }) {
  if (markers.length === 0 && !note) return null;
  return (
    <div className="mt-3 space-y-1">
      {markers.length > 0 ? (
        <p className="label-caps flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground">
          {markers.map((item) => (
            <span key={item.text} className="inline-flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className={cn('inline-block h-2 w-2', item.marker === 'lime' ? 'bg-accent' : 'bg-foreground')}
              />
              {item.text}
            </span>
          ))}
        </p>
      ) : null}
      {/* A note is a sentence: body copy, not the data face. */}
      {note ? <p className="text-xs text-muted-foreground">{note}</p> : null}
    </div>
  );
}

/** The same values the chart draws, readable without hover. */
function ChartTable({ caption, rows }: { caption: string; rows: readonly ChartRow[] }) {
  const unit = rows[0]?.unit ?? '';
  return (
    <details className="mt-3 border-t border-border pt-2">
      <summary className="label-caps cursor-pointer text-muted-foreground">ver valores</summary>
      <table className="mt-2 w-full text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-border text-left">
            <th scope="col" className="label-caps pb-1 font-normal text-muted-foreground">
              Fecha
            </th>
            <th scope="col" className="label-caps pb-1 text-right font-normal text-muted-foreground">
              {unit}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="py-1 tabular-nums text-muted-foreground">{row.label}</td>
              <td className="metric tabular-nums py-1 text-right text-foreground">{nf.format(row.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

function MarkRow({ mark }: { mark: BestMark }) {
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{mark.exercise}</span>
          {mark.isFresh ? (
            <span className="label-status shrink-0 border border-ink bg-accent px-1 text-on-accent">PR</span>
          ) : null}
        </div>
        <div className="label-caps mt-1 text-muted-foreground">
          {mark.date} · {mark.source === 'sesion' ? 'sesión' : 'marca'}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div className="metric text-lg tabular-nums text-foreground">
          {nf.format(mark.value)} <span className="label-caps text-muted-foreground">{UNIT_LABEL[mark.unit]}</span>
        </div>
        <div className="label-caps mt-1 text-muted-foreground">
          {mark.delta === null ? 'primer registro' : `${signed(mark.delta)} vs anterior`}
        </div>
      </div>
    </li>
  );
}

export default function Metrics() {
  const [range, setRange] = useState<RangeKey>('30d');
  const [today] = useState(todayIso);
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

  if (metricsView({ loading, error, today }) === 'loading') {
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

  if (metricsView({ loading, error, today }) === 'error') {
    return (
      <section className="border border-border bg-card p-4" role="alert">
        <h2 className="font-heading text-base font-bold">{error}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          recargá la página: los datos viven solo en este dispositivo
        </p>
      </section>
    );
  }

  const win = windowsFor(range, today, earliestDay(sessions, marks));
  const inRange = sessionsWithin(sessions, win);
  const entries = collectMarks(sessions, marks);
  const rangeEntries = marksWithin(entries, win);
  const anchored = anchoredEntries(ANCHORS, rangeEntries);

  const telemetry = computeTelemetry(sessions, win);
  const measureInfo = sessionMeasure(inRange);
  const { weeks, capped: volumeCapped } = volumeChartWindow(win);
  const volume = weeklyVolume(inRange, weeks, today);
  const best = bestMarks(anchored, today);
  const dist = planDistribution(sessions, win.current);

  const comparisons = compareSessions(sessions, win);
  const recent = comparisons.slice(-SESSIONS_SHOWN);
  const comparable = recent.filter((c) => c.gained !== null);
  const gained = comparable.filter((c) => c.gained).length;
  const newBests = recent.reduce((total, c) => total + c.newBests.length, 0);
  const measure = (c: SessionComparison) => (measureInfo.key === 'duracion' ? c.summary.durationMin : c.summary.series);
  const measureDeltaNote = (c: SessionComparison) => {
    const value = measureInfo.key === 'duracion' ? c.durationDelta : c.seriesDelta;
    return value === null ? 'sin comparación' : `${signed(value)} vs anterior`;
  };
  const bestSession = recent.reduce<SessionComparison | null>(
    (bestOne, c) => (bestOne === null || measure(c) > measure(bestOne) ? c : bestOne),
    null,
  );
  const sessionData = recent.map((c) => ({
    id: c.summary.id,
    label: dayLabel(c.summary.date),
    amount: measure(c),
    marker: c.gained === true ? ('lime' as const) : undefined,
  }));
  const series = exerciseSeries(anchored).filter((s) => s.points.length > 1);
  const anchors = anchorProgress(ANCHORS, rangeEntries).sort(
    (a, b) => Number(b.reached) - Number(a.reached) || b.pct - a.pct,
  );

  const rangeOpt = RANGE_OPTIONS.find((o) => o.key === range);
  const rangeTag = rangeOpt?.key === 'all' ? 'histórico' : (rangeOpt?.short ?? '');
  const prevNote = win.previous ? `vs los ${win.days} días previos` : 'histórico completo';
  const subtitle = win.previous ? `${rangeOpt?.label} · contra los ${win.days} días previos` : rangeOpt?.label;

  const volumeUnit: VolumeUnit = measureInfo.key === 'duracion' ? 'min' : 'sesiones';
  const volumeNoun = measureInfo.key === 'duracion' ? 'minutos' : 'sesiones';
  const volumeData = volume.map((w) => ({
    label: w.label,
    amount: weekValue(w, volumeUnit),
    marker: w.current ? ('ink' as const) : undefined,
  }));

  const sessionMeta = `${recent.length === comparisons.length ? nf.format(comparisons.length) : `${nf.format(recent.length)} de ${nf.format(comparisons.length)}`} ${pluralForm(comparisons.length, 'sesión', 'sesiones')} · ${rangeTag}`;
  const weeksLabel = `${nf.format(weeks)} ${pluralForm(weeks, 'semana', 'semanas')}`;
  const volumeWindowLabel = volumeCapped ? `últimas ${weeksLabel}` : weeksLabel;

  const sessionValues = sessionData.map((d) => d.amount);
  const sessionTrend = trendOf(sessionValues);
  const sessionChartLabel =
    recent.length === 0
      ? `${measureInfo.title}: sin sesiones en el rango elegido.`
      : `${measureInfo.title} de ${nf.format(recent.length)} ${pluralForm(recent.length, 'sesión', 'sesiones')}, del ${dayLabel(recent[0].summary.date)} al ${dayLabel(recent[recent.length - 1].summary.date)}: entre ${nf.format(Math.min(...sessionValues))} y ${nf.format(Math.max(...sessionValues))} ${measureInfo.unit}, tendencia ${TREND_WORD[sessionTrend]}.`;

  const volumeValues = volumeData.map((d) => d.amount);
  const peak = volumeData[volumeValues.indexOf(Math.max(...volumeValues))];
  const volumeChartLabel = `${volumeNoun} por semana, ${volumeWindowLabel}${volumeCapped ? '' : ' del rango elegido'}: máximo ${nf.format(peak.amount)} en la semana del ${peak.label}, tendencia ${TREND_WORD[trendOf(volumeValues)]}.`;

  const sinSesiones = sessions.length === 0;

  return (
    <div className="space-y-4">
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-2xl font-bold tracking-tight">Métricas</h1>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
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
            className="label-caps mt-4 inline-flex h-11 items-center border border-ink bg-accent px-4 text-on-accent transition-colors hover:bg-ink hover:text-on-ink hover:border-ink"
          >
            Empezar a entrenar
          </Link>
        </section>
      ) : null}

      {/* Period telemetry */}
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
            label="Racha · histórico"
            value={nf.format(telemetry.streak)}
            unit={pluralForm(telemetry.streak, 'día', 'días')}
            note={
              <>
                mejor <Num value={nf.format(telemetry.bestStreak)} />{' '}
                {pluralForm(telemetry.bestStreak, 'día', 'días')}
              </>
            }
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

      {/* Sessions won */}
      <section className="border border-border" aria-label="Sesiones ganadas">
        <div className="grid grid-cols-1 gap-px bg-border sm:grid-cols-3">
          <Readout
            label="Sesiones ganadas"
            value={comparable.length === 0 ? '—' : `${gained}/${comparable.length}`}
            note={
              comparable.length === 0
                ? 'sin sesiones comparables'
                : 'vs la sesión anterior del mismo plan'
            }
          />
          <Readout
            label="Mejor sesión"
            value={bestSession ? nf.format(measure(bestSession)) : '—'}
            unit={bestSession ? measureInfo.unit : undefined}
            note={
              bestSession ? (
                <>
                  el <Stamp value={dayLabel(bestSession.summary.date)} />
                </>
              ) : (
                'sin sesiones en el rango'
              )
            }
          />
          <Readout
            label="Marcas superadas"
            value={nf.format(newBests)}
            note={
              <>
                en <Num value={nf.format(recent.length)} /> {pluralForm(recent.length, 'sesión', 'sesiones')}
              </>
            }
          />
        </div>
      </section>

      {/* Duration per session */}
      <Panel title={measureInfo.title} meta={sessionMeta}>
        {recent.length === 0 ? (
          <p className="px-4 py-4 text-sm text-muted-foreground">sin sesiones en el rango elegido</p>
        ) : (
          <div className="p-4">
            <div role="img" aria-label={sessionChartLabel} className="text-foreground">
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
                  <Tooltip
                    content={<ChartTooltip unit={measureInfo.unit} />}
                    cursor={{ fill: 'var(--muted-surface)' }}
                  />
                  <Bar dataKey="amount" fill="currentColor" maxBarSize={72} radius={0} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <ChartLegend
              markers={[{ marker: 'lime', text: 'sesión ganada' }]}
              note="sin cuadrado = sin sesión previa del mismo plan"
            />
            <ChartTable
              caption={`${measureInfo.title}, ${sessionMeta}`}
              rows={measureRows(sessionData, measureInfo.unit)}
            />
          </div>
        )}
      </Panel>

      {/* Session comparison */}
      <Panel title="Comparación por sesión" meta={sessionMeta}>
        {recent.length === 0 ? (
          <p className="px-4 py-4 text-sm text-muted-foreground">sin sesiones en el rango elegido</p>
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
                  <div className="metric text-lg tabular-nums text-foreground">
                    {nf.format(measure(c))}{' '}
                    <span className="label-caps text-muted-foreground">{measureInfo.unit}</span>
                  </div>
                  <div className="label-caps mt-1 text-muted-foreground">
                    {measureDeltaNote(c)}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {/* Weekly volume */}
      <Panel title="Volumen por semana" meta={`${volumeUnit} · ${volumeWindowLabel}`}>
        <div className="p-4">
          {inRange.length === 0 ? (
            <p className="text-sm text-muted-foreground">sin sesiones en el rango elegido</p>
          ) : (
            <>
              <div role="img" aria-label={volumeChartLabel} className="text-foreground">
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
              <ChartLegend markers={[{ marker: 'ink', text: 'semana en curso' }]} />
              <ChartTable
                caption={`Volumen por semana, ${volumeWindowLabel}`}
                rows={volumeRows(volume, volumeUnit)}
              />
            </>
          )}
        </div>
      </Panel>

      {/* Marks */}
      <Panel title="Marcas" meta={`${nf.format(best.length)} ${pluralForm(best.length, 'ejercicio', 'ejercicios')} · ${rangeTag}`}>
        {best.length === 0 ? (
          <p className="px-4 py-4 text-sm text-muted-foreground">
            <span className="label-caps text-muted-foreground">faltan marcas de los ejercicios que medís:</span>{' '}
            aparecen cuando registrás el valor de una serie (segundos en isométricos, reps en básicos)
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

      {/* Progress per exercise */}
      <Panel
        title="Evolución por ejercicio"
        meta={`${nf.format(series.length)} con historial · ${rangeTag}`}
      >
        {series.length === 0 ? (
          <p className="px-4 py-4 text-sm text-muted-foreground">
            con dos registros del mismo ejercicio dentro del rango vas a ver acá la curva de progreso
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {series.map((s) => {
              const values = s.points.map((p) => p.value);
              return (
                <li key={`${s.exercise}-${s.unit}`} className="px-4 py-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-sm font-medium">{s.exercise}</span>
                    <span className="metric shrink-0 text-sm tabular-nums text-foreground">
                      {nf.format(s.best)}{' '}
                      <span className="label-caps text-muted-foreground">{UNIT_LABEL[s.unit]}</span>
                    </span>
                  </div>
                  <div
                    role="img"
                    aria-label={`${s.exercise}: ${nf.format(s.points.length)} registros, mejor ${nf.format(s.best)} ${UNIT_LABEL[s.unit]}, tendencia ${TREND_WORD[trendOf(values)]}.`}
                    className="mt-2 text-foreground"
                  >
                    <ResponsiveContainer width="100%" height={56}>
                      <LineChart data={s.points} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
                        <XAxis dataKey="date" hide />
                        <YAxis hide domain={[0, 'dataMax']} />
                        <Tooltip
                          content={<ChartTooltip unit={UNIT_LABEL[s.unit]} />}
                          cursor={{ stroke: 'var(--muted-surface)' }}
                        />
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
                  <ChartLegend note="cada punto es un registro del rango" />
                  <div className="label-caps mt-1 text-muted-foreground">
                    {nf.format(s.improvements)} mejoras · {nf.format(s.points.length)} registros
                  </div>
                  <ChartTable
                    caption={`Evolución de ${s.exercise}`}
                    rows={seriesRows(s.points, UNIT_LABEL[s.unit])}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      {/* Goals: your progression anchors */}
      <Panel title="Metas" meta={`${nf.format(anchors.length)} anclas · ${rangeTag}`}>
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
                <span className="metric shrink-0 text-sm tabular-nums text-foreground">
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

      {/* Distribution per plan */}
      <Panel
        title="Sesiones por plan"
        meta={`${nf.format(dist.length)} ${pluralForm(dist.length, 'plan', 'planes')} · ${rangeTag}`}
      >
        {dist.length === 0 ? (
          <p className="px-4 py-4 text-sm text-muted-foreground">sin sesiones en el rango elegido</p>
        ) : (
          <ul className="divide-y divide-border">
            {dist.map((slice) => (
              <li key={slice.planId} className="px-4 py-3">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm">{slice.name}</span>
                  <span className="metric shrink-0 text-sm tabular-nums text-foreground">
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
