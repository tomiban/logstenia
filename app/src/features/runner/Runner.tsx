import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { SessionSet } from '@/repositories';
import { isTimedExercise } from '@/lib/exercise';
import { pluralForm } from '@/lib/format';
import { BLOCK_TYPE_LABEL, restLabel } from '@/lib/labels';
import Cronometro from './Cronometro';
import { buscarSerie, clampSeconds, num, setUnlocked, skipDialogCopy } from './runnerLogic';
import { type WorkoutStep } from './steps';
import { newSetValue, useRunner, type Mark, type RunnerProgression, type SetValue } from './useRunner';

type ExerciseStepProps = {
  step: WorkoutStep;
  setCount: number;
  sets: SessionSet[];
  register: (setIndex: number, value: string) => void;
  values: SetValue[];
  setValues: (next: SetValue[]) => void;
  marks: Record<string, Mark>;
  blocked: boolean;
  /** La banda de la pantalla ya nombra este ejercicio: el paso no repite su encabezado. */
  encabezado?: boolean;
};

/** Ceiling for a hold the plan does not time ("mantenimiento máx."). */
const STANDARD_HOLD_SECONDS = 60;

function ExerciseStep({
  step,
  setCount,
  sets,
  register,
  values,
  setValues,
  marks,
  blocked,
  encabezado = true,
}: ExerciseStepProps) {
  const exercise = step.exercise;
  const list = values;
  const [editing, setEditing] = useState<Set<number>>(new Set());

  const isTimed = isTimedExercise(exercise);
  const maxSeconds = exercise.timeSec ?? STANDARD_HOLD_SECONDS;
  const objetivo = exercise.timeSec
    ? restLabel(exercise.timeSec)
    : exercise.reps
      ? `${exercise.reps} reps`
      : isTimed
        ? 'mantenimiento máx.'
        : '—';

  /* One lookup for "is this set registered": the same helper `setUnlocked` and the rest logic use. */
  const alreadyRegistered = (i: number) => buscarSerie(sets, exercise.name, step.blockIdx, i + 1) !== undefined;

  /** A timed set never holds more than the exercise's ceiling, whatever wrote the value. */
  const writeValue = (i: number, v: string) => {
    const value = isTimed ? String(clampSeconds(v, maxSeconds)) : v;
    setValues(list.map((x, j) => (j === i ? { ...x, value } : x)));
  };

  /** Registers the set: `useRunner` opens the set rest once the block round is complete. */
  const confirmSet = (i: number) => {
    const v = list[i];
    if (!v) return;
    const value = isTimed ? String(clampSeconds(v.value, maxSeconds)) : v.value;
    if (!value) return;
    register(i + 1, value);
  };

  return (
    <div className="space-y-5">
      {encabezado && (
        <div>
          <div className="flex items-center gap-2">
            <span className="label-caps">Bloque {step.blockIdx + 1}</span>
            <Badge variant="outline" className="label-status border-border text-muted-foreground">{BLOCK_TYPE_LABEL[step.block.type]}</Badge>
          </div>
          <h2 className="mt-1 font-heading text-2xl font-bold leading-tight">{exercise.name}</h2>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
            <div>
              <dt className="label-caps text-muted-foreground">Objetivo</dt>
              <dd className="metric text-base text-foreground">{objetivo}</dd>
            </div>
            <div>
              <dt className="label-caps text-muted-foreground">Series</dt>
              <dd className="metric text-base text-foreground">{setCount}</dd>
            </div>
            <div>
              <dt className="label-caps text-muted-foreground">Descanso</dt>
              <dd className="metric text-base text-foreground">{restLabel(step.restAfterSetSec)}</dd>
            </div>
            <div>
              <dt className="label-caps text-muted-foreground">Descanso final</dt>
              <dd className="metric text-base text-foreground">{restLabel(step.restAfterExerciseSec)}</dd>
            </div>
          </dl>
        </div>
      )}

      {isTimed && (
        <Cronometro modo="crono" objetivo={exercise.timeSec} onUsar={(s: number) => {
          const libre = list.findIndex((v) => !v.value);
          const idx = libre !== -1 ? libre : list.length - 1;
          writeValue(idx, String(s));
        }} usarDisabled={false} />
      )}

      {blocked && (
        <div className="border border-ink bg-card p-3 text-center">
          <p className="label-caps text-foreground">descansando… no se puede editar</p>
        </div>
      )}

      <div className="divide-y divide-border">
        {list.map((v, i) => {
          /* The round is the unit of a block: the next row waits for every exercise, not just this one. */
          const enabled = setUnlocked(sets, step.blockIdx, step.block.exercises, i);
          const mark = marks[`${step.blockIdx}#${step.exIdx}#${i + 1}`];
          return (
            <div key={v.id} className="py-2">
              <div className="grid grid-cols-[2rem_minmax(0,1fr)_3.5rem] items-center gap-3">
                <span className="label-status text-muted-foreground">S{i + 1}</span>
                {isTimed ? (
                  <input type="range" min={0} max={maxSeconds} step={1} value={v.value || 0}
                    onChange={(e) => { if (!enabled) return; writeValue(i, e.target.value); }}
                    disabled={!enabled || blocked || (alreadyRegistered(i) && !editing.has(i))}
                    style={{ backgroundImage: `linear-gradient(to right, var(--accent) ${fillPercent(clampSeconds(v.value, maxSeconds), maxSeconds)}%, var(--muted-surface) ${fillPercent(clampSeconds(v.value, maxSeconds), maxSeconds)}%)` }}
                    className="w-full disabled:opacity-40" aria-label={`Segundos serie ${i + 1}`} />
                ) : (
                  <Input type="number"
                    className={'h-11 w-full ' + (!enabled || blocked || (alreadyRegistered(i) && !editing.has(i)) ? 'pointer-events-none opacity-40' : '')}
                    value={v.value || ''} onChange={(e) => writeValue(i, e.target.value)} placeholder="reps" />
                )}
                <span className="metric text-right text-foreground">{isTimed ? `${clampSeconds(v.value, maxSeconds)}s` : ''}</span>
              </div>
              {(enabled && v.value) || mark ? (
                <div className="mt-1 flex flex-wrap items-center justify-end gap-2">
                  {mark === 'pr' && (
                    <Badge className="label-status border border-ink bg-accent text-on-accent">▲ nuevo PR</Badge>
                  )}
                  {mark === 'first' && (
                    <Badge variant="outline" className="label-status">primera marca</Badge>
                  )}
                  {enabled && v.value && (
                    alreadyRegistered(i) && !editing.has(i) ? (
                      <Button variant="ghost" size="lg" className="label-caps" disabled={blocked}
                        onClick={() => setEditing((prev) => new Set(prev).add(i))}>editar</Button>
                    ) : (
                      <Button variant="ghost" size="lg" className="label-caps" disabled={blocked}
                        onClick={() => { confirmSet(i); setEditing((prev) => { const n = new Set(prev); n.delete(i); return n; }); }}>
                        confirmar
                      </Button>
                    )
                  )}
                </div>
              ) : null}
            </div>
          );
        })}
        <div className="flex gap-2 pt-2">
          <Button variant="ghost" size="lg" className="label-caps text-muted-foreground" onClick={() => setValues([...list, newSetValue()])}>+ serie</Button>
          {list.length > 1 && (
            <Button variant="ghost" size="lg" className="label-caps text-muted-foreground" onClick={() => setValues(list.slice(0, -1))}>− serie</Button>
          )}
        </div>
      </div>
    </div>
  );
}

