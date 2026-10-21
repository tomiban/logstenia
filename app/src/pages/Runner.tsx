import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getModel } from '../lib/plans';
import { db, type SessionSet } from '../db';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Cronometro, { desbloquearAudio } from '../components/Cronometro';
import { elapsedSeconds } from '../lib/session';
import { buildSteps, type WorkoutStep } from '../lib/steps';
import { seriesCount } from '../lib/rest';

type Marca = 'pr' | 'primera';
type Destino = { indice: number } | { fin: true } | null;

interface SerieValor {
  value: string;
}

function num(v: unknown): number {
  const n = Number(v);
  return isNaN(n) ? NaN : n;
}

/** Serie registrada de un ejercicio (por nombre de ejercicio y bloque). */
function buscarSerie(sets: SessionSet[], ejercicio: string, bloqueOrden: number, setIndex: number) {
  return sets.find((l) => l.exercise === ejercicio && l.setIndex === setIndex && l.bloqueOrden === bloqueOrden);
}

/** Resumen legible de los descansos configurados de un ejercicio. */

interface PasoProps {
  step: WorkoutStep;
  series: number;
  sets: SessionSet[];
  registrar: (setIndex: number, value: string) => void;
  valores: SerieValor[];
  setValores: (next: SerieValor[]) => void;
  marcas: Record<string, Marca>;
  bloqueado: boolean;
  onDescansoSerie: (segundos: number) => void;
}

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
            <Badge variant="outline" className="label-status border-[var(--border)] text-[var(--muted)]">{step.block.type}</Badge>
          </div>
          <h2 className="mt-1 font-heading text-2xl font-bold leading-tight">{exercise.name}</h2>
          <p className="label-caps mt-1">
            {exercise.timeSec ? `objetivo ${exercise.timeSec}s` : esTiempo ? `objetivo ${exercise.reps || 'max'} hold` : (exercise.reps ? `objetivo ${exercise.reps} reps` : '')}
            {` · ${series} series`}
            {` · descanso por serie ${step.restAfterSetSec}s`}
            {` · descanso final ${step.restAfterExerciseSec}s`}
          </p>
        </div>
        {exercise.video?.thumbnail && (
          <img
            src={exercise.video.thumbnail}
            alt=""
            loading="lazy"
            className="h-20 w-36 shrink-0 border border-[var(--border)] object-cover"
          />
        )}
      </div>

      {esTiempo && (
        <Cronometro modo="crono" objetivo={exercise.timeSec} onUsar={(s: number) => {
          const libre = lista.findIndex((v) => !v.value);
          const idx = libre !== -1 ? libre : lista.length - 1;
          set(idx, String(s));
        }} usarDisabled={false} />
      )}

      {bloqueado && (
        <div className="border border-[var(--ink)] bg-[var(--surface)] p-3 text-center">
          <p className="label-caps text-[var(--foreground)]">descansando… no se puede editar</p>
        </div>
      )}

      <div className="divide-y divide-[var(--border)]">
        {lista.map((v, i) => {
          const anteriorRegistrada = i === 0 || yaRegistrada(i - 1);
          const habilitada = i === 0 || anteriorRegistrada;
          const descanso = descansoDeSerie(i);
          const marca = marcas[`${step.blockIdx}#${step.exIdx}#${i + 1}`];
          return (
            <div key={i} className="flex flex-wrap items-center gap-3 py-2">
              <span className="label-status w-8 text-[var(--muted)]">S{i + 1}</span>
              {esTiempo ? (
                <div className={`flex min-w-0 flex-1 items-center gap-3 ${!habilitada ? 'pointer-events-none opacity-40' : ''}`}>
                  <input type="range" min={0} max={300} step={5} value={v.value || 0}
                    onChange={(e) => { if (!habilitada) return; set(i, e.target.value); }}
                    disabled={!habilitada || bloqueado || (yaRegistrada(i) && !editando.has(i))}
                    className="w-56 disabled:opacity-40 accent-[var(--ink)]" aria-label={`Segundos serie ${i + 1}`} />
                  <span className="metric w-14 text-right text-[var(--foreground)]">{v.value || 0}s</span>
                </div>
              ) : (
                <div className={!habilitada || bloqueado || (yaRegistrada(i) && !editando.has(i)) ? 'pointer-events-none opacity-40' : ''}>
                  <Input type="number" className="h-9 w-24" value={v.value || ''} onChange={(e) => set(i, e.target.value)} placeholder="reps" />
                </div>
              )}
              {!habilitada && <span className="label-status text-[var(--muted)]">completá la serie anterior</span>}
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
              <span className="label-status text-[var(--muted)]">
                {i < series - 1 ? `descanso ${descanso}s` : `descanso final ${descanso}s`}
              </span>
              {marca === 'pr' && (
                <Badge className="label-status border border-[var(--ink)] bg-[var(--voltage-lime)] text-[var(--ink)]">▲ nuevo PR</Badge>
              )}
              {marca === 'primera' && (
                <Badge className="label-status border border-[var(--ink)] text-[var(--ink)]">primera marca</Badge>
              )}
            </div>
          );
        })}
        <div className="flex gap-2 pt-2">
          <Button variant="ghost" size="sm" className="label-caps h-9 text-[var(--muted)]" onClick={() => setValores([...lista, { value: '' }])}>+ serie</Button>
          {lista.length > 1 && (
            <Button variant="ghost" size="sm" className="label-caps h-9 text-[var(--muted)]" onClick={() => setValores(lista.slice(0, -1))}>− serie</Button>
          )}
        </div>
      </div>
    </div>
  );
}

