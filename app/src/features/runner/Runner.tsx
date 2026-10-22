import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Cronometro from './Cronometro';
import type { SessionSet } from '@/db';
import { createSessionRepository } from '@/repositories';
import { num } from './runnerLogic';
import { type WorkoutStep } from './steps';
import { useRunner, type Marca, type SerieValor } from './useRunner';

type PasoProps = {
  step: WorkoutStep;
  series: number;
  sets: SessionSet[];
  registrar: (setIndex: number, value: string) => void;
  valores: SerieValor[];
  setValores: (next: SerieValor[]) => void;
  marcas: Record<string, Marca>;
  bloqueado: boolean;
  onDescansoSerie: (segundos: number) => void;
};

function Paso({
  step,
  series,
  sets,
  registrar,
  valores,
  setValores,
  marcas,
  bloqueado,
  onDescansoSerie,
}: PasoProps) {
  const exercise = step.exercise;
  const lista = valores;
  const [editando, setEditando] = useState<Set<number>>(new Set());

  const esTiempo = (!!exercise.timeSec && !exercise.reps)
    || (Array.isArray(exercise.tags) && exercise.tags.includes('isometricos'));

  const yaRegistrada = (i: number) => sets.some((l) =>
    l.exercise === exercise.name && l.setIndex === i + 1 && l.bloqueOrden === step.blockIdx);

  const set = (i: number, v: string) => {
    setValores(lista.map((x, j) => (j === i ? { ...x, value: v } : x)));
  };

  /** Descanso configurado tras la serie `i` (la última serie usa el descanso final). */
  const descansoDeSerie = (i: number) => (i < series - 1 ? step.restAfterSetSec : step.restAfterExerciseSec);

  /** Registra la serie y dispara el descanso de serie configurado. */
  const confirmarSerie = (i: number) => {
    const v = lista[i];
    if (!v || !v.value) return;
    registrar(i + 1, v.value);
    if (i >= series - 1) return;
    const segundos = descansoDeSerie(i);
    if (segundos > 0) onDescansoSerie(segundos);
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
            {exercise.timeSec ? `objetivo ${exercise.timeSec}s` : esTiempo ? `objetivo ${exercise.reps || 'max'} hold` : (exercise.reps ? `objetivo ${exercise.reps} reps` : '')}
            {` · ${series} series`}
            {` · descanso por serie ${step.restAfterSetSec}s`}
            {` · descanso final ${step.restAfterExerciseSec}s`}
          </p>
        </div>
      </div>

      {esTiempo && (
        <Cronometro modo="crono" objetivo={exercise.timeSec} onUsar={(s: number) => {
          const libre = lista.findIndex((v) => !v.value);
          const idx = libre !== -1 ? libre : lista.length - 1;
          set(idx, String(s));
        }} usarDisabled={false} />
      )}

      {bloqueado && (
        <div className="border border-ink bg-card p-3 text-center">
          <p className="label-caps text-foreground">descansando… no se puede editar</p>
        </div>
      )}

      <div className="divide-y divide-border">
        {lista.map((v, i) => {
          const anteriorRegistrada = i === 0 || yaRegistrada(i - 1);
          const habilitada = i === 0 || anteriorRegistrada;
          const marca = marcas[`${step.blockIdx}#${step.exIdx}#${i + 1}`];
          return (
            <div key={i} className="flex flex-wrap items-center gap-3 py-2">
              <span className="label-status w-8 text-muted-foreground">S{i + 1}</span>
              {esTiempo ? (
                <div className={`flex min-w-0 flex-1 items-center gap-3 ${!habilitada ? 'pointer-events-none opacity-40' : ''}`}>
                  <input type="range" min={0} max={20} step={1} value={v.value || 0}
                    onChange={(e) => { if (!habilitada) return; set(i, e.target.value); }}
                    disabled={!habilitada || bloqueado || (yaRegistrada(i) && !editando.has(i))}
                    className="w-56 disabled:opacity-40 accent-ink" aria-label={`Segundos serie ${i + 1}`} />
                  <span className="metric w-14 text-right text-foreground">{v.value || 0}s</span>
                </div>
              ) : (
                <div className={!habilitada || bloqueado || (yaRegistrada(i) && !editando.has(i)) ? 'pointer-events-none opacity-40' : ''}>
                  <Input type="number" className="h-9 w-24" value={v.value || ''} onChange={(e) => set(i, e.target.value)} placeholder="reps" />
                </div>
              )}
              {habilitada && v.value && (
                yaRegistrada(i) && !editando.has(i) ? (
                  <Button variant="ghost" size="sm" className="label-caps h-8" disabled={bloqueado}
                    onClick={() => setEditando((prev) => new Set(prev).add(i))}>editar</Button>
                ) : (
                  <Button variant="ghost" size="sm" className="label-caps h-8" disabled={bloqueado}
                    onClick={() => { confirmarSerie(i); setEditando((prev) => { const n = new Set(prev); n.delete(i); return n; }); }}>
                    confirmar
                  </Button>
                )
              )}
              {marca === 'pr' && (
                <Badge className="label-status border border-ink bg-accent text-ink">▲ nuevo PR</Badge>
              )}
              {marca === 'primera' && (
                <Badge className="label-status border border-ink text-ink">primera marca</Badge>
              )}
            </div>
          );
        })}
        <div className="flex gap-2 pt-2">
          <Button variant="ghost" size="sm" className="label-caps h-9 text-muted-foreground" onClick={() => setValores([...lista, { value: '' }])}>+ serie</Button>
          {lista.length > 1 && (
            <Button variant="ghost" size="sm" className="label-caps h-9 text-muted-foreground" onClick={() => setValores(lista.slice(0, -1))}>− serie</Button>
          )}
        </div>
      </div>
    </div>
  );
}

