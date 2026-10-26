import { useEffect, useRef, useState, type RefObject } from 'react';
import { useParams } from 'react-router-dom';
import { getModel } from '@/features/plans/plans';
import type { SessionSet } from '@/repositories';
import { createSessionRepository, createSettingsRepository } from '@/repositories';
import { elapsedSeconds } from './session';
import { buildSteps, type WorkoutStep } from './steps';
import type { Exercise, Model, Program } from '@/types';
import { seriesCount } from './rest';
import { num, buscarSerie, esUltimaVuelta, rondaCompleta } from './runnerLogic';
import { toISODate } from '@/lib/date';
import { useBeep } from '@/hooks/useBeep';
import { useWakeLock } from '@/hooks/useWakeLock';
import { useVibration } from '@/hooks/useVibration';
import { useCountdown } from '@/hooks/useCountdown';
import { desbloquearAudio } from './Cronometro';

const sessionRepo = createSessionRepository();
const settingsRepo = createSettingsRepository();
const CUE_PATH = '/sounds/item-found.mp3';

export type Marca = 'pr' | 'primera';
export type Destino = { indice: number } | { fin: true } | null;

export interface SerieValor {
  value: string;
}

/** Draft persisted under `borrador:<modelId>`; fields stay optional for drafts written by older builds. */
export interface RunnerDraft {
  i?: number;
  vals?: Record<string, SerieValor[]>;
  descansoHasta?: number | null;
  descansoSegundos?: number;
  descansoEtiqueta?: string;
  descansoDestino?: Destino | null;
}

function asRunnerDraft(value: unknown): RunnerDraft | undefined {
  return typeof value === 'object' && value !== null ? (value as RunnerDraft) : undefined;
}

/** The cue is cosmetic: no audio support and a throwing constructor both just mean "no beep". */
function createCueAudio(): HTMLAudioElement | null {
  if (typeof Audio === 'undefined') return null;
  try {
    return new Audio(CUE_PATH);
  } catch {
    return null;
  }
}

export interface RunnerState {
  // Route-derived
  res: { model: Model; program: Program } | undefined;
  model: Model | undefined;
  program: Program | undefined;
  steps: WorkoutStep[];

  // State
  i: number;
  setI: (v: number) => void;
  vals: Record<string, SerieValor[]>;
  setVals: (v: Record<string, SerieValor[]> | ((prev: Record<string, SerieValor[]>) => Record<string, SerieValor[]>)) => void;
  allSets: SessionSet[];
  setAllSets: (v: SessionSet[]) => void;
  marcas: Record<string, Marca>;
  setMarcas: (v: Record<string, Marca> | ((prev: Record<string, Marca>) => Record<string, Marca>)) => void;
  historial: Record<string, number[]>;
  setHistorial: (v: Record<string, number[]>) => void;
  fin: boolean;
  setFin: (v: boolean) => void;
  errorMsg: string | null;
  setErrorMsg: (v: string | null) => void;
  descansoHasta: number | null;
  setDescansoHasta: (v: number | null | ((prev: number | null) => number | null)) => void;
  descansoSegundos: number;
  setDescansoSegundos: (v: number) => void;
  descansoEtiqueta: string;
  setDescansoEtiqueta: (v: string) => void;
  descansoDestino: Destino;
  setDescansoDestino: (v: Destino) => void;
  modalOmitir: { pendientes: number } | null;
  setModalOmitir: (v: { pendientes: number } | null) => void;
  segRestantes: number;
  borradorCargado: boolean;

  // Refs
  inicioRef: RefObject<number>;
  setsRef: RefObject<SessionSet[]>;
  finalizarRef: RefObject<() => void>;
  modalRef: RefObject<HTMLDivElement | null>;

  // Derived
  idx: number;
  actual: WorkoutStep;
  step: WorkoutStep;
  totalSeries: number;
  exKey: (ei: number) => string;
  exLista: (ei: number) => SerieValor[];
  sinRegistrar: number;

