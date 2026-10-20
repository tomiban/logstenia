import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getModel } from '../lib/plans';
import { db, type SessionSet } from '../db';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Cronometro, { desbloquearAudio } from '../components/Cronometro';

const SERIES_POR_DEFECTO = 3;

function num(v: any): number { const n = Number(v); return isNaN(n) ? NaN : n; }

function Paso({ block, exercise, sets, setSets, valores, setValores, onDescanso, descansoBase, bloqueado, descansoEntreSeries, onDescansoEntreSeries }: any) {
  const base = Math.max(1, Number(block.sets) || SERIES_POR_DEFECTO);
  const lista = useMemo(() => valores || Array.from({ length: base }, () => ({ value: '' })), [valores, base]);

  const [pr, setPr] = useState(false);
  const [primera, setPrimera] = useState(false);
  const [deshacer, setDeshacer] = useState<any>(null);
  const [editando, setEditando] = useState<Set<number>>(new Set());
  const [previosVals, setPreviosVals] = useState<number[]>([]);

  useEffect(() => {
    (async () => {
      const sessions = await db.sessions.toArray();
      const vals = sessions
        .filter((s) => s.completed)
        .flatMap((s) => s.sets || [])
        .filter((l: any) => l.exercise === exercise.name)
        .map((l: any) => num(l.value))
        .filter((n) => !isNaN(n));
      setPreviosVals(vals);
    })();
  }, [exercise.name]);

  const esTiempo = (!!exercise.timeSec && !exercise.reps) || (Array.isArray(exercise.tags) && exercise.tags.includes('isometricos'));

  const set = (i: number, v: string) => {
    setValores(lista.map((x: any, j: number) => (j === i ? { ...x, value: v } : x)));
  };

  const confirmarSerie = (i: number) => {
    const v = lista[i];
    if (!v || !v.value) return;
    const nuevo: SessionSet = {
      exercise: exercise.name,
      setIndex: i + 1,
      value: v.value,
      unit: esTiempo ? 'sec' : 'reps',
      bloqueOrden: block.order ?? 0,
      orden: exercise.order ?? 0,
    };
    setSets((prev: any[]) => [...(prev || []).filter((l: any) => !(l.exercise === exercise.name && l.setIndex === i + 1 && l.bloqueOrden === (block.order ?? 0))), nuevo]);
    if ((descansoEntreSeries || block.restBetweenSetsSec || 0) > 0 && onDescansoEntreSeries) {
      desbloquearAudio();
      onDescansoEntreSeries(descansoEntreSeries || block.restBetweenSetsSec || 60);
    }
  };

  const guardar = () => {
    const nuevos = lista
      .map((v: any, i: number) => (v.value !== '' && v.value != null ? {
        exercise: exercise.name, setIndex: i + 1, value: v.value,
        unit: (esTiempo ? 'sec' : 'reps') as 'sec' | 'reps',
        bloqueOrden: block.order ?? 0, orden: exercise.order ?? 0,
      } : null))
      .filter(Boolean) as SessionSet[];
    if (nuevos.length === 0) { return; }
    const antes = sets;
    const valores = nuevos.map((n) => num(n.value)).filter((n: number) => !isNaN(n));
    const previos = previosVals;
    setSets((prev: any[]) => [...(prev || []).filter((l: any) => !(l.exercise === exercise.name && l.bloqueOrden === (block.order ?? 0))), ...nuevos]);
    setDeshacer(antes);
    setPrimera(valores.length > 0 && previos.length === 0);
    setPr(valores.length > 0 && previos.length > 0 && Math.max(...valores) > Math.max(...previos));
    if ((descansoBase || block.restBetweenSetsSec || 0) > 0) { desbloquearAudio(); onDescanso(descansoBase || block.restBetweenSetsSec || 60); }
  };

  const deshacerGuardado = () => {
    setSets(deshacer || []);
    setDeshacer(null); setPr(false); setPrimera(false);
  };

  const yaRegistrada = (i: number) => (sets || []).some((l: any) => l.exercise === exercise.name && l.setIndex === i + 1 && l.bloqueOrden === (block.order ?? 0));

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <div className="flex items-center gap-2">
          <span className="label-caps">Bloque {block.order ?? 0}</span>
          <Badge variant="outline" className="label-status border-[var(--border)] text-[var(--muted)]">{block.type}</Badge>
        </div>
        <h2 className="mt-1 font-heading text-2xl font-bold leading-tight">{exercise.name}</h2>
        <p className="label-caps mt-1">
          {exercise.timeSec ? `objetivo ${exercise.timeSec}s` : esTiempo ? `objetivo ${exercise.reps || 'max'} hold` : (exercise.reps ? `objetivo ${exercise.reps} reps` : '')}
          {block.sets ? ` · ${block.sets} series` : ''}
          {block.restBetweenSetsSec ? ` · descanso ${block.restBetweenSetsSec}s` : ''}
        </p>
      </div>

      {esTiempo && (
        <Cronometro modo="crono" objetivo={exercise.timeSec} onUsar={(s: number) => {
          const libre = lista.findIndex((v: any) => !v.value);
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
        {lista.map((v: any, i: number) => {
          const anteriorRegistrada = i === 0 || (sets || []).some((l: any) => l.exercise === exercise.name && l.setIndex === i && l.bloqueOrden === (block.order ?? 0));
          const habilitada = i === 0 || anteriorRegistrada;
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
                yaRegistrada(i) ? (
                  <div className="flex items-center gap-2">
                    {editando.has(i) ? (
                      <Button variant="ghost" size="sm" className="label-caps h-8" onClick={() => setEditando((prev) => { const n = new Set(prev); n.delete(i); return n; })}>listo</Button>
                    ) : (
                      <Button variant="ghost" size="sm" className="label-caps h-8" disabled={bloqueado} onClick={() => setEditando((prev) => new Set(prev).add(i))}>editar</Button>
                    )}
                  </div>
                ) : (
                  <Button variant="ghost" size="sm" className="label-caps h-8" disabled={bloqueado} onClick={() => confirmarSerie(i)}>confirmar</Button>
                )
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

      <div className="flex flex-wrap items-center gap-3">
        {pr && <Badge className="label-status border border-[var(--ink)] bg-[var(--voltage-lime)] text-[var(--ink)]">▲ nuevo PR</Badge>}
        {primera && <Badge className="label-status border border-[var(--ink)] text-[var(--ink)]">primera marca</Badge>}

        {deshacer && (
          <Button variant="ghost" size="sm" className="label-caps h-9 text-[var(--muted)]" onClick={deshacerGuardado}>deshacer</Button>
        )}
      </div>

      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={guardar}>Guardar series</Button>
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
  const filas = useMemo(() => {
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
  }, [estado.sets, prevMap]);

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

  // Build steps: flatten blocks → exercises
  const steps = useMemo(() => {
    if (!model) return [];
    const out: { block: any; exercise: any }[] = [];
    model.blocks.forEach((b, bi) => {
      b.exercises.forEach((e, ei) => {
        out.push({ block: { ...b, order: bi }, exercise: { ...e, order: ei } });
      });
    });
    return out;
  }, [model]);

  const [i, setI] = useState(0);
  const [vals, setVals] = useState<Record<string, any[]>>({});
  const [descansoHasta, setDescansoHasta] = useState<number | null>(null);
  const [descansoBase, setDescansoBase] = useState(60);
  const [descansoEntreSeries, setDescansoEntreSeries] = useState(90);
  const [descansoMin, setDescansoMin] = useState(true);
  const [fin, setFin] = useState(false);
  const [segRestantes, setSegRestantes] = useState(0);
  const [modalPendientes, setModalPendientes] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!modalPendientes) return;
    triggerRef.current = (document.activeElement as HTMLElement) || null;
    const node = modalRef.current;
    if (!node) return;
    const focusables = () => Array.from(node.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')).filter((el) => !el.hasAttribute('disabled'));
    const first = focusables()[0];
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const els = focusables();
      if (els.length === 0) return;
      const firstEl = els[0];
      const lastEl = els[els.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === firstEl) { e.preventDefault(); lastEl.focus(); }
      } else {
        if (document.activeElement === lastEl) { e.preventDefault(); firstEl.focus(); }
      }
    };
    node.addEventListener('keydown', onKey);
    return () => {
      node.removeEventListener('keydown', onKey);
      triggerRef.current?.focus?.();
    };
  }, [modalPendientes]);
  const [pendientes, setPendientes] = useState(0);
  const [siguientePendiente, setSiguientePendiente] = useState<number | null>(null);
  const [borradorCargado, setBorradorCargado] = useState(false);
  const [allSets, setAllSets] = useState<any[]>([]);

  // Load draft
  useEffect(() => {
    (async () => {
      if (!model) return;
      const r = await db.settings.get(`borrador:${model.id}`);
      if (r?.value) {
        const d = r.value;
        if (d.i != null) setI(d.i);
        if (d.vals) setVals(d.vals);
        if (d.descansoBase) setDescansoBase(d.descansoBase);
        if (d.descansoEntreSeries) setDescansoEntreSeries(d.descansoEntreSeries);
        if (d.descansoHasta && d.descansoHasta > Date.now()) setDescansoHasta(d.descansoHasta);
      }
      setBorradorCargado(true);
    })();
  }, [model?.id]);

  // Save draft
  useEffect(() => {
    if (!borradorCargado || !model) return;
    db.settings.put({ key: `borrador:${model.id}`, value: { i, vals, descansoHasta, descansoBase, descansoEntreSeries } }).catch(() => {});
  }, [i, vals, descansoHasta, descansoBase, descansoEntreSeries, borradorCargado, model?.id]);

  // Rest countdown
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
      } catch {}
      (navigator as any).vibrate?.([180, 90, 180]);
    };
    const tick = () => {
      const r = Math.max(0, Math.round((descansoHasta - Date.now()) / 1000));
      setSegRestantes(r);
      if (r <= 0) {
        playFin();
        if (siguientePendiente != null) {
          const d = siguientePendiente;
          setSiguientePendiente(null);
          setDescansoHasta(null);
          setI(d);
        } else {
          setDescansoHasta(null);
        }
      }
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [descansoHasta, siguientePendiente]);

  if (!res || !model || !program) return <p>Rutina no encontrada.</p>;

  const n = steps.length;
  const idx = Math.min(i, Math.max(0, n - 1));
  const actual = steps[idx];

  const clave = (s: { block: any; exercise: any }) => `${s.block.order ?? 0}#${s.exercise.order ?? 0}`;

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

  const ir = (delta: number) => {
    if (descansoHasta && descansoHasta <= Date.now()) setDescansoHasta(null);
    tocarBeep();
    if (descansoBase > 0 && !descansoHasta) {
      setSiguientePendiente(delta);
      setDescansoHasta(Date.now() + descansoBase * 1000);
      setDescansoMin(false);
      return;
    }
    setI(delta);
  };

  const siguiente = () => {
    // count pending unregistered sets
    const step = actual;
    const lista = vals[clave(step)] || [];
    const hechas = new Set(allSets.filter((l: any) => l.exercise === step.exercise.name && l.bloqueOrden === (step.block.order ?? 0)).map((l: any) => l.setIndex));
    const pend = Math.max(0, lista.length - hechas.size);
    setPendientes(pend);
    if (pend > 0) { setModalPendientes(true); return; }
    if (idx >= n - 1) finalizar();
    else ir(idx + 1);
  };

  // Rework: track sets in allSets state
  // Actually, let's simplify: store sets in allSets, and vals only for typing.
  // We'll persist allSets to session on finalize.

  const finalizar = async () => {
    setFin(true);
    setI(0);
    setVals({});
    setDescansoHasta(null);
    // save session
    try {
      await db.sessions.add({
        date: new Date().toISOString().slice(0, 10),
        planId: program!.id,
        modelId: model!.id,
        durationSec: 0,
        completed: true,
        sets: allSets as any,
      });
      // clear draft
      await db.settings.delete(`borrador:${model!.id}`);
    } catch (e) { console.error(e); }
  };

  const confirmarPendientes = () => {
    const step = actual;
    const lista = vals[clave(step)] || [];
    const nuevos = lista.map((v: any, i: number) => (v.value !== '' && v.value != null ? {
      exercise: step.exercise.name, setIndex: i + 1, value: v.value,
      unit: (step.exercise.timeSec && !step.exercise.reps ? 'sec' : 'reps') as 'sec' | 'reps',
      bloqueOrden: step.block.order ?? 0, orden: step.exercise.order ?? 0,
    } : null)).filter(Boolean);
    if (nuevos.length > 0) {
      setAllSets((prev) => [...prev.filter((l: any) => !(l.exercise === step.exercise.name && l.bloqueOrden === (step.block.order ?? 0))), ...nuevos]);
    }
    setModalPendientes(false);
    if (idx >= n - 1) finalizar();
    else ir(idx + 1);
  };

  if (n === 0) return <Card><div className="p-4"><p className="label-caps">no se pudieron extraer los ejercicios de este entrenamiento</p></div></Card>;

  if (descansoHasta != null && !fin) return (
    <div role="dialog" aria-modal="true" aria-label="Descanso en curso" className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-12 bg-[var(--ink)] text-[var(--voltage-lime)]">
      <div className="relative flex h-64 w-64 items-center justify-center">
        <div className="absolute inset-0 animate-spin rounded-full! border-4 border-transparent border-t-[var(--voltage-lime)] border-r-[var(--voltage-lime)]/50" />
        <span className="metric tabular text-8xl">{String(segRestantes).padStart(2, '0')}</span>
      </div>
      <div className="flex items-center gap-4">
        <button type="button" className="border border-[var(--voltage-lime)] px-4 py-2 text-xs uppercase tracking-widest hover:bg-[var(--voltage-lime)] hover:text-[var(--ink)]" onClick={() => setDescansoHasta((h) => (h ? h - 10000 : null))}>-10s</button>
        <p className="label-caps opacity-70">descansando</p>
        <button type="button" className="border border-[var(--voltage-lime)] px-4 py-2 text-xs uppercase tracking-widest hover:bg-[var(--voltage-lime)] hover:text-[var(--ink)]" onClick={() => setDescansoHasta((h) => (h ? h + 10000 : null))}>+10s</button>
      </div>
      <button type="button" className="label-caps border border-[var(--voltage-lime)] px-6 py-3 hover:bg-[var(--voltage-lime)] hover:text-[var(--ink)]" onClick={() => { setSiguientePendiente(null); setDescansoHasta(null); }}>saltar descanso</button>
    </div>
  );

  if (fin) return <Fin ses={{ id: model.id, name: model.name }} estado={{ sets: allSets }} onVolver={() => setFin(false)} />;

  const step = actual;
  const stepKey = clave(step);
  const lista = vals[stepKey] || Array.from({ length: Math.max(1, Number(step.block.sets) || SERIES_POR_DEFECTO) }, () => ({ value: '' }));

  // pending count
  const hechas = new Set(allSets.filter((l: any) => l.exercise === step.exercise.name && l.bloqueOrden === (step.block.order ?? 0)).map((l: any) => l.setIndex));
  void lista; void hechas;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="h-1 w-full bg-[var(--muted-surface)]" role="progressbar" aria-valuemin={0} aria-valuemax={n} aria-valuenow={idx + 1}>
        <div className="h-full bg-[var(--voltage-lime)]" style={{ width: `${((idx + 1) / n) * 100}%` }} />
      </div>

      <div className="w-full space-y-2">
        {descansoMin ? (
          <div className="flex items-center justify-between gap-2 border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
            <span className="label-caps text-[var(--muted)]">descanso</span>
            <span className="metric text-[var(--foreground)]">{descansoHasta != null ? Math.max(0, Math.round((descansoHasta - Date.now()) / 1000)) : descansoBase}s</span>
            <button type="button" className="label-caps text-[var(--muted)] hover:text-[var(--ink)]" onClick={() => setDescansoMin(false)}>expandir</button>
          </div>
        ) : (
          <div className="space-y-3 border border-[var(--border)] bg-[var(--surface)] p-3">
            <div className="flex items-center justify-end">
              <button type="button" className="label-caps text-[var(--muted)] hover:text-[var(--ink)]" onClick={() => setDescansoMin(true)}>minimizar</button>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label className="label-caps text-[var(--muted)]">entre ejercicios</label>
                <span className="metric text-[var(--foreground)]">{descansoBase}s</span>
              </div>
              <input type="range" min={10} max={300} step={10} value={descansoBase} onChange={(e) => setDescansoBase(Number(e.target.value) || 0)} className="w-full" aria-label="Descanso entre ejercicios en segundos" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label className="label-caps text-[var(--muted)]">entre series</label>
                <span className="metric text-[var(--foreground)]">{descansoEntreSeries}s</span>
              </div>
              <input type="range" min={10} max={300} step={10} value={descansoEntreSeries} onChange={(e) => setDescansoEntreSeries(Number(e.target.value) || 0)} className="w-full" aria-label="Descanso entre series en segundos" />
            </div>
          </div>
        )}
      </div>

      <Card>
        <div className="p-4">
          <Paso
            block={step.block}
            exercise={step.exercise}
            sets={allSets}
            setSets={setAllSets}
            valores={lista}
            setValores={(next: any[]) => setVals((v) => ({ ...v, [stepKey]: next }))}
            onDescanso={(s: number) => setDescansoHasta(Date.now() + s * 1000)}
            descansoBase={descansoBase}
            bloqueado={descansoHasta != null}
            descansoEntreSeries={descansoEntreSeries}
            onDescansoEntreSeries={(s: number) => setDescansoHasta(Date.now() + s * 1000)}
          />
        </div>
      </Card>

      {modalPendientes && (
        <div role="dialog" aria-modal="true" aria-labelledby="modal-pendientes-title" className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-4" onKeyDown={(e)=>{ if(e.key==="Escape") setModalPendientes(false); }} tabIndex={-1}>
          <div ref={modalRef} className="w-full max-w-sm space-y-4 border border-[var(--ink)] bg-[var(--surface)] p-6">
            <p id="modal-pendientes-title" className="label-caps text-[var(--foreground)]">series sin registrar</p>
            <p className="text-sm text-[var(--foreground)]">{pendientes > 0 ? `Quedan ${pendientes} series sin registrar. ¿Pasar al siguiente ejercicio guardando las registradas?` : '¿Pasar al siguiente ejercicio?'}</p>
            <div className="flex gap-2">
              <Button variant="ghost" className="flex-1" onClick={() => setModalPendientes(false)}>Cancelar</Button>
              <Button variant="default" className="flex-1" onClick={confirmarPendientes}>Continuar</Button>
            </div>
          </div>
        </div>
      )}

      <div className="sticky bottom-0 -mx-4 sm:-mx-6 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] bg-[var(--background)] px-6 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <Button variant="outline" disabled={idx === 0 || descansoHasta != null} onClick={() => setI(idx - 1)}>Anterior</Button>
        <span className="label-caps"><span className="metric text-base text-[var(--foreground)]">{idx + 1}</span> / {n}{pendientes > 0 && (<> · <span className="text-[var(--ink)]">quedan {pendientes} sin registrar</span></>)}</span>
        <Button variant="default" disabled={descansoHasta != null} onClick={siguiente}>{idx >= n - 1 ? 'Finalizar entrenamiento' : 'Siguiente'}</Button>
      </div>
    </div>
  );
}