function Fin({ estado, onVolver }: any) {
  const [prevMap, setPrevMap] = useState<Record<string, number[]>>({});
  useEffect(() => {
    (async () => {
      const sessions = await db.sessions.toArray();
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
      <div className="border-b border-[var(--border)] px-4 py-2 flex items-center justify-between">
        <span className="label-caps text-[var(--foreground)]">Entrenamiento terminado · {filas.length} {filas.length === 1 ? 'ejercicio' : 'ejercicios'}</span>
        <Button variant="ghost" size="sm" onClick={onVolver}>volver</Button>
      </div>
      <div className="p-4 space-y-3">
        {filas.length === 0 ? (
          <p className="label-caps">no registraste series en este entrenamiento</p>
        ) : (
          filas.map((f: any) => (
            <div key={f.ej} className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] pb-2 last:border-0">
              <div className="min-w-0">
                <div className="truncate font-medium">{f.ej}</div>
                <div className="label-caps"><span className="metric text-[var(--foreground)]">{f.sets}</span> series</div>
              </div>
              <div className="flex items-center gap-3">
                {f.pr && <Badge className="label-status border border-[var(--ink)] bg-[var(--voltage-lime)] text-[var(--ink)]">▲ PR</Badge>}
                {f.primera && <Badge className="label-status border border-[var(--ink)] text-[var(--ink)]">primera marca</Badge>}
                <span className="metric text-xl text-[var(--foreground)]">{f.mejor} {f.unidad}</span>
              </div>
            </div>
          ))
        )}
        <p className="label-caps text-[var(--muted)]">guardado en este navegador</p>
      </div>
    </Card>
  );
}

export default function Runner() {
  const { id } = useParams();
  const res = getModel(id || '');
  const model = res?.model;
  const program = res?.program;

  const steps: WorkoutStep[] = model ? buildSteps(model) : [];

  const [i, setI] = useState(0);
  const [vals, setVals] = useState<Record<string, SerieValor[]>>({});
  const [allSets, setAllSets] = useState<SessionSet[]>([]);
  const [marcas, setMarcas] = useState<Record<string, Marca>>({});
  const [historial, setHistorial] = useState<Record<string, number[]>>({});
  const [fin, setFin] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [descansoHasta, setDescansoHasta] = useState<number | null>(null);
  const [descansoSegundos, setDescansoSegundos] = useState(0);
  const [descansoEtiqueta, setDescansoEtiqueta] = useState('Descanso');
  const [descansoDestino, setDescansoDestino] = useState<Destino>(null);
  const [modalOmitir, setModalOmitir] = useState<{ pendientes: number } | null>(null);
  const [segRestantes, setSegRestantes] = useState(0);
  const [borradorCargado, setBorradorCargado] = useState(false);
  const inicioRef = useRef(0);
  const setsRef = useRef<SessionSet[]>([]);
  const finalizarRef = useRef<() => void>(() => {});
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inicioRef.current = Date.now();
  }, []);

  // Historial de marcas por ejercicio (detección de PR y primera marca).
  useEffect(() => {
    (async () => {
      const sessions = await db.sessions.toArray();
      const map: Record<string, number[]> = {};
      for (const s of sessions) {
        if (!s.completed) continue;
        for (const l of s.sets || []) {
          const v = num(l.value);
          if (isNaN(v)) continue;
          (map[l.exercise] ||= []).push(v);
        }
      }
      setHistorial(map);
    })();
  }, []);

  // Cargar borrador
  useEffect(() => {
    (async () => {
      if (!model) return;
      const r = await db.settings.get(`borrador:${model.id}`);
      if (r?.value) {
        const d = r.value;
        if (d.i != null) setI(d.i);
        if (d.vals) setVals(d.vals);
        if (d.descansoHasta && d.descansoHasta > Date.now()) {
          setDescansoHasta(d.descansoHasta);
          setDescansoSegundos(d.descansoSegundos ?? 0);
          setDescansoEtiqueta(d.descansoEtiqueta ?? 'Descanso');
          setDescansoDestino(d.descansoDestino ?? null);
        }
      }
      setBorradorCargado(true);
    })();
  }, [model?.id]);

  // Guardar borrador
  useEffect(() => {
    if (!borradorCargado || !model) return;
    db.settings.put({
      key: `borrador:${model.id}`,
      value: { i, vals, descansoHasta, descansoSegundos, descansoEtiqueta, descansoDestino },
    }).catch(() => {});
  }, [i, vals, descansoHasta, descansoSegundos, descansoEtiqueta, descansoDestino, borradorCargado, model?.id]);

  const finalizar = async () => {
    setFin(true);
    setI(0);
    setVals({});
    setDescansoHasta(null);
    try {
      await db.sessions.add({
        date: new Date().toISOString().slice(0, 10),
        planId: program!.id,
        modelId: model!.id,
        durationSec: elapsedSeconds(inicioRef.current, Date.now()),
        completed: true,
        sets: setsRef.current as any,
      });
      await db.settings.delete(`borrador:${model!.id}`);
      // a resumed session records only its own elapsed time
      inicioRef.current = Date.now();
    } catch {
      setErrorMsg('No se pudo guardar la sesión en este dispositivo.');
    }
  };

  useEffect(() => {
    finalizarRef.current = () => { void finalizar(); };
  });

  // El modal de series omitidas toma el foco al abrirse.
  useEffect(() => {
    if (!modalOmitir) return;
    modalRef.current?.focus();
  }, [modalOmitir]);

  // Cuenta regresiva del descanso.
  useEffect(() => {
    if (descansoHasta == null) return;
    let played = false;
    const playFin = () => {
      if (played) return;
      played = true;
      try {
        const a = new Audio('/sounds/item-found.mp3');
        a.volume = 1;
        a.play().catch(() => {});
      } catch { /* ignore */ }
      (navigator as any).vibrate?.([180, 90, 180]);
    };
    const tick = () => {
      const r = Math.max(0, Math.round((descansoHasta - Date.now()) / 1000));
      setSegRestantes(r);
      if (r <= 0) {
        playFin();
        const destino = descansoDestino;
        setDescansoHasta(null);
        setDescansoDestino(null);
        if (destino) {
          if ('fin' in destino) finalizarRef.current();
          else setI(destino.indice);
        }
      }
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [descansoHasta, descansoDestino]);

  const tocarBeep = () => {
    try {
      const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) return;
      const c = new Ctx();
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.connect(gain); gain.connect(c.destination);
      osc.frequency.value = 880; gain.gain.value = 0.15;
      osc.start(); osc.stop(c.currentTime + 0.12);
    } catch { /* ignore */ }
  };

  /** Arranca el descanso configurado: la duración no se edita, solo se puede sumar, restar u omitir. */
  const iniciarDescanso = (segundos: number, etiqueta: string, destino: Destino) => {
    if (segundos <= 0) return;
    desbloquearAudio();
    setDescansoSegundos(segundos);
    setDescansoEtiqueta(etiqueta);
    setDescansoDestino(destino);
    setDescansoHasta(Date.now() + segundos * 1000);
  };

  /** Cambia de ejercicio. */
  const irA = (indice: number) => {
    tocarBeep();
    setI(indice);
  };

  /** Omite el descanso: si había destino, se cumple igual (agregar, quitar u omitir). */
  const omitirDescanso = () => {
    const destino = descansoDestino;
    setDescansoHasta(null);
    setDescansoDestino(null);
    if (!destino) return;
    if ('fin' in destino) void finalizar();
    else irA(destino.indice);
  };

  if (!res || !model || !program) return <p>Rutina no encontrada.</p>;

  const n = steps.length;
  if (n === 0) return <Card><div className="p-4"><p className="label-caps">no se pudieron extraer los ejercicios de este entrenamiento</p></div></Card>;

  if (descansoHasta != null && !fin) return (
    <div role="dialog" aria-modal="true" aria-label="Descanso en curso" className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-8 bg-[var(--ink)] text-[var(--voltage-lime)]">
      <span className="label-caps opacity-70">{descansoEtiqueta}</span>
      <div className="relative flex h-64 w-64 items-center justify-center">
        <div className="absolute inset-0 animate-spin rounded-full! border-4 border-transparent border-t-[var(--voltage-lime)] border-r-[var(--voltage-lime)]/50" />
        <span className="metric tabular text-8xl">{String(segRestantes).padStart(2, '0')}</span>
      </div>
      <p className="label-caps opacity-70">descanso configurado: {descansoSegundos}s</p>
      <div className="flex items-center gap-4">
        <button type="button" className="border border-[var(--voltage-lime)] px-4 py-2 text-xs uppercase tracking-widest hover:bg-[var(--voltage-lime)] hover:text-[var(--ink)]" onClick={() => setDescansoHasta((h) => (h ? h - 10000 : null))}>-10s</button>
        <p className="label-caps opacity-70">descansando</p>
        <button type="button" className="border border-[var(--voltage-lime)] px-4 py-2 text-xs uppercase tracking-widest hover:bg-[var(--voltage-lime)] hover:text-[var(--ink)]" onClick={() => setDescansoHasta((h) => (h ? h + 10000 : null))}>+10s</button>
      </div>
      <button type="button" className="label-caps border border-[var(--voltage-lime)] px-6 py-3 hover:bg-[var(--voltage-lime)] hover:text-[var(--ink)]" onClick={omitirDescanso}>saltar descanso</button>
    </div>
  );

  if (fin) return (
    <>
      {errorMsg ? (
        <p role="alert" className="label-caps mb-4 border border-[var(--ink)] bg-[var(--voltage-lime)] px-4 py-3 text-[var(--ink)]">
          {errorMsg}
        </p>
      ) : null}
      <Fin ses={{ id: model.id, name: model.name }} estado={{ sets: allSets }} onVolver={() => setFin(false)} />
    </>
  );

  const idx = Math.min(i, Math.max(0, n - 1));
  const actual = steps[idx];

  const clave = (s: WorkoutStep) => `${s.blockIdx}#${s.exIdx}`;

  const step = actual;
  const stepKey = clave(step);
  const totalSeries = seriesCount(step.block);
  const lista = vals[stepKey] ?? Array.from({ length: totalSeries }, () => ({ value: '' }));

  const yaRegistrada = (iSerie: number) => setsRef.current.some((l) =>
    l.exercise === step.exercise.name && l.setIndex === iSerie + 1 && l.bloqueOrden === step.blockIdx);

  const valorRegistrado = (iSerie: number) => buscarSerie(setsRef.current, step.exercise.name, step.blockIdx, iSerie + 1)?.value;

  const sinRegistrar = lista.filter((_, k) => !buscarSerie(allSets, step.exercise.name, step.blockIdx, k + 1)).length;

  /** Registra una serie y marca PR / primera marca contra el historial. */
  const registrar = (setIndex: number, value: string) => {
    const v = num(value);
    if (!value || isNaN(v)) return;
    const unit: 'sec' | 'reps' = step.exercise.timeSec && !step.exercise.reps ? 'sec' : 'reps';
    const nuevo: SessionSet = {
      exercise: step.exercise.name,
      setIndex,
      value,
      unit,
      bloqueOrden: step.blockIdx,
      orden: step.exIdx,
    };
    const siguiente = [...setsRef.current.filter((l) => !(l.exercise === step.exercise.name && l.setIndex === setIndex && l.bloqueOrden === step.blockIdx)), nuevo];
    setsRef.current = siguiente;
    setAllSets(siguiente);
    const previos = (historial[step.exercise.name] ?? []).filter((n) => !isNaN(n));
    const marca: Marca | null = previos.length === 0 ? 'primera' : v > Math.max(...previos) ? 'pr' : null;
    if (marca) {
      const key = `${step.blockIdx}#${step.exIdx}#${setIndex}`;
      setMarcas((prev) => ({ ...prev, [key]: marca }));
    }
  };

  /** Confirma los valores tipeados que todavía no están registrados. */
  const confirmarTipeados = () => {
    lista.forEach((v, k) => {
      if (!v.value) return;
      if (yaRegistrada(k) && valorRegistrado(k) === v.value) return;
      registrar(k + 1, v.value);
    });
  };

  /** Confirma lo tipeado y pasa al siguiente ejercicio aplicando el descanso final. */
  const avanzar = () => {
    confirmarTipeados();
    const esUltimo = idx >= n - 1;
    if (step.restAfterExerciseSec > 0) {
      iniciarDescanso(step.restAfterExerciseSec, 'Descanso al finalizar el ejercicio', esUltimo ? { fin: true } : { indice: idx + 1 });
      return;
    }
    if (esUltimo) {
      void finalizar();
      return;
    }
    irA(idx + 1);
  };

  const siguiente = () => {
    const pendientes = lista.filter((_, k) => !yaRegistrada(k)).length;
    if (pendientes > 0) {
      setModalOmitir({ pendientes });
      return;
    }
    avanzar();
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="h-1 w-full bg-[var(--muted-surface)]" role="progressbar" aria-valuemin={0} aria-valuemax={n} aria-valuenow={idx + 1}>
        <div className="h-full bg-[var(--voltage-lime)]" style={{ width: `${((idx + 1) / n) * 100}%` }} />
      </div>

      <Card>
        <div className="p-4">
          <Paso
            step={step}
            series={lista.length}
            sets={allSets}
            registrar={registrar}
            valores={lista}
            setValores={(next: SerieValor[]) => setVals((v) => ({ ...v, [stepKey]: next }))}
            marcas={marcas}
            bloqueado={descansoHasta != null}
            onDescansoSerie={(segundos: number) => iniciarDescanso(segundos, 'Descanso de serie', null)}
          />
        </div>
      </Card>

      {modalOmitir && (
        <div role="dialog" aria-modal="true" aria-labelledby="modal-omitir-title" className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-4">
          <div
            ref={modalRef}
            tabIndex={-1}
            className="w-full max-w-sm space-y-4 border border-[var(--ink)] bg-[var(--surface)] p-6"
            onKeyDown={(e) => { if (e.key === 'Escape') setModalOmitir(null); }}
          >
            <p id="modal-omitir-title" className="label-caps text-[var(--foreground)]">series sin registrar</p>
            <p className="text-sm text-[var(--foreground)]">
              Quedan {modalOmitir.pendientes} {modalOmitir.pendientes === 1 ? 'serie' : 'series'} sin registrar.
              {' '}Si continuás, {modalOmitir.pendientes === 1 ? 'se omite' : 'se omiten'}.
            </p>
            <div className="flex gap-2">
              <Button variant="ghost" className="flex-1" onClick={() => setModalOmitir(null)}>Cancelar</Button>
              <Button variant="default" className="flex-1" onClick={() => { setModalOmitir(null); avanzar(); }}>Continuar</Button>
            </div>
          </div>
        </div>
      )}

      <div className="sticky bottom-0 -mx-4 sm:-mx-6 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] bg-[var(--background)] px-6 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <Button variant="outline" disabled={idx === 0 || descansoHasta != null} onClick={() => irA(idx - 1)}>Anterior</Button>
        <span className="label-caps"><span className="metric text-base text-[var(--foreground)]">{idx + 1}</span> / {n}{sinRegistrar > 0 && (<> · <span className="text-[var(--ink)]">quedan {sinRegistrar} sin registrar</span></>)}</span>
        <Button variant="default" disabled={descansoHasta != null} onClick={siguiente}>{idx >= n - 1 ? 'Finalizar entrenamiento' : 'Siguiente'}</Button>
      </div>
    </div>
  );
}
