import { createMarkRepository, createSessionRepository, createSettingsRepository } from '@/repositories';
import type { MarkRecord, SessionRecord, SessionSet } from '@/repositories';
import type { Exercise, Program } from '@/types';
import { allPrograms, getCategory, getProgram } from './plans';

const settingsRepository = createSettingsRepository();
const sessionRepository = createSessionRepository();
const markRepository = createMarkRepository();

export const PROGRESSION_CHAINS: Record<string, string[]> = {
  planche: ['planche-tuck', 'planche-tuckadv', 'planche-straddle', 'planche-full'],
  'front lever': ['front-semi', 'front-full'],
  hefesto: ['hefesto-principiantes', 'backlever-hefesto'],
  fuerza: ['fuerza-principiantes', 'fuerza-intermedios', 'fuerza-avanzados'],
  handstand: ['handstand-principiante', 'handstand-intermedio', 'handstand-avanzado'],
};

/**
 * A numeric target of the level's challenge: the mark that certifies the level.
 * `ejercicio` is the exercise the mark is registered on; `alias` lists extra names the
 * same mark can be stored under.
 */
export interface Anchor {
  ejercicio: string;
  alias?: string[];
  unidad: 'sec' | 'reps';
  objetivo: number;
}

export interface AnchorStatus extends Anchor {
  /** Best mark registered for this criterion. */
  mejor: number;
  met: boolean;
}

export interface ProgressionLevel {
  id: string;
  name: string;
  unlocked: boolean;
  completed: boolean;
}

export interface ProgressionNext {
  id: string;
  name: string;
  unlocked: boolean;
}

export interface ProgressionReport {
  programId: string;
  name: string;
  /** 1-based position inside its chain; null when the program is not in a chain. */
  position: number | null;
  total: number;
  unlocked: boolean;
  completed: boolean;
  previous: { id: string; name: string } | null;
  /** Marks that certify the previous level: what unlocks this one. */
  requirements: AnchorStatus[];
  next: ProgressionNext | null;
  /** Marks that certify this level and open the next one. */
  anchors: AnchorStatus[];
  missing: AnchorStatus[];
  levels: ProgressionLevel[];
}

export interface ProgressionData {
  /** Best mark per exercise, from completed sessions and stored marks. */
  bests: Map<string, number>;
  /** Programs with every routine already run (see `completedProgramsFrom`). */
  sessionsDone: Set<string>;
}

function chainKey(programId: string): string | null {
  for (const [k, chain] of Object.entries(PROGRESSION_CHAINS)) {
    if (chain.includes(programId)) return k;
  }
  return null;
}

export function dynamicChainFor(programId: string): string[] | null {
  const p = getProgram(programId);
  if (!p) return null;
  // Walk to the easiest (head).
  let head = programId;
  const seen = new Set<string>();
  while (true) {
    const cur = getProgram(head);
    if (!cur?.easierProgramId || seen.has(cur.easierProgramId)) break;
    seen.add(head);
    head = cur.easierProgramId;
  }
  // Collect from head to hardest.
  const chain: string[] = [];
  const visited = new Set<string>();
  let cur: string | undefined = head;
  while (cur && !visited.has(cur)) {
    visited.add(cur);
    chain.push(cur);
    cur = getProgram(cur)?.harderProgramId;
  }
  return chain.length > 1 ? chain : null;
}

const LEVEL_RANK: Record<string, number> = { beginner: 0, intermediate: 1, advanced: 2 };

function sortByLevel(members: Program[]): string[] {
  return [...members]
    .sort((a, b) => {
      const ra = LEVEL_RANK[a.level] ?? 9;
      const rb = LEVEL_RANK[b.level] ?? 9;
      if (ra !== rb) return ra - rb;
      return a.name.localeCompare(b.name);
    })
    .map((q) => q.id);
}

export function tagChainFor(programId: string): string[] | null {
  const p = getProgram(programId);
  if (!p || !p.tags || p.tags.length === 0) return null;
  const cat = getCategory(p.categoryId);
  if (!cat) return null;
  const tags = [...p.tags].sort();
  for (const tag of tags) {
    const members = cat.programs.filter((q) => (q.tags || []).includes(tag));
    if (members.length < 2) continue;
    return sortByLevel(members);
  }
  return null;
}

export function chainFor(programId: string): string[] | null {
  const key = chainKey(programId);
  if (key) return PROGRESSION_CHAINS[key];
  const tagChain = tagChainFor(programId);
  if (tagChain) return tagChain;
  return dynamicChainFor(programId);
}

export interface ChainSlot {
  /** 1-based position of the program inside its chain. */
  position: number;
  total: number;
}

