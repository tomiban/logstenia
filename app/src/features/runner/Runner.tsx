import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Cronometro from './Cronometro';
import type { SessionSet } from '@/repositories';
import { num } from './runnerLogic';
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
};

function ExerciseStep({
  step,
  setCount,
  sets,
  register,
  values,
  setValues,
  marks,
  blocked,
}: ExerciseStepProps) {
  const exercise = step.exercise;
  const list = values;
  const [editing, setEditing] = useState<Set<number>>(new Set());

  const isTimed = (!!exercise.timeSec && !exercise.reps)
    || (Array.isArray(exercise.tags) && exercise.tags.includes('isometricos'));

  const alreadyRegistered = (i: number) => sets.some((l) =>
    l.exercise === exercise.name && l.setIndex === i + 1 && l.bloqueOrden === step.blockIdx);

  const setAt = (i: number, v: string) => {
    setValues(list.map((x, j) => (j === i ? { ...x, value: v } : x)));
  };

  /** Registers the set: `useRunner` opens the set rest once the block round is complete. */
  const confirmSet = (i: number) => {
    const v = list[i];
    if (!v || !v.value) return;
    register(i + 1, v.value);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="label-caps">Bloque {step.blockIdx}</span>
            <Badge variant="outline" className="label-status border-border text-muted-foreground">{step.block.type}</Badge>
          </div>
          <h2 className="mt-1 font-heading text-2xl font-bold leading-tight">{exercise.name}</h2>
          <p className="label-caps mt-1">
            {exercise.timeSec ? `objetivo ${exercise.timeSec}s` : isTimed ? `objetivo ${exercise.reps || 'max'} hold` : (exercise.reps ? `objetivo ${exercise.reps} reps` : '')}
            {` · ${setCount} series`}
            {` · descanso por serie ${step.restAfterSetSec}s`}
            {` · descanso final ${step.restAfterExerciseSec}s`}
          </p>
        </div>
      </div>

      {isTimed && (
        <Cronometro modo="crono" objetivo={exercise.timeSec} onUsar={(s: number) => {
          const libre = list.findIndex((v) => !v.value);
          const idx = libre !== -1 ? libre : list.length - 1;
          setAt(idx, String(s));
        }} usarDisabled={false} />
      )}

      {blocked && (
        <div className="border border-ink bg-card p-3 text-center">
          <p className="label-caps text-foreground">descansando… no se puede editar</p>
        </div>
      )}

      <div className="divide-y divide-border">
        {list.map((v, i) => {
          const previousRegistered = i === 0 || alreadyRegistered(i - 1);
          const enabled = i === 0 || previousRegistered;
          const mark = marks[`${step.blockIdx}#${step.exIdx}#${i + 1}`];
          return (
            <div key={v.id} className="flex flex-wrap items-center gap-3 py-2">
              <span className="label-status w-8 text-muted-foreground">S{i + 1}</span>
              {isTimed ? (
                <div className={`flex min-w-0 flex-1 items-center gap-3 ${!enabled ? 'pointer-events-none opacity-40' : ''}`}>
                  <input type="range" min={0} max={20} step={1} value={v.value || 0}
                    onChange={(e) => { if (!enabled) return; setAt(i, e.target.value); }}
                    disabled={!enabled || blocked || (alreadyRegistered(i) && !editing.has(i))}
                    className="w-56 disabled:opacity-40 accent-ink" aria-label={`Segundos serie ${i + 1}`} />
                  <span className="metric w-14 text-right text-foreground">{v.value || 0}s</span>
                </div>
              ) : (
                <div className={!enabled || blocked || (alreadyRegistered(i) && !editing.has(i)) ? 'pointer-events-none opacity-40' : ''}>
                  <Input type="number" className="h-9 w-24" value={v.value || ''} onChange={(e) => setAt(i, e.target.value)} placeholder="reps" />
                </div>
              )}
              {enabled && v.value && (
                alreadyRegistered(i) && !editing.has(i) ? (
                  <Button variant="ghost" size="sm" className="label-caps h-8" disabled={blocked}
                    onClick={() => setEditing((prev) => new Set(prev).add(i))}>editar</Button>
                ) : (
                  <Button variant="ghost" size="sm" className="label-caps h-8" disabled={blocked}
                    onClick={() => { confirmSet(i); setEditing((prev) => { const n = new Set(prev); n.delete(i); return n; }); }}>
                    confirmar
                  </Button>
                )
              )}
              {mark === 'pr' && (
                <Badge className="label-status border border-ink bg-accent text-on-accent">▲ nuevo PR</Badge>
              )}
              {mark === 'first' && (
                <Badge className="label-status border border-ink text-ink">primera marca</Badge>
              )}
            </div>
          );
        })}
        <div className="flex gap-2 pt-2">
          <Button variant="ghost" size="sm" className="label-caps h-9 text-muted-foreground" onClick={() => setValues([...list, newSetValue()])}>+ serie</Button>
          {list.length > 1 && (
            <Button variant="ghost" size="sm" className="label-caps h-9 text-muted-foreground" onClick={() => setValues(list.slice(0, -1))}>− serie</Button>
          )}
        </div>
      </div>
    </div>
  );
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
          <p className="label-caps text-muted-foreground">Volvé a tomar las marcas cuando las superes.</p>
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
    <Card>
      <div className="border-b border-border px-4 py-2 flex items-center justify-between">
        <span className="label-caps text-foreground">Entrenamiento terminado · {rows.length} {rows.length === 1 ? 'ejercicio' : 'ejercicios'}</span>
        <Button variant="ghost" size="sm" onClick={onBack}>volver</Button>
      </div>
      <div className="p-4 space-y-3">
        <BloqueNivel progression={progression} />
        {rows.length === 0 ? (
          <p className="label-caps">no registraste series en este entrenamiento</p>
        ) : (
          rows.map((f: { exercise: string; unit: string; values: number[]; best: number; sets: number; pr: boolean; first: boolean }) => (
            <div key={f.exercise} className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2 last:border-0">
              <div className="min-w-0">
                <div className="truncate font-medium">{f.exercise}</div>
                <div className="label-caps"><span className="metric text-foreground">{f.sets}</span> series</div>
              </div>
              <div className="flex items-center gap-3">
                {f.pr && <Badge className="label-status border border-ink bg-accent text-on-accent">▲ PR</Badge>}
                {f.first && <Badge className="label-status border border-ink text-ink">primera marca</Badge>}
                <span className="metric text-xl text-foreground">{f.best} {f.unit}</span>
              </div>
            </div>
          ))
        )}
        <p className="label-caps text-muted-foreground">guardado en este navegador</p>
      </div>
    </Card>
  );
}

