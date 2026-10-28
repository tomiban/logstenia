import type { Block, Category, Model, Program } from '@/types';
import type { SessionRecord } from '@/db';

export interface DestinoHoy {
  prog: Program;
  model: Model;
  /** Today's session is already completed: the destination is the same one, not the next. */
  hoyCompletada: boolean;
  /** The plan was started but never trained: there is no history to continue yet. */
  nuevo: boolean;
}

/**
 * What to train today, in precedence order: the session already completed today (it can be
 * repeated), else the next routine of the most recently trained plan, else the first routine of
 * the most recently started plan. With neither history nor a started plan there is no destination
 * to invent.
 */
export function destinoDeHoy(
  cats: Category[],
  sessions: SessionRecord[],
  hoyIso: string,
  startedPlanIds: string[] = [],
): DestinoHoy | null {
  const programas = cats.flatMap((c) => c.programs);
  const completas = sessions.filter((s) => s.completed);

  if (completas.length > 0) {
    const porFecha = [...completas].sort((a, b) => (a.date < b.date ? 1 : -1));
    for (const sesion of porFecha) {
      const prog = programas.find((p) => p.id === sesion.planId);
      if (!prog || prog.models.length === 0) continue;

      const deHoy = porFecha.find((s) => s.date === hoyIso && s.planId === prog.id);
      if (deHoy) {
        return {
          prog,
          model: prog.models.find((m) => m.id === deHoy.modelId) ?? prog.models[0],
          hoyCompletada: true,
          nuevo: false,
        };
      }

      const i = prog.models.findIndex((m) => m.id === sesion.modelId);
      return { prog, model: prog.models[(i + 1) % prog.models.length], hoyCompletada: false, nuevo: false };
    }
  }

  /* A started plan with no sessions yet still answers "what do I train today": its first routine.
     With several started and no history, the most recently started one wins — that is the choice
     the athlete just made. */
  for (const planId of [...startedPlanIds].reverse()) {
    const prog = programas.find((p) => p.id === planId);
    if (!prog || prog.models.length === 0) continue;
    return { prog, model: prog.models[0], hoyCompletada: false, nuevo: true };
  }

  return null;
}

/**
 * The destination of one chosen plan: its next routine after the last one trained, or its first one
 * when the plan has no history yet. Tabs use this so switching a plan never guesses.
 */
export function destinoDePlan(prog: Program, sessions: SessionRecord[], hoyIso: string): DestinoHoy {
  const propias = sessions.filter((s) => s.completed && s.planId === prog.id);
  if (propias.length === 0) return { prog, model: prog.models[0], hoyCompletada: false, nuevo: true };

  const porFecha = [...propias].sort((a, b) => (a.date < b.date ? 1 : -1));
  const deHoy = porFecha.find((s) => s.date === hoyIso);
  if (deHoy) {
    return {
      prog,
      model: prog.models.find((m) => m.id === deHoy.modelId) ?? prog.models[0],
      hoyCompletada: true,
      nuevo: false,
    };
  }

  const i = prog.models.findIndex((m) => m.id === porFecha[0].modelId);
  return { prog, model: prog.models[(i + 1) % prog.models.length], hoyCompletada: false, nuevo: false };
}

export interface BloqueDeHoy {
  block: Block;
  nombre: string;
  formato: string;
}

const FORMATO: Record<Block['type'], string> = {
  single: 'simple',
  biseries: 'biserie',
  superseries: 'superserie',
};

export const bloquesDe = (model: Model): BloqueDeHoy[] =>
  model.blocks.map((block) => ({
    block,
    nombre: block.exercises.map((e) => e.name).join(' ＋ '),
    formato: FORMATO[block.type] ?? block.type,
  }));

const dosisDeEjercicio = (e: { reps?: string; timeSec?: number }): string => {
  if (e.timeSec) return `${e.timeSec} seg`;
  if (e.reps) return `${e.reps} reps`;
  return 'max';
};

export const dosisDeBloque = (block: Block): string =>
  [
    `${block.sets} series`,
    block.exercises.map(dosisDeEjercicio).join(' ＋ '),
    block.restBetweenSetsSec > 0 ? `descanso ${block.restBetweenSetsSec}s` : 'sin descanso fijo',
  ].join(' · ');