export interface CategoryChains {
  /** Chains the category is judged by, easiest → hardest, each one listed once. */
  groups: string[][];
  /** Slot of every program that belongs to one of those chains. */
  slots: Map<string, ChainSlot>;
}

/**
 * The chains `chainFor` judges this category by, so the order a screen shows is the same one
 * that decides what is blocked: the slot of a program matches `reportFrom`'s position. A chain
 * appears once, never one group per member.
 */
export function progressionChainsForCategory(categoryId: string): CategoryChains {
  const groups: string[][] = [];
  const slots = new Map<string, ChainSlot>();
  const category = getCategory(categoryId);
  if (!category) return { groups, slots };
  const seen = new Set<string>();
  for (const program of category.programs) {
    const chain = chainFor(program.id);
    if (!chain || chain.length < 2) continue;
    const key = chain.join('>');
    if (seen.has(key)) continue;
    seen.add(key);
    groups.push(chain);
    chain.forEach((id, index) => slots.set(id, { position: index + 1, total: chain.length }));
  }
  return { groups, slots };
}

export function isBenchmark(modelId: string, modelName?: string): boolean {
  return modelId.endsWith('-benchmark') || modelId.endsWith('pro1') || (modelName || '').toUpperCase() === 'PRO1';
}

/** Prescribed target of an exercise: the hold time, or the ceiling of a rep range. */
function prescribedTarget(exercise: Exercise): { unidad: 'sec' | 'reps'; objetivo: number } | null {
  if (typeof exercise.timeSec === 'number' && exercise.timeSec > 0) {
    return { unidad: 'sec', objetivo: exercise.timeSec };
  }
  const range = /^(\d+)(?:\s*-\s*(\d+))?$/.exec((exercise.reps ?? '').trim());
  if (!range) return null;
  return { unidad: 'reps', objetivo: Math.max(Number(range[1]), Number(range[2] ?? range[1])) };
}

/**
 * Marks that certify a level: the numeric targets of its challenge models. A target
 * repeated under the same name collapses to the highest one; exercises without a
 * numeric target (`max`, `RIR1`, empty) do not certify anything.
 */
function challengeCriteria(programId: string): Anchor[] {
  const program = getProgram(programId);
  if (!program) return [];
  const byName = new Map<string, Anchor>();
  for (const model of program.models) {
    if (model.benchmark !== true && !isBenchmark(model.id, model.name)) continue;
    for (const block of model.blocks) {
      for (const exercise of block.exercises) {
        const target = prescribedTarget(exercise);
        if (!target) continue;
        const key = normalizeMarkName(exercise.name);
        const current = byName.get(key);
        if (current && current.objetivo >= target.objetivo) continue;
        byName.set(key, { ejercicio: exercise.name, ...target });
      }
    }
  }
  return [...byName.values()];
}

export function normalizeMarkName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

function normalizeAnchor(anchor: Anchor): string[] {
  return [anchor.ejercicio, ...(anchor.alias ?? [])].map(normalizeMarkName);
}

/**
 * Marks live in the sessions the runner writes: a registered set is a mark. Stored
 * `marks` rows (imported backups, legacy data) still count.
 */
export function bestMarksFrom(sessions: SessionRecord[], marks: MarkRecord[]): Map<string, number> {
  const best = new Map<string, number>();
  const keep = (exercise: string, value: unknown) => {
    const v = Number(value);
    if (!Number.isFinite(v) || v <= 0) return;
    const key = normalizeMarkName(exercise);
    if (v > (best.get(key) ?? 0)) best.set(key, v);
  };
  for (const session of sessions) {
    if (!session.completed) continue;
    for (const set of session.sets ?? []) keep(set.exercise, set.value);
  }
  for (const mark of marks) keep(mark.exercise, mark.value);
  return best;
}

export function bestFor(bests: Map<string, number>, anchor: Anchor): number {
  return normalizeAnchor(anchor).reduce((acc, name) => Math.max(acc, bests.get(name) ?? 0), 0);
}

export function anchorStatus(anchors: Anchor[], bests: Map<string, number>): AnchorStatus[] {
  return anchors.map((anchor) => {
    const mejor = bestFor(bests, anchor);
    return { ...anchor, mejor, met: mejor >= anchor.objetivo };
  });
}

/** Marks registered in `sets` that belong to one of the given criteria. */
export function touchedAnchors(anchors: Anchor[], sets: SessionSet[]): boolean {
  const names = new Set(anchors.flatMap(normalizeAnchor));
  return sets.some((set) => names.has(normalizeMarkName(set.exercise)) && Number(set.value) > 0);
}

