import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../db';
import type { MarkRecord, SessionRecord } from '../db';
import {
  collectMarks,
  compareSessions,
  exerciseSeries,
  type SessionComparison,
} from '../lib/metrics';
import { cn } from '@/lib/utils';

const UNIT_LABEL: Record<'sec' | 'reps', string> = { sec: 'seg', reps: 'reps' };
const nf = new Intl.NumberFormat('es-AR');
const SESSIONS_SHOWN = 12;

function Panel({
  title,
  meta,
  children,
}: {
  title: string;
  meta?: string;
  children: React.ReactNode;
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

function Readout({ label, value, unit, note }: { label: string; value: string; unit?: string; note?: string }) {
  return (
    <div className="bg-card p-4">
      <div className="label-caps text-muted-foreground">{label}</div>
      <div className="mt-1.5 flex items-baseline gap-1.5">
        <span className="metric text-3xl text-foreground">{value}</span>
        {unit ? <span className="label-caps text-muted-foreground">{unit}</span> : null}
      </div>
      {note ? <div className="mt-1.5 label-caps text-muted-foreground">{note}</div> : null}
    </div>
  );
}

export default function Progress() {
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

  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Cargando">
        <div className="h-8 w-40 animate-pulse bg-secondary" />
        <div className="grid grid-cols-3 gap-px bg-border">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse bg-secondary" />
          ))}
        </div>
        <div className="h-48 animate-pulse bg-secondary" />
      </div>
    );
  }

  const comparisons = compareSessions(sessions);
  const windowed = comparisons.slice(-SESSIONS_SHOWN);
  const comparable = windowed.filter((c) => c.gained !== null);
  const gained = comparable.filter((c) => c.gained).length;
  const bestSession = windowed.reduce<SessionComparison | null>(
    (best, c) => (best === null || c.summary.durationMin > best.summary.durationMin ? c : best),
    null,
  );
  const newBests = windowed.reduce((total, c) => total + c.newBests.length, 0);
  const series = exerciseSeries(collectMarks(sessions, marks)).filter((s) => s.points.length > 1);

  const hasDuration = sessions.some((s) => (s.durationSec || 0) > 0);
  const measure = (c: SessionComparison) => (hasDuration ? c.summary.durationMin : c.summary.series);
  const measureUnit = hasDuration ? 'min' : 'series';
  const peak = Math.max(1, ...windowed.map(measure));

  return (
    <div className="space-y-4">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-bold tracking-tight">Progreso</h1>
        <p className="label-caps text-muted-foreground">
          evolución de tus sesiones · últimas {windowed.length || SESSIONS_SHOWN}
        </p>
      </header>

      {error ? (
        <section className="border border-border bg-card p-4" role="alert">
          <h2 className="font-heading text-base font-bold">{error}</h2>
        </section>
      ) : null}

      {sessions.length === 0 ? (
        <section className="border border-border bg-card p-4">
          <h2 className="font-heading text-base font-bold">Todavía no hay sesiones para comparar</h2>
          <p className="mt-2 max-w-prose text-sm text-muted-foreground">
            Cada sesión que termines alimenta esta pantalla sola: duración, series registradas y las marcas
            que superaste. No hay nada que anotar.
          </p>
          <Link
            to="/"
            className="label-caps mt-4 inline-flex h-11 items-center border border-ink bg-accent px-4 text-ink transition-colors hover:bg-primary hover:text-primary-foreground"
          >
            Empezar a entrenar
          </Link>
        </section>
      ) : null}

      {sessions.length > 0 ? (
        <>
          <section className="border border-border" aria-label="Resumen de la evolución">
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
              <Readout label="Marcas superadas" value={nf.format(newBests)} note={`en ${windowed.length} sesiones`} />
            </div>
          </section>

          <Panel title="Duración por sesión" meta={`${measureUnit} · ${windowed.length} sesiones`}>
            <div className="p-4">
              <div
                className="flex h-32 items-end gap-1 border-b border-border"
                role="img"
                aria-label={`Duración de las últimas ${windowed.length} sesiones. Máximo ${nf.format(peak)} ${measureUnit}.`}
              >
                {windowed.map((c) => {
                  const value = measure(c);
                  const pct = Math.round((value / peak) * 100);
                  return (
                    <div key={`${c.summary.date}-${c.summary.planId}`} className="flex h-full flex-1 items-end justify-center">
                      {value === 0 ? (
                        <div className="h-px w-full max-w-[72px] bg-border" />
                      ) : (
                        <div
                          className="w-full max-w-[72px] bg-foreground"
                          style={{ height: `${Math.max(4, pct)}%` }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 flex gap-1">
                {windowed.map((c) => (
                  <div key={`${c.summary.date}-${c.summary.planId}`} className="flex flex-1 flex-col items-center gap-1">
                    <span className="metric text-xs text-foreground">{nf.format(measure(c))}</span>
                    <span className="label-status text-muted-foreground">{dayLabel(c.summary.date)}</span>
                    <span
                      className={cn('h-2 w-2', c.gained ? 'bg-accent' : 'bg-transparent')}
                      aria-hidden="true"
                    />
                  </div>
                ))}
              </div>
            </div>
          </Panel>

          <Panel title="Comparación por sesión" meta={`${windowed.length} sesiones`}>
            {windowed.length === 0 ? (
              <p className="label-caps px-4 py-4 text-muted-foreground">sin sesiones registradas</p>
            ) : (
              <ul className="divide-y divide-border">
                {[...windowed].reverse().map((c, i) => (
                  <li key={`${c.summary.date}-${c.summary.planId}-${i}`} className="flex items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">{c.summary.planName}</span>
                        {c.newBests.length > 0 ? (
                          <span className="label-status shrink-0 border border-ink bg-accent px-1 text-ink">PR</span>
                        ) : null}
                      </div>
                      <div className="label-caps mt-1 text-muted-foreground">
                        {dayLabel(c.summary.date)} · {nf.format(c.summary.series)} series
                        {c.seriesDelta === null ? '' : ` (${signed(c.seriesDelta)})`}
                      </div>
                      {c.newBests.length > 0 ? (
                        <div className="mt-1 text-xs text-muted-foreground">
                          superaste: {c.newBests.join(', ')}
                        </div>
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
                        {nf.format(s.best)}{' '}
                        <span className="label-caps text-muted-foreground">{UNIT_LABEL[s.unit]}</span>
                      </span>
                    </div>
                    <div className="mt-2 flex h-10 items-end gap-0.5 border-b border-border">
                      {s.points.map((p, i) => (
                        <div key={`${p.date}-${p.value}-${i}`} className="flex h-full flex-1 items-end justify-center">
                          <div
                            className="w-full max-w-[72px] bg-foreground"
                            style={{ height: `${Math.max(8, Math.round((p.value / s.best) * 100))}%` }}
                          />
                        </div>
                      ))}
                    </div>
                    <div className="label-caps mt-1 text-muted-foreground">
                      {nf.format(s.improvements)} mejoras · {nf.format(s.points.length)} registros
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </>
      ) : null}
    </div>
  );
}

function dayLabel(isoDay: string): string {
  const [, m, d] = isoDay.split('-');
  return `${d}/${m}`;
}

function signed(value: number): string {
  if (value === 0) return '0';
  return `${value > 0 ? '+' : '−'}${nf.format(Math.abs(value))}`;
}