  // Handlers
  tocarBeep: () => void;
  iniciarDescanso: (segundos: number, etiqueta: string, destino: Destino) => void;
  irA: (indice: number) => void;
  omitirDescanso: () => void;
  finalizar: () => Promise<void>;
  confirmarSerie: (blockIdx: number, ei: number, exercise: Exercise, setIndex: number, value: string) => void;
  confirmarTipeados: () => void;
  avanzar: () => void;
  siguiente: () => void;
}

export function useRunner(): RunnerState {
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
  const [borradorCargado, setBorradorCargado] = useState(false);
  const inicioRef = useRef(0);
  const setsRef = useRef<SessionSet[]>([]);
  const finalizarRef = useRef<() => void>(() => {});
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inicioRef.current = Date.now();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const sessions = await sessionRepo.list();
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
      } catch {
        // A failed history read means "no history yet"; the timer never depends on it.
        return;
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      if (!model) return;
      // Failing to *load* a draft is recoverable: start with no draft. Failing to *save* one for
      // the whole session is not, so autosave gets enabled after this block either way.
      const stored = await settingsRepo.get(`borrador:${model.id}`).catch(() => undefined);
      const d = asRunnerDraft(stored?.value);
      if (d) {
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

  useEffect(() => {
    if (!borradorCargado || !model) return;
    // Best effort: a failed draft write must not break the timer.
    void settingsRepo
      .put({
        key: `borrador:${model.id}`,
        value: { i, vals, descansoHasta, descansoSegundos, descansoEtiqueta, descansoDestino } satisfies RunnerDraft,
      })
      .catch(() => undefined);
  }, [i, vals, descansoHasta, descansoSegundos, descansoEtiqueta, descansoDestino, borradorCargado, model?.id]);

  const finalizar = async () => {
    setFin(true);
    setI(0);
    setVals({});
    setDescansoHasta(null);
    try {
      await sessionRepo.add({
        date: toISODate(),
        planId: program!.id,
        modelId: model!.id,
        durationSec: elapsedSeconds(inicioRef.current, Date.now()),
        completed: true,
        sets: setsRef.current,
      });
      await settingsRepo.delete(`borrador:${model!.id}`);
      inicioRef.current = Date.now();
    } catch {
      setErrorMsg('No se pudo guardar la sesión en este dispositivo.');
    }
  };

  useEffect(() => {
    finalizarRef.current = () => { void finalizar(); };
  }, [finalizar]);

  useEffect(() => {
    if (!modalOmitir) return;
    modalRef.current?.focus();
  }, [modalOmitir]);

  const vibrate = useVibration();
  const tocarBeep = useBeep();
  useWakeLock(true);

  const handleExpire = () => {
    const audio = createCueAudio();
    if (audio) {
      audio.volume = 1;
      // Autoplay stays blocked until the user interacts, so a rejected play is expected here.
      void audio.play().catch(() => undefined);
    }
    vibrate([180, 90, 180]);
    const destino = descansoDestino;
    setDescansoHasta(null);
    setDescansoDestino(null);
    if (destino) {
      if ('fin' in destino) finalizarRef.current();
      else setI(destino.indice);
    }
  };

  const segRestantes = useCountdown(descansoHasta, handleExpire);

  const iniciarDescanso = (segundos: number, etiqueta: string, destino: Destino) => {
    if (segundos <= 0) return;
    desbloquearAudio();
    setDescansoSegundos(segundos);
    setDescansoEtiqueta(etiqueta);
    setDescansoDestino(destino);
    setDescansoHasta(Date.now() + segundos * 1000);
  };

  const irA = (indice: number) => {
    tocarBeep();
    setI(indice);
  };

  const omitirDescanso = () => {
    const destino = descansoDestino;
    setDescansoHasta(null);
    setDescansoDestino(null);
    if (!destino) return;
    if ('fin' in destino) void finalizar();
    else irA(destino.indice);
  };

  const idx = Math.min(i, Math.max(0, steps.length - 1));
  const actual = steps[idx] as WorkoutStep;
  const step = actual;
  const totalSeries = step ? seriesCount(step.block) : 0;

  const exKey = (ei: number) => `${step.blockIdx}#${ei}`;
  const exLista = (ei: number) => vals[exKey(ei)] ?? Array.from({ length: totalSeries }, () => ({ value: '' }));

  const registrarEx = (blockIdx: number, ei: number, exercise: Exercise, setIndex: number, value: string) => {
    const v = num(value);
    if (!value || isNaN(v)) return;
    const unit: 'sec' | 'reps' = exercise.timeSec && !exercise.reps ? 'sec' : 'reps';
    const nuevo: SessionSet = {
      exercise: exercise.name,
      setIndex,
      value,
      unit,
      bloqueOrden: blockIdx,
      orden: ei,
    };
    const siguiente = [...setsRef.current.filter((l) => !(l.exercise === exercise.name && l.setIndex === setIndex && l.bloqueOrden === blockIdx)), nuevo];
    setsRef.current = siguiente;
    setAllSets(siguiente);
    const previos = (historial[exercise.name] ?? []).filter((n) => !isNaN(n));
    const marca: Marca | null = previos.length === 0 ? 'primera' : v > Math.max(...previos) ? 'pr' : null;
    if (marca) {
      const key = `${blockIdx}#${ei}#${setIndex}`;
      setMarcas((prev) => ({ ...prev, [key]: marca }));
    }
  };

  /**
   * Records the set and opens the set rest only when the block round is complete
   * (every exercise has that set) and this is not the last round.
   */
  const confirmarSerie = (blockIdx: number, ei: number, exercise: Exercise, setIndex: number, value: string) => {
    registrarEx(blockIdx, ei, exercise, setIndex, value);
    if (!step) return;
    if (!rondaCompleta(setsRef.current, blockIdx, step.exercises, setIndex)) return;
    const filas = step.exercises.map((_, k) => exLista(k).length);
    if (esUltimaVuelta(filas, setIndex)) return;
    if (step.restAfterSetSec > 0) iniciarDescanso(step.restAfterSetSec, 'Descanso de serie', null);
  };

  const sinRegistrar = step
    ? step.exercises.reduce((acc, ex, ei) => {
        const lista = exLista(ei);
        return acc + lista.filter((_, k) => !buscarSerie(allSets, ex.name, step.blockIdx, k + 1)).length;
      }, 0)
    : 0;

  const confirmarTipeados = () => {
    if (!step) return;
    step.exercises.forEach((ex, ei) => {
      const lista = exLista(ei);
      lista.forEach((v, k) => {
        if (!v.value) return;
        const yr = buscarSerie(setsRef.current, ex.name, step.blockIdx, k + 1);
        if (yr && yr.value === v.value) return;
        registrarEx(step.blockIdx, ei, ex, k + 1, v.value);
      });
    });
  };

  const avanzar = () => {
    confirmarTipeados();
    if (!step) return;
    const esUltimo = idx >= steps.length - 1;
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
    if (sinRegistrar > 0) {
      setModalOmitir({ pendientes: sinRegistrar });
      return;
    }
    avanzar();
  };

  return {
    res,
    model,
    program,
    steps,
    i,
    setI,
    vals,
    setVals,
    allSets,
    setAllSets,
    marcas,
    setMarcas,
    historial,
    setHistorial,
    fin,
    setFin,
    errorMsg,
    setErrorMsg,
    descansoHasta,
    setDescansoHasta,
    descansoSegundos,
    setDescansoSegundos,
    descansoEtiqueta,
    setDescansoEtiqueta,
    descansoDestino,
    setDescansoDestino,
    modalOmitir,
    setModalOmitir,
    segRestantes,
    borradorCargado,
    inicioRef,
    setsRef,
    finalizarRef,
    modalRef,
    idx,
    actual: actual as WorkoutStep,
    step: step as WorkoutStep,
    totalSeries,
    exKey,
    exLista,
    sinRegistrar,
    tocarBeep,
    iniciarDescanso,
    irA,
    omitirDescanso,
    finalizar,
    confirmarSerie,
    confirmarTipeados,
    avanzar,
    siguiente,
  };
}