export default function Runner() {
  const r = useRunner();

  if (!r.res || !r.model || !r.program) return <p>Rutina no encontrada.</p>;

  const n = r.steps.length;
  if (n === 0) return <Card><div className="p-4"><p className="label-caps">no se pudieron extraer los ejercicios de este entrenamiento</p></div></Card>;

  if (r.restUntil != null && !r.finished) return (
    <div role="dialog" aria-modal="true" aria-label="Descanso en curso" className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-8 bg-on-accent text-accent">
      <span className="label-caps opacity-70">{r.restLabel}</span>
      <div className="relative flex h-64 w-64 items-center justify-center">
        <div className="absolute inset-0 animate-spin rounded-full! border-4 border-transparent border-t-accent border-r-accent/50" />
        <span className="metric tabular text-8xl">{String(r.restRemaining).padStart(2, '0')}</span>
      </div>
      <p className="label-caps opacity-70">descanso configurado: {r.restSeconds}s</p>
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" className="label-caps border-accent text-accent" onClick={() => r.setRestUntil((h) => (h ? h - 10000 : null))}>-10s</Button>
        <p className="label-caps opacity-70">descansando</p>
        <Button variant="outline" size="sm" className="label-caps border-accent text-accent" onClick={() => r.setRestUntil((h) => (h ? h + 10000 : null))}>+10s</Button>
      </div>
      <Button variant="accent" size="lg" className="label-caps" onClick={r.skipRest}>saltar descanso</Button>
      {r.errorMessage ? <p role="alert" className="label-caps max-w-xs text-center opacity-80">{r.errorMessage}</p> : null}
    </div>
  );

  if (r.finished) return (
    <>
      {r.errorMessage ? (
        <p role="alert" className="label-caps mb-4 border border-ink bg-accent px-4 py-3 text-on-accent">
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

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="h-1 w-full bg-secondary" role="progressbar" aria-valuemin={0} aria-valuemax={n} aria-valuenow={idx + 1}>
        <div className="h-full bg-accent" style={{ width: `${((idx + 1) / n) * 100}%` }} />
      </div>

      <Card>
        <div className="p-4 space-y-6">
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
              />
            );
          })}
        </div>
      </Card>

      {r.skipDialog && (
        <div role="dialog" aria-modal="true" aria-labelledby="modal-omitir-title" className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-4">
          <div
            ref={r.skipDialogRef}
            tabIndex={-1}
            className="w-full max-w-sm space-y-4 border border-ink bg-card p-6"
            onKeyDown={(e) => { if (e.key === 'Escape') r.setSkipDialog(null); }}
          >
            <p id="modal-omitir-title" className="label-caps text-foreground">series sin registrar</p>
            <p className="text-sm text-foreground">
              Quedan {r.skipDialog.pending} {r.skipDialog.pending === 1 ? 'serie' : 'series'} sin registrar.
              {' '}Si continuás, {r.skipDialog.pending === 1 ? 'se omite' : 'se omiten'}.
            </p>
            <div className="flex gap-2">
              <Button variant="ghost" className="flex-1" onClick={() => r.setSkipDialog(null)}>Cancelar</Button>
              <Button variant="accent" className="flex-1" onClick={() => { r.setSkipDialog(null); r.advance(); }}>Continuar</Button>
            </div>
          </div>
        </div>
      )}

      <div className="sticky bottom-0 -mx-4 sm:-mx-6 flex flex-wrap items-center justify-between gap-3 border-t border-border bg-background px-6 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <Button variant="outline" disabled={idx === 0 || r.restUntil != null} onClick={() => r.goTo(idx - 1)}>Anterior</Button>
        <span className="label-caps"><span className="metric text-base text-foreground">{idx + 1}</span> / {n}{r.unregistered > 0 && (<> · <span className="text-ink">quedan {r.unregistered} sin registrar</span></>)}</span>
        <Button variant="accent" disabled={r.restUntil != null} onClick={r.nextStep}>{idx >= n - 1 ? 'Finalizar entrenamiento' : 'Siguiente'}</Button>
      </div>
    </div>
  );
}
