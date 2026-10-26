import { useEffect, useRef, useState, type RefObject } from 'react';
import { useParams } from 'react-router-dom';
import { getModel } from '@/features/plans/plans';
import type { SessionSet } from '@/repositories';
import { createSessionRepository, createSettingsRepository } from '@/repositories';
import type { ISessionRepository, ISettingsRepository } from '@/repositories';
import { elapsedSeconds } from './session';
import { buildSteps, type WorkoutStep } from './steps';
import type { Exercise, Model, Program } from '@/types';
import { seriesCount } from './rest';
import { num, buscarSerie, esUltimaVuelta, rondaCompleta } from './runnerLogic';
import { toISODate } from '@/lib/date';
import { progressionReportFor, touchedAnchors, type ProgressionReport } from '@/features/plans/progression';
import { playBeep, playSound, unlockAudio, vibrate } from '@/lib/audio';
import { useWakeLock } from '@/hooks/useWakeLock';
import { useCountdown } from '@/hooks/useCountdown';

export type Mark = 'pr' | 'first';
export type RestDestination = { index: number } | { finished: true } | null;

const SESION_NO_GUARDADA = 'No se pudo guardar la sesión en este dispositivo.';
const BORRADOR_NO_GUARDADO = 'No se pudo guardar el borrador: si recargás la página podés perder el entrenamiento en curso.';
const SIN_SONIDO = 'El sonido del descanso no está disponible en este navegador.';
const DATOS_NO_LEIDOS = 'No se pudieron leer los datos guardados de este dispositivo.';

/** The pre-rename storage key: read once so a workout in progress survives the upgrade. */
const LEGACY_DRAFT_PREFIX = 'borrador:';

function draftKey(modelId: string): string {
  return `draft:${modelId}`;
}