/** How much of the rail is filled: the slider paints it, the component only supplies the number. */
function fillPercent(seconds: number, max: number): number {
  if (!Number.isFinite(seconds) || max <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((seconds / max) * 100)));
}

function CriteriaList({ anchors }: { anchors: RunnerProgression['report']['anchors'] }) {
  return (
    <ul className="space-y-1">
      {anchors.map((a) => (
        <li key={a.ejercicio} className="flex flex-wrap items-center gap-2 text-sm">
          <span className="metric text-foreground">{a.objetivo}</span>
          <span className="text-muted-foreground">{a.unidad === 'sec' ? 'seg' : 'reps'}</span>
          <span className="text-foreground">{a.ejercicio}</span>
          {a.mejor > 0 && <span className="label-caps text-muted-foreground">(mejor: {a.mejor})</span>}
        </li>
      ))}
    </ul>
  );
}

/** Announces whether the session opened the next level and offers to jump to it. */
function BloqueNivel({ progression }: { progression: RunnerProgression | null }) {
  const navigate = useNavigate();
  const [hidden, setHidden] = useState(false);
  if (!progression || hidden) return null;
  const { report, advanced, completedNow, touchedCriteria } = progression;

  const completedNote = completedNow ? (
    <div className="border border-ink bg-card px-3 py-2">
      <p className="label-caps text-foreground">Nivel completado: {report.name}</p>
    </div>
  ) : null;

  if (advanced && report.next) {
    return (
      <div className="space-y-2">
        {completedNote}
        <div className="space-y-2 border border-ink bg-accent p-3">
          <p className="label-caps text-on-accent">Nivel desbloqueado</p>
          <p className="font-heading text-xl font-bold text-on-accent">{report.next.name}</p>
          <p className="text-sm text-on-accent">¿Querés ir al siguiente nivel?</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="ink" size="sm" onClick={() => navigate(`/program/${report.next!.id}`)}>
              Ir al siguiente nivel
            </Button>
            <Button variant="ghost" size="sm" className="label-caps text-on-accent" onClick={() => setHidden(true)}>
              Ahora no
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (report.next && !report.next.unlocked) {
    if (!touchedCriteria) return completedNote;
    return (
      <div className="space-y-2">
        {completedNote}
        <div className="space-y-2 border border-border bg-secondary p-3">
          <p className="label-caps text-foreground">Todavía no desbloqueás {report.next.name}</p>
          <CriteriaList anchors={report.missing} />
          <p className="text-sm text-muted-foreground">Volvé a tomar las marcas cuando las superes.</p>
        </div>
      </div>
    );
  }

  if (!report.next) return completedNote;

  return (
    <div className="space-y-2">
      {completedNote}
      <div className="flex flex-wrap items-center justify-between gap-2 border border-border bg-card p-3">
        <p className="label-caps text-muted-foreground">
          Siguiente nivel desbloqueado: <span className="text-foreground">{report.next.name}</span>
        </p>
        <Button variant="outline" size="sm" onClick={() => navigate(`/program/${report.next!.id}`)}>Ir</Button>
      </div>
    </div>
  );
}

function Fin({ result, onBack, progression, history }: { result: { sets: SessionSet[] }; onBack: () => void; progression: RunnerProgression | null; history: Record<string, number[]> }) {
  const rows = (() => {
    const byExercise: Record<string, { exercise: string; unit: string; values: number[] }> = {};
    for (const l of result.sets || []) {
      const v = num(l.value);
      if (isNaN(v)) continue;
      const r = (byExercise[l.exercise] ||= { exercise: l.exercise, unit: l.unit, values: [] });
      r.values.push(v);
    }
    return Object.values(byExercise).map((r) => {
      const best = Math.max(...r.values);
      const previous = history[r.exercise] ?? [];
      return { ...r, best, sets: r.values.length, pr: previous.length > 0 && best > Math.max(...previous), first: previous.length === 0 };
    });
  })();

  return (
    <div className="-mx-6 -mt-6">
      <header className="banda">
        <div className="min-w-0">
          <p className="banda-kicker">Entrenamiento terminado</p>
          <h1 className="banda-titulo banda-titulo-ejercicio">
            {rows.length} {rows.length === 1 ? 'ejercicio' : 'ejercicios'}
          </h1>
          <p className="banda-sub">
            <span className="whitespace-nowrap">guardado en este navegador</span>
          </p>
        </div>
        <span aria-hidden="true" className="banda-flecha">
          →
        </span>
      </header>
      <div className="space-y-3 px-6 py-5">
        <BloqueNivel progression={progression} />
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">no registraste series en este entrenamiento</p>
        ) : (
          rows.map((f: { exercise: string; unit: string; values: number[]; best: number; sets: number; pr: boolean; first: boolean }) => (
            <div key={f.exercise} className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2 last:border-0">
              <div className="min-w-0">
                <div className="truncate font-medium">{f.exercise}</div>
                <div className="label-caps"><span className="metric text-foreground">{f.sets}</span> series</div>
              </div>
              <div className="flex items-center gap-3">
                {f.pr && <Badge className="label-status border border-ink bg-accent text-on-accent">▲ PR</Badge>}
                {f.first && <Badge variant="outline" className="label-status">primera marca</Badge>}
                <span className="metric text-xl text-foreground">{f.best} {f.unit}</span>
              </div>
            </div>
          ))
        )}
        <Button variant="outline" size="lg" className="label-caps" onClick={onBack}>
          volver
        </Button>
      </div>
    </div>
  );
}