function Fin({ estado, onVolver }: { ses?: { id: string; name: string }; estado: { sets: SessionSet[] }; onVolver: () => void }) {
  const [prevMap, setPrevMap] = useState<Record<string, number[]>>({});
  useEffect(() => {
    (async () => {
      const sessions = await createSessionRepository().list();
      const map: Record<string, number[]> = {};
      for (const s of sessions) {
        if (!s.completed) continue;
        for (const set of s.sets || []) {
          const v = num(set.value);
          if (isNaN(v)) continue;
          (map[set.exercise] ||= []).push(v);
        }
      }
      setPrevMap(map);
    })();
  }, []);
  const filas = (() => {
    const por: Record<string, { ej: string; unidad: string; vals: number[] }> = {};
    for (const l of estado.sets || []) {
      const v = num(l.value);
      if (isNaN(v)) continue;
      const r = (por[l.exercise] ||= { ej: l.exercise, unidad: l.unit, vals: [] });
      r.vals.push(v);
    }
    return Object.values(por).map((r) => {
      const mejor = Math.max(...r.vals);
      const previos = (prevMap[r.ej] || []).map((v: number) => num(v)).filter((n: number) => !isNaN(n));
      return { ...r, mejor, sets: r.vals.length, pr: previos.length > 0 && mejor > Math.max(...previos), primera: previos.length === 0 };
    });
  })();

  return (
    <Card>
      <div className="border-b border-border px-4 py-2 flex items-center justify-between">
        <span className="label-caps text-foreground">Entrenamiento terminado · {filas.length} {filas.length === 1 ? 'ejercicio' : 'ejercicios'}</span>
        <Button variant="ghost" size="sm" onClick={onVolver}>volver</Button>
      </div>
      <div className="p-4 space-y-3">
        {filas.length === 0 ? (
          <p className="label-caps">no registraste series en este entrenamiento</p>
        ) : (
          filas.map((f: { ej: string; unidad: string; vals: number[]; mejor: number; sets: number; pr: boolean; primera: boolean }) => (
            <div key={f.ej} className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2 last:border-0">
              <div className="min-w-0">
                <div className="truncate font-medium">{f.ej}</div>
                <div className="label-caps"><span className="metric text-foreground">{f.sets}</span> series</div>
              </div>
              <div className="flex items-center gap-3">
                {f.pr && <Badge className="label-status border border-ink bg-accent text-ink">▲ PR</Badge>}
                {f.primera && <Badge className="label-status border border-ink text-ink">primera marca</Badge>}
                <span className="metric text-xl text-foreground">{f.mejor} {f.unidad}</span>
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

  if (r.descansoHasta != null && !r.fin) return (
    <div role="dialog" aria-modal="true" aria-label="Descanso en curso" className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-8 bg-primary text-accent">
      <span className="label-caps opacity-70">{r.descansoEtiqueta}</span>
      <div className="relative flex h-64 w-64 items-center justify-center">
        <div className="absolute inset-0 animate-spin rounded-full! border-4 border-transparent border-t-[var(--voltage-lime)] border-r-[var(--voltage-lime)]/50" />
        <span className="metric tabular text-8xl">{String(r.segRestantes).padStart(2, '0')}</span>
      </div>
      <p className="label-caps opacity-70">descanso configurado: {r.descansoSegundos}s</p>
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" className="label-caps" onClick={() => r.setDescansoHasta((h) => (h ? h - 10000 : null))}>-10s</Button>
        <p className="label-caps opacity-70">descansando</p>
        <Button variant="outline" size="sm" className="label-caps" onClick={() => r.setDescansoHasta((h) => (h ? h + 10000 : null))}>+10s</Button>
      </div>
      <Button variant="accent" size="lg" className="label-caps" onClick={r.omitirDescanso}>saltar descanso</Button>
    </div>
  );

  if (r.fin) return (
    <>
      {r.errorMsg ? (
        <p role="alert" className="label-caps mb-4 border border-ink bg-accent px-4 py-3 text-ink">
          {r.errorMsg}
        </p>
      ) : null}
      <Fin ses={{ id: r.model.id, name: r.model.name }} estado={{ sets: r.allSets }} onVolver={() => r.setFin(false)} />
    </>
  );

  const idx = r.idx;
  const actual = r.step;

  const exKey = r.exKey;
  const exLista = r.exLista;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="h-1 w-full bg-secondary" role="progressbar" aria-valuemin={0} aria-valuemax={n} aria-valuenow={idx + 1}>
        <div className="h-full bg-accent" style={{ width: `${((idx + 1) / n) * 100}%` }} />
      </div>

      <Card>
        <div className="p-4 space-y-6">
          {actual.exercises.map((ex, ei) => {
            const exStep = {
              blockIdx: actual.blockIdx,
              exIdx: ei,
              block: actual.block,
              exercise: ex,
              exercises: [ex],
              restAfterSetSec: actual.restAfterSetSec,
              restAfterExerciseSec: actual.restAfterExerciseSec,
            };
            const key = exKey(ei);
            const lista = exLista(ei);
            return (
              <Paso
                key={key}
                step={exStep}
                series={lista.length}
                sets={r.allSets}
                registrar={(setIndex: number, value: string) => r.registrarEx(actual.blockIdx, ei, ex, setIndex, value)}
                valores={lista}
                setValores={(next: SerieValor[]) => r.setVals((v) => ({ ...v, [key]: next }))}
                marcas={r.marcas}
                bloqueado={r.descansoHasta != null}
                onDescansoSerie={(segundos: number) => r.iniciarDescanso(segundos, 'Descanso de serie', null)}
              />
            );
          })}
        </div>
      </Card>

      {r.modalOmitir && (
        <div role="dialog" aria-modal="true" aria-labelledby="modal-omitir-title" className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-4">
          <div
            ref={r.modalRef}
            tabIndex={-1}
            className="w-full max-w-sm space-y-4 border border-ink bg-card p-6"
            onKeyDown={(e) => { if (e.key === 'Escape') r.setModalOmitir(null); }}
          >
            <p id="modal-omitir-title" className="label-caps text-foreground">series sin registrar</p>
            <p className="text-sm text-foreground">
              Quedan {r.modalOmitir.pendientes} {r.modalOmitir.pendientes === 1 ? 'serie' : 'series'} sin registrar.
              {' '}Si continuás, {r.modalOmitir.pendientes === 1 ? 'se omite' : 'se omiten'}.
            </p>
            <div className="flex gap-2">
              <Button variant="ghost" className="flex-1" onClick={() => r.setModalOmitir(null)}>Cancelar</Button>
              <Button variant="accent" className="flex-1" onClick={() => { r.setModalOmitir(null); r.avanzar(); }}>Continuar</Button>
            </div>
          </div>
        </div>
      )}

      <div className="sticky bottom-0 -mx-4 sm:-mx-6 flex flex-wrap items-center justify-between gap-3 border-t border-border bg-background px-6 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <Button variant="outline" disabled={idx === 0 || r.descansoHasta != null} onClick={() => r.irA(idx - 1)}>Anterior</Button>
        <span className="label-caps"><span className="metric text-base text-foreground">{idx + 1}</span> / {n}{r.sinRegistrar > 0 && (<> · <span className="text-ink">quedan {r.sinRegistrar} sin registrar</span></>)}</span>
        <Button variant="accent" disabled={r.descansoHasta != null} onClick={r.siguiente}>{idx >= n - 1 ? 'Finalizar entrenamiento' : 'Siguiente'}</Button>
      </div>
    </div>
  );
}