/** Stable identity for React keys and draft rows, with a fallback for non-secure contexts. */
function newId(): string {
  const uuid = globalThis.crypto?.randomUUID;
  return typeof uuid === 'function' ? uuid.call(globalThis.crypto) : `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

/** Shape of the draft saved before the API rename; read once, then rewritten in the new shape. */
interface LegacyDraft {
  i?: number;
  vals?: Record<string, SetValue[]>;
  descansoHasta?: number | null;
  descansoSegundos?: number;
  descansoEtiqueta?: string;
  descansoDestino?: RestDestination;
}

interface Draft {
  i?: number;
  values?: Record<string, SetValue[]>;
  restUntil?: number | null;
  restSeconds?: number;
  restLabel?: string;
  restDestination?: RestDestination;
}

/** Reads a draft in either shape: the current one, or the pre-rename one still on disk. */
export function draftFrom(value: Draft | LegacyDraft): { draft: Draft; migrated: boolean } {
  const current = value as Draft;
  const legacy = value as LegacyDraft;
  const migrated = legacy.vals !== undefined || legacy.descansoHasta !== undefined;
  return {
    migrated,
    draft: {
      i: current.i ?? legacy.i,
      values: current.values ?? legacy.vals,
      restUntil: current.restUntil ?? legacy.descansoHasta,
      restSeconds: current.restSeconds ?? legacy.descansoSegundos,
      restLabel: current.restLabel ?? legacy.descansoEtiqueta,
      restDestination: current.restDestination ?? legacy.descansoDestino,
    },
  };
}

export interface RunnerProgression {
  report: ProgressionReport;
  /** The next level was locked before this session and is unlocked now. */
  advanced: boolean;
  /** This session completed the level. */
  completedNow: boolean;
  /** The session registered marks that belong to the next level's criteria. */
  touchedCriteria: boolean;
}

export interface SetValue {
  /** Stable identity so React keys survive adding and removing sets. */
  id: string;
  value: string;
}

/** New empty set with its stable identity. */
export function newSetValue(value = ''): SetValue {
  return { id: newId(), value };
}

export interface RunnerState {
  // Route-derived
  res: { model: Model; program: Program } | undefined;
  model: Model | undefined;
  program: Program | undefined;
  steps: WorkoutStep[];

  // State
  i: number;
  setStepIndex: (v: number) => void;
  values: Record<string, SetValue[]>;
  setValues: (v: Record<string, SetValue[]> | ((prev: Record<string, SetValue[]>) => Record<string, SetValue[]>)) => void;
  allSets: SessionSet[];
  setAllSets: (v: SessionSet[]) => void;
  marks: Record<string, Mark>;
  setMarks: (v: Record<string, Mark> | ((prev: Record<string, Mark>) => Record<string, Mark>)) => void;
  history: Record<string, number[]>;
  setHistory: (v: Record<string, number[]>) => void;
  finished: boolean;
  setFinished: (v: boolean) => void;
  progression: RunnerProgression | null;
  errorMessage: string | null;
  setErrorMessage: (v: string | null) => void;
  restUntil: number | null;
  setRestUntil: (v: number | null | ((prev: number | null) => number | null)) => void;
  restSeconds: number;
  setRestSeconds: (v: number) => void;
  restLabel: string;
  setRestLabel: (v: string) => void;
  restDestination: RestDestination;
  setRestDestination: (v: RestDestination) => void;
  skipDialog: { pending: number } | null;
  setSkipDialog: (v: { pending: number } | null) => void;
  restRemaining: number;
  draftLoaded: boolean;

  // Refs
  startedAtRef: RefObject<number>;
  setsRef: RefObject<SessionSet[]>;
  skipDialogRef: RefObject<HTMLDivElement | null>;

  // Derived
  idx: number;
  current: WorkoutStep;
  totalSets: number;
  exerciseKey: (ei: number) => string;
  exerciseValues: (ei: number) => SetValue[];
  unregistered: number;

  // Handlers
  playBeep: () => void;
  startRest: (seconds: number, label: string, destination: RestDestination) => void;
  goTo: (indice: number) => void;
  skipRest: () => void;
  finishSession: () => Promise<void>;
  confirmSet: (blockIdx: number, ei: number, exercise: Exercise, setIndex: number, value: string) => void;
  confirmTypedValues: () => void;
  advance: () => void;
  nextStep: () => void;
}

export function useRunner(): RunnerState {
  const { id } = useParams();
  const res = getModel(id || '');
  const model = res?.model;
  const program = res?.program;

  const steps: WorkoutStep[] = model ? buildSteps(model) : [];
  const reposRef = useRef<{ sessions: ISessionRepository; settings: ISettingsRepository } | null>(null);
  reposRef.current ??= { sessions: createSessionRepository(), settings: createSettingsRepository() };
  const { sessions: sessionRepo, settings: settingsRepo } = reposRef.current;

  const [i, setStepIndex] = useState(0);
  const [values, setValues] = useState<Record<string, SetValue[]>>({});
  const [allSets, setAllSets] = useState<SessionSet[]>([]);
  const [marks, setMarks] = useState<Record<string, Mark>>({});
  const [history, setHistory] = useState<Record<string, number[]>>({});
  const [finished, setFinished] = useState(false);
  const [progression, setProgression] = useState<RunnerProgression | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [restUntil, setRestUntil] = useState<number | null>(null);
  const [restSeconds, setRestSeconds] = useState(0);
  const [restLabel, setRestLabel] = useState('Descanso');
  const [restDestination, setRestDestination] = useState<RestDestination>(null);
  const [skipDialog, setSkipDialog] = useState<{ pending: number } | null>(null);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const startedAtRef = useRef(0);
  const setsRef = useRef<SessionSet[]>([]);
  const skipDialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    startedAtRef.current = Date.now();
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
        setHistory(map);
      } catch {
        setErrorMessage(DATOS_NO_LEIDOS);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      if (!model) return;
      try {
        const current = await settingsRepo.get(draftKey(model.id));
        const legacy = current ? undefined : await settingsRepo.get(`${LEGACY_DRAFT_PREFIX}${model.id}`);
        const stored = current ?? legacy;
        if (stored?.value) {
          const { draft, migrated } = draftFrom(stored.value);
          if (draft.i != null) setStepIndex(draft.i);
          if (draft.values) {
            const restored: Record<string, SetValue[]> = {};
            for (const [key, list] of Object.entries(draft.values)) {
              restored[key] = (list as SetValue[]).map((v) => ({ ...newSetValue(v.value ?? ''), id: v.id ?? newId() }));
            }
            setValues(restored);
          }
          if (draft.restUntil && draft.restUntil > Date.now()) {
            setRestUntil(draft.restUntil);
            setRestSeconds(draft.restSeconds ?? 0);
            setRestLabel(draft.restLabel ?? 'Descanso');
            setRestDestination(draft.restDestination ?? null);
          }
          if (migrated) {
            await settingsRepo.put({ key: draftKey(model.id), value: { ...draft, values: draft.values ?? {} } });
            await settingsRepo.delete(`${LEGACY_DRAFT_PREFIX}${model.id}`);
          }
        }
      } catch {
        setErrorMessage(DATOS_NO_LEIDOS);
      } finally {
        setDraftLoaded(true);
      }
    })();
  }, [model]);

  useEffect(() => {
    if (!draftLoaded || !model) return;
    settingsRepo.put({
      key: draftKey(model.id),
      value: { i, values, restUntil, restSeconds, restLabel, restDestination },
    }).catch(() => setErrorMessage(BORRADOR_NO_GUARDADO));
  }, [i, values, restUntil, restSeconds, restLabel, restDestination, draftLoaded, model]);

  /** The level notice is cosmetic: a failed progression read must never cost the session. */
  const leerProgreso = async () => {
    try {
      return await progressionReportFor(program!.id);
    } catch {
      return null;
    }
  };

  const finishSession = async () => {
    setFinished(true);
    setStepIndex(0);
    setValues({});
    setRestUntil(null);
    const antes = await leerProgreso();
    try {
      await sessionRepo.add({
        date: toISODate(),
        planId: program!.id,
        modelId: model!.id,
        durationSec: elapsedSeconds(startedAtRef.current, Date.now()),
        completed: true,
        sets: setsRef.current,
      });
      await settingsRepo.delete(draftKey(model!.id));
      startedAtRef.current = Date.now();
    } catch {
      setErrorMessage(SESION_NO_GUARDADA);
      return;
    }
    const despues = await leerProgreso();
    if (!antes || !despues) return;
    setProgression({
      report: despues,
      advanced: despues.next?.unlocked === true && antes.next?.unlocked === false,
      completedNow: despues.completed && !antes.completed,
      touchedCriteria: touchedAnchors(despues.anchors, setsRef.current),
    });
  };

  useEffect(() => {
    if (!skipDialog) return;
    skipDialogRef.current?.focus();
  }, [skipDialog]);

  useWakeLock(true);

  /** Best-effort sound cue: a blocked or missing audio device reports once and the timer keeps running. */
  const playRestEndSound = () => {
    void playSound().then((played) => { if (!played) setErrorMessage(SIN_SONIDO); });
  };

  const handleExpire = () => {
    playRestEndSound();
    vibrate([180, 90, 180]);
    const destination = restDestination;
    setRestUntil(null);
    setRestDestination(null);
    if (destination) {
      if ('finished' in destination) void finishSession();
      else setStepIndex(destination.index);
    }
  };

  const restRemaining = useCountdown(restUntil, handleExpire);

  const startRest = (seconds: number, label: string, destination: RestDestination) => {
    if (seconds <= 0) return;
    unlockAudio();
    setRestSeconds(seconds);
    setRestLabel(label);
    setRestDestination(destination);
    setRestUntil(Date.now() + seconds * 1000);
  };

  const goTo = (indice: number) => {
    playBeep();
    setStepIndex(indice);
  };

  const skipRest = () => {
    const destination = restDestination;
    setRestUntil(null);
    setRestDestination(null);
    if (!destination) return;
    if ('finished' in destination) void finishSession();
    else goTo(destination.index);
  };

  const idx = Math.min(i, Math.max(0, steps.length - 1));
  const current = steps[idx] as WorkoutStep;
  const totalSets = current ? seriesCount(current.block) : 0;

  const exerciseKey = (ei: number) => `${current.blockIdx}#${ei}`;
  /** Empty sets for a current are cached per exercise so their keys stay stable across renders. */
  const emptyValuesRef = useRef<Record<string, SetValue[]>>({});
  const exerciseValues = (ei: number) => {
    const key = exerciseKey(ei);
    const stored = values[key];
    if (stored) return stored;
    emptyValuesRef.current[key] ??= Array.from({ length: totalSets }, () => newSetValue());
    return emptyValuesRef.current[key];
  };

  const registerSet = (blockIdx: number, ei: number, exercise: Exercise, setIndex: number, value: string) => {
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
    const nextStep = [...setsRef.current.filter((l) => !(l.exercise === exercise.name && l.setIndex === setIndex && l.bloqueOrden === blockIdx)), nuevo];
    setsRef.current = nextStep;
    setAllSets(nextStep);
    const previos = (history[exercise.name] ?? []).filter((n) => !isNaN(n));
    const mark: Mark | null = previos.length === 0 ? 'first' : v > Math.max(...previos) ? 'pr' : null;
    if (mark) {
      const key = `${blockIdx}#${ei}#${setIndex}`;
      setMarks((prev) => ({ ...prev, [key]: mark }));
    }
  };

  /**
   * Registers the set and opens the set rest only when the block round is complete
   * (every exercise registered that set) and it is not the last round.
   */
  const confirmSet = (blockIdx: number, ei: number, exercise: Exercise, setIndex: number, value: string) => {
    registerSet(blockIdx, ei, exercise, setIndex, value);
    if (!current) return;
    if (!rondaCompleta(setsRef.current, blockIdx, current.exercises, setIndex)) return;
    const rows = current.exercises.map((_, k) => exerciseValues(k).length);
    if (esUltimaVuelta(rows, setIndex)) return;
    if (current.restAfterSetSec > 0) startRest(current.restAfterSetSec, 'Descanso de serie', null);
  };

  const unregistered = current
    ? current.exercises.reduce((acc, ex, ei) => {
        const list = exerciseValues(ei);
        return acc + list.filter((_, k) => !buscarSerie(allSets, ex.name, current.blockIdx, k + 1)).length;
      }, 0)
    : 0;

  const confirmTypedValues = () => {
    if (!current) return;
    current.exercises.forEach((ex, ei) => {
      const list = exerciseValues(ei);
      list.forEach((v, k) => {
        if (!v.value) return;
        const yr = buscarSerie(setsRef.current, ex.name, current.blockIdx, k + 1);
        if (yr && yr.value === v.value) return;
        registerSet(current.blockIdx, ei, ex, k + 1, v.value);
      });
    });
  };

  const advance = () => {
    confirmTypedValues();
    if (!current) return;
    const isLast = idx >= steps.length - 1;
    if (current.restAfterExerciseSec > 0) {
      startRest(current.restAfterExerciseSec, 'Descanso al finalizar el ejercicio', isLast ? { finished: true } : { index: idx + 1 });
      return;
    }
    if (isLast) {
      void finishSession();
      return;
    }
    goTo(idx + 1);
  };

  const nextStep = () => {
    if (unregistered > 0) {
      setSkipDialog({ pending: unregistered });
      return;
    }
    advance();
  };

  return {
    res,
    model,
    program,
    steps,
    i,
    setStepIndex,
    values,
    setValues,
    allSets,
    setAllSets,
    marks,
    setMarks,
    history,
    setHistory,
    finished,
    setFinished,
    progression,
    errorMessage,
    setErrorMessage,
    restUntil,
    setRestUntil,
    restSeconds,
    setRestSeconds,
    restLabel,
    setRestLabel,
    restDestination,
    setRestDestination,
    skipDialog,
    setSkipDialog,
    restRemaining,
    draftLoaded,
    startedAtRef,
    setsRef,
    skipDialogRef,
    idx,
    current: current as WorkoutStep,
    totalSets,
    exerciseKey,
    exerciseValues,
    unregistered,
    playBeep,
    startRest,
    goTo,
    skipRest,
    finishSession,
    confirmSet,
    confirmTypedValues,
    advance,
    nextStep,
  };
}