export default function Runner() {
  const r = useRunner();
  const navigate = useNavigate();

  /* Dead end: no way forward from here, so every exit state carries the route back to the catalogue. */
  const deadEnd = (title: string, detail: string) => (
    <div className="-mx-6 -mt-6">
      <header className="banda">
        <div className="min-w-0">
          <p className="banda-kicker">Sesión</p>
          <h1 className="banda-titulo banda-titulo-ejercicio">{title}</h1>
        </div>
        <span aria-hidden="true" className="banda-flecha">→</span>
      </header>
      <div className="space-y-3 px-6 py-5">
        <p className="text-sm text-muted-foreground">{detail}</p>
        <Button variant="accent" size="lg" className="label-caps" onClick={() => navigate('/planes')}>Ir a planes</Button>
      </div>
    </div>
  );

  if (!r.res || !r.model || !r.program) {
    return deadEnd('No encontramos esta rutina', 'El enlace puede estar roto o la rutina ya no existe en este dispositivo.');
  }

  const n = r.steps.length;
  if (n === 0) return deadEnd('Esta rutina no tiene ejercicios', 'No pudimos extraer los ejercicios de esta rutina.');

  if (r.restUntil != null && !r.finished) return (
    <div role="dialog" aria-modal="true" aria-label="Descanso en curso" className="plate-in fixed inset-0 z-50 flex flex-col items-center justify-center gap-8 bg-on-accent text-accent">
      <span className="label-caps opacity-70">{r.restLabel}</span>
      <div className="relative flex h-64 w-64 items-center justify-center">
        <svg viewBox="0 0 256 256" className="absolute inset-0 h-full w-full -rotate-90" aria-hidden="true">
          <circle cx="128" cy="128" r="120" fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" />
          <circle
            cx="128"
            cy="128"
            r="120"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeDasharray={2 * Math.PI * 120}
            strokeDashoffset={2 * Math.PI * 120 * (1 - Math.min(1, Math.max(0, r.restRemaining / Math.max(1, r.restSeconds))))}
            className="rest-ring"
          />
        </svg>
        <span key={r.restRemaining} className="digit-in metric tabular text-8xl">{String(r.restRemaining).padStart(2, '0')}</span>
      </div>
      <p className="label-caps opacity-70">descanso configurado: {r.restSeconds}s</p>
      <div className="flex items-center gap-4">
        <Button variant="outline" size="lg" className="label-caps border-accent text-accent" onClick={() => r.setRestUntil((h) => (h ? h - 10000 : null))}>-10s</Button>
        <Button variant="outline" size="lg" className="label-caps border-accent text-accent" onClick={() => r.setRestUntil((h) => (h ? h + 10000 : null))}>+10s</Button>
      </div>
      <Button variant="accent" size="lg" className="label-caps" onClick={r.skipRest}>saltar descanso</Button>
      {r.errorMessage ? <p role="alert" className="max-w-xs text-center text-sm opacity-80">{r.errorMessage}</p> : null}
    </div>
  );

  if (r.finished) return (
    <>
      {r.errorMessage ? (
        <p role="alert" className="mb-4 border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {r.errorMessage}
        </p>
      ) : null}
      <Fin result={{ sets: r.allSets }} onBack={() => r.setFinished(false)} progression={r.progression} history={r.history} />
    </>
  );

  const idx = r.idx;
  const current = r.current;

  const exerciseKey = r.exerciseKey;
  const exerciseValues = r.exerciseValues;

  const soloUnEjercicio = current.exercises.length === 1;
  const primero = current.exercises[0];
  const objetivoDelPaso = soloUnEjercicio
    ? primero.timeSec
      ? `${primero.timeSec} seg`
      : primero.reps
        ? `${primero.reps} reps`
        : 'mantenimiento máx.'
    : `${current.exercises.length} ejercicios`;
  const titulo = soloUnEjercicio ? primero.name : `Bloque ${current.blockIdx + 1}`;
  const seriesDelPaso = current.exercises.reduce((acc, _ex, i) => acc + exerciseValues(i).length, 0);
  const proximo = r.steps[idx + 1];

  return (
    <div className="-mx-6 -mt-6 flex min-h-[calc(100dvh-3.5rem)] flex-col">
      <header className="banda">
        <div className="min-w-0">
          <p className="banda-kicker">
            Bloque {current.blockIdx + 1} · {BLOCK_TYPE_LABEL[current.block.type]}
          </p>
          <h1 className="banda-titulo banda-titulo-ejercicio">{titulo}</h1>
          <p className="banda-sub flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="whitespace-nowrap">{objetivoDelPaso}</span>
            <span aria-hidden="true">·</span>
            <span className="whitespace-nowrap">{seriesDelPaso} series</span>
            <span aria-hidden="true">·</span>
            <span className="whitespace-nowrap">descanso {restLabel(current.restAfterSetSec)}</span>
          </p>
        </div>
        <span aria-hidden="true" className="banda-flecha">
          →
        </span>
      </header>

      <div className="h-1 w-full bg-secondary" role="progressbar" aria-valuemin={0} aria-valuemax={n} aria-valuenow={idx + 1}>
        <div className="h-full bg-ink dark:bg-foreground" style={{ width: `${((idx + 1) / n) * 100}%` }} />
      </div>

      <div className="franja border-border">
        <span className="label-caps text-foreground">
          Paso {idx + 1} de {n}
        </span>
        <span className="label-caps text-muted-foreground">
          {r.unregistered > 0
            ? `faltan ${r.unregistered} ${pluralForm(r.unregistered, 'serie', 'series')}`
            : 'sin series pendientes'}
        </span>
      </div>

      <section key={`${current.blockIdx}-${idx}`} className="plate-in space-y-6 px-6 py-5">
          {current.exercises.map((ex, ei) => {
            const exStep = {
              blockIdx: current.blockIdx,
              exIdx: ei,
              block: current.block,
              exercise: ex,
              exercises: [ex],
              restAfterSetSec: current.restAfterSetSec,
              restAfterExerciseSec: current.restAfterExerciseSec,
            };
            const key = exerciseKey(ei);
            const list = exerciseValues(ei);
            return (
              <ExerciseStep
                key={key}
                step={exStep}
                setCount={list.length}
                sets={r.allSets}
                register={(setIndex: number, value: string) => r.confirmSet(current.blockIdx, ei, ex, setIndex, value)}
                values={list}
                setValues={(next: SetValue[]) => r.setValues((v) => ({ ...v, [key]: next }))}
                marks={r.marks}
                blocked={r.restUntil != null}
                encabezado={!soloUnEjercicio}
              />
            );
          })}
      </section>

      {proximo && (
        <button type="button" className="fila mt-auto" onClick={r.nextStep} disabled={r.restUntil != null}>
          <span className="label-caps shrink-0 text-muted-foreground">Después</span>
          <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">
            {proximo.exercises.map((e) => e.name).join(' ＋ ')}
          </span>
          <span className="label-caps shrink-0 text-muted-foreground">B{proximo.blockIdx + 1}</span>
          <span aria-hidden="true" className="flecha">
            →
          </span>
        </button>
      )}

      {r.skipDialog && (
        <div role="dialog" aria-modal="true" aria-labelledby="modal-omitir-title" className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-4">
          <div
            ref={r.skipDialogRef}
            tabIndex={-1}
            className="w-full max-w-sm space-y-4 border border-ink bg-card p-6"
            onKeyDown={(e) => { if (e.key === 'Escape') r.setSkipDialog(null); }}
          >
            <p id="modal-omitir-title" className="label-caps text-foreground">series sin registrar</p>
            <p className="text-sm text-foreground">{skipDialogCopy(r.skipDialog)}</p>
            <div className="flex gap-2">
              <Button variant="ghost" size="lg" className="flex-1" onClick={() => r.setSkipDialog(null)}>Cancelar</Button>
              <Button variant="accent" size="lg" className="flex-1" onClick={() => { r.setSkipDialog(null); r.advance(); }}>Continuar</Button>
            </div>
          </div>
        </div>
      )}

      <div className="accion accion-pie">
        <button
          type="button"
          className="min-h-11 shrink-0 font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-on-accent underline underline-offset-4 disabled:opacity-40 disabled:no-underline"
          disabled={idx === 0 || r.restUntil != null}
          onClick={() => r.goTo(idx - 1)}
        >
          Anterior
        </button>
        <button
          type="button"
          className="flex items-baseline gap-3 disabled:opacity-40"
          disabled={r.restUntil != null}
          onClick={r.nextStep}
        >
          <span className="accion-titulo">{idx >= n - 1 ? 'Finalizar' : 'Siguiente'}</span>
          <span aria-hidden="true" className="flecha text-[24px]">
            →
          </span>
        </button>
      </div>
    </div>
  );
}
