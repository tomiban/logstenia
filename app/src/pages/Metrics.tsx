import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../db';
import type { MarkRecord, SessionRecord } from '../db';
import { allPrograms } from '../lib/plans';
import {
  RANGE_OPTIONS,
  bestMarks,
  collectMarks,
  computeGoals,
  computeTelemetry,
  delta,
  planDistribution,
  weeklyVolume,
  windowsFor,
  type BestMark,
  type RangeKey,
} from '../lib/metrics';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const UNIT_LABEL: Record<'sec' | 'reps', string> = { sec: 'seg', reps: 'reps' };
const nf = new Intl.NumberFormat('es-AR');
const WEEKS_SHOWN = 8;

const PLAN_GOALS = allPrograms().flatMap((p) => p.goals.map((goal) => ({ goal, program: p.name })));

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function nowIso(): string {
  return new Date().toISOString();
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
  children: React.ReactNode;
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

function GoalValue({ goal, onSave }: { goal: { id: string; name: string; current: number }; onSave: (value: number) => void }) {
  const [resetKey, setResetKey] = useState(0);
  return (
    <Input
      key={`${goal.id}-${goal.current}-${resetKey}`}
      type="number"
      inputMode="numeric"
      min={0}
      defaultValue={goal.current}
      aria-label={`valor actual de ${goal.name}`}
      className="metric h-11 w-24 text-right"
      onBlur={(e) => {
        const parsed = Number(e.target.value);
        if (!Number.isFinite(parsed) || parsed < 0) {
          setResetKey((k) => k + 1);
          return;
        }
        if (parsed !== goal.current) onSave(parsed);
      }}
    />
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
  const [goalRows, setGoalRows] = useState<{ goalId: string; current: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [s, m, g] = await Promise.all([db.sessions.toArray(), db.marks.toArray(), db.goals.toArray()]);
        if (cancelled) return;
        setSessions(s);
        setMarks(m);
        setGoalRows(g.map((r) => ({ goalId: r.goalId, current: r.current })));
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
  const best = bestMarks(collectMarks(sessions, marks), today);
  const dist = planDistribution(sessions, win.current);
  const goals = computeGoals(goalRows, PLAN_GOALS);

  const rangeOpt = RANGE_OPTIONS.find((o) => o.key === range);
  const prevNote = win.previous ? `vs ${win.days} d previos` : 'histórico completo';

  const hasDuration = sessions.some((s) => (s.durationSec || 0) > 0);
  const volumeValue = (w: (typeof volume)[number]) => (hasDuration ? w.minutes : w.sessions);
  const volumeUnit = hasDuration ? 'min' : 'sesiones';
  const peak = Math.max(1, ...volume.map(volumeValue));

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

  const saveGoal = async (goalId: string, value: number) => {
    setGoalRows((prev) => [...prev.filter((g) => g.goalId !== goalId), { goalId, current: value }]);
    const updatedAt = nowIso();
    try {
      const existing = await db.goals.where('goalId').equals(goalId).first();
      if (existing?.id !== undefined) {
        await db.goals.update(existing.id, { current: value, updatedAt });
      } else {
        await db.goals.add({ goalId, current: value, updatedAt });
      }
    } catch {
      setError('No se pudo guardar el valor de la meta.');
    }
  };

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
            <>
              <div
                className="flex h-32 items-end gap-1 border-b border-border"
                role="img"
                aria-label={`Volumen de las últimas ${WEEKS_SHOWN} semanas. Máximo ${nf.format(peak)} ${volumeUnit} por semana.`}
              >
                {volume.map((w) => {
                  const value = volumeValue(w);
                  const pct = Math.round((value / peak) * 100);
                  return (
                    <div key={w.start} className="flex h-full flex-1 items-end justify-center">
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
                {volume.map((w) => (
                  <div key={w.start} className="flex flex-1 flex-col items-center gap-1">
                    <span className="metric text-xs text-foreground">{nf.format(volumeValue(w))}</span>
                    <span className="label-status text-muted-foreground">{w.label}</span>
                    <span
                      className={cn('h-2 w-2', w.current ? 'bg-accent' : 'bg-transparent')}
                      aria-hidden="true"
                    />
                  </div>
                ))}
              </div>
            </>
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
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="label-caps text-muted-foreground">
                      <span className="metric text-foreground">{nf.format(goal.current)}</span> /{' '}
                      {nf.format(goal.target)} {UNIT_LABEL[goal.unit]}
                    </span>
                    <GoalValue goal={goal} onSave={(v) => saveGoal(goal.id, v)} />
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