/** Programs with every routine already run (started programs when they have no routines). */
export function completedProgramsFrom(
  sessions: SessionRecord[],
  startedPlans: string[] = [],
  programs: Program[] = allPrograms(),
): Set<string> {
  const out = new Set<string>();
  for (const program of programs) {
    if (!program.models || program.models.length === 0) {
      if (startedPlans.includes(program.id)) out.add(program.id);
      continue;
    }
    const ran = new Set(
      sessions.filter((s) => s.completed && s.planId === program.id).map((s) => s.modelId),
    );
    if (program.models.every((m) => ran.has(m.id))) out.add(program.id);
  }
  return out;
}

/** Marks that certify `programId`: the objectives of its own challenge. */
export function anchorsFor(programId: string): Anchor[] {
  return challengeCriteria(programId);
}

function nextOf(chain: string[], idx: number): string | null {
  return idx >= 0 && idx < chain.length - 1 ? chain[idx + 1] : null;
}

/** A level is completed when it ran every routine or every mark of its challenge is met. */
function levelCompleted(programId: string, data: ProgressionData): boolean {
  if (data.sessionsDone.has(programId)) return true;
  const criteria = challengeCriteria(programId);
  return criteria.length > 0 && criteria.every((a) => bestFor(data.bests, a) >= a.objetivo);
}

function levelUnlocked(chain: string[], idx: number, data: ProgressionData): boolean {
  if (idx <= 0) return true;
  return levelCompleted(chain[idx - 1], data);
}

export function reportFrom(programId: string, data: ProgressionData): ProgressionReport {
  const name = getProgram(programId)?.name ?? programId;
  const chain = chainFor(programId);
  const idx = chain ? chain.indexOf(programId) : -1;
  const levels: ProgressionLevel[] = chain
    ? chain.map((id, i) => ({
        id,
        name: getProgram(id)?.name ?? id,
        unlocked: levelUnlocked(chain, i, data),
        completed: levelCompleted(chain[i], data),
      }))
    : [{ id: programId, name, unlocked: true, completed: levelCompleted(programId, data) }];
  const nextId = chain ? nextOf(chain, idx) : null;
  const anchors = anchorStatus(challengeCriteria(programId), data.bests);
  const previousId = chain && idx > 0 ? chain[idx - 1] : null;
  const requirements = previousId ? anchorStatus(challengeCriteria(previousId), data.bests) : [];
  const current = levels[idx] ?? levels[0];
  return {
    programId,
    name,
    position: chain && idx >= 0 ? idx + 1 : null,
    total: chain ? chain.length : 1,
    unlocked: current.unlocked,
    completed: current.completed,
    previous: previousId ? { id: previousId, name: getProgram(previousId)?.name ?? previousId } : null,
    requirements,
    next: nextId
      ? { id: nextId, name: getProgram(nextId)?.name ?? nextId, unlocked: levels[idx + 1].unlocked }
      : null,
    anchors,
    missing: anchors.filter((a) => !a.met),
    levels,
  };
}

export async function loadProgression(): Promise<ProgressionData> {
  const [sessions, marks, started] = await Promise.all([
    sessionRepository.list(),
    markRepository.list(),
    settingsRepository.get('startedPlans'),
  ]);
  return {
    bests: bestMarksFrom(sessions, marks),
    sessionsDone: completedProgramsFrom(sessions, (started?.value as string[]) || []),
  };
}

export async function progressionReportFor(programId: string): Promise<ProgressionReport> {
  return reportFrom(programId, await loadProgression());
}

function describeAnchor(anchor: AnchorStatus): string {
  const unidad = anchor.unidad === 'sec' ? 'seg' : 'reps';
  return `${anchor.ejercicio} ≥ ${anchor.objetivo} ${unidad}${anchor.mejor > 0 ? ` (mejor ${anchor.mejor})` : ''}`;
}

export function describeLock(report: ProgressionReport): string {
  const missing = report.requirements.filter((a) => !a.met).map(describeAnchor);
  if (missing.length > 0) {
    const base = report.previous
      ? `Bloqueado: completá ${report.previous.name} o registrá `
      : 'Bloqueado: registrá ';
    return `${base}${missing.join(', ')}.`;
  }
  if (report.previous) return `Bloqueado: completá ${report.previous.name}.`;
  return 'Bloqueado.';
}

export async function isUnlocked(programId: string): Promise<boolean> {
  return (await progressionReportFor(programId)).unlocked;
}

export async function isProgramCompleted(programId: string): Promise<boolean> {
  return (await progressionReportFor(programId)).completed;
}

export async function unlockedReason(programId: string): Promise<string | null> {
  const report = await progressionReportFor(programId);
  return report.unlocked ? null : describeLock(report);
}
