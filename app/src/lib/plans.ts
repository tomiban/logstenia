import type { PlanData, Category, Program, Model } from '../types';
import plansJson from '../data/plans.json';
import { plansRepository } from '../data/plansRepository';
import { addTag } from './tags';

// In-memory cache (storage-agnostic: backed by plansRepository).
let data: PlanData = plansJson as PlanData;

// Reactive version counter for UI subscriptions.
let version = 0;
const listeners = new Set<() => void>();
function notify() { version += 1; listeners.forEach((l) => l()); }
export function subscribePlans(cb: () => void): () => void { listeners.add(cb); return () => listeners.delete(cb); }
export function getPlansVersion(): number { return version; }

const programIndex = new Map<string, Program>();
const modelIndex = new Map<string, { model: Model; program: Program }>();
const categoryIndex = new Map<string, Category>();

function rebuildIndexes() {
  programIndex.clear();
  modelIndex.clear();
  categoryIndex.clear();
  for (const c of data.categories) {
    categoryIndex.set(c.id, c);
    for (const p of c.programs) {
      programIndex.set(p.id, p);
      for (const m of p.models) {
        modelIndex.set(m.id, { model: m, program: p });
      }
    }
  }
}
rebuildIndexes();

// ---- init / seed ----
export async function initPlans(): Promise<void> {
  const stored = await plansRepository.load();
  if (stored) {
    data = stored;
  } else {
    data = plansJson as PlanData;
    await plansRepository.seedIfEmpty(data);
  }
  rebuildIndexes();
  notify();
  // Seed tags declared on models (idempotent).
  for (const c of data.categories) {
    for (const p of c.programs) {
      for (const m of p.models) {
        for (const t of (m as any).tags || []) {
          await addTag('routine', m.id, t).catch(() => {});
        }
      }
    }
  }
}

export async function persistPlans(): Promise<void> {
  await plansRepository.save(data);
  rebuildIndexes();
  notify();
}

// ---- read (sync, from cache) ----
export function getCategories(): Category[] { return data.categories; }
export function getCategory(id: string): Category | undefined { return categoryIndex.get(id); }
export function getProgram(id: string): Program | undefined { return programIndex.get(id); }
export function getModel(id: string): { model: Model; program: Program } | undefined { return modelIndex.get(id); }
export function allModels(): { model: Model; program: Program }[] { return [...modelIndex.values()]; }
export function allPrograms(): Program[] {
  const out: Program[] = [];
  for (const c of data.categories) for (const p of c.programs) out.push(p);
  return out;
}

// ---- CRUD (mutate cache + persist) ----
export function getData(): PlanData { return data; }

export async function saveData(next: PlanData): Promise<void> {
  data = next;
  await persistPlans();
}

// Category
export async function createCategory(cat: Category): Promise<void> {
  data.categories.push(cat);
  await persistPlans();
}
export async function updateCategory(id: string, patch: Partial<Category>): Promise<void> {
  const c = categoryIndex.get(id);
  if (c) Object.assign(c, patch);
  await persistPlans();
}
export async function deleteCategory(id: string): Promise<void> {
  data.categories = data.categories.filter((c) => c.id !== id);
  await persistPlans();
}

// Program
export async function createProgram(categoryId: string, program: Program): Promise<void> {
  const c = categoryIndex.get(categoryId);
  if (c) c.programs.push(program);
  await persistPlans();
}
export async function updateProgram(id: string, patch: Partial<Program>): Promise<void> {
  const p = programIndex.get(id);
  if (p) Object.assign(p, patch);
  await persistPlans();
}
export async function deleteProgram(id: string): Promise<void> {
  for (const c of data.categories) {
    c.programs = c.programs.filter((p) => p.id !== id);
  }
  await persistPlans();
}

// Model
export async function createModel(programId: string, model: Model): Promise<void> {
  const p = programIndex.get(programId);
  if (p) p.models.push(model);
  await persistPlans();
}
export async function updateModel(id: string, patch: Partial<Model>): Promise<void> {
  const entry = modelIndex.get(id);
  if (entry) Object.assign(entry.model, patch);
  await persistPlans();
}
export async function deleteModel(id: string): Promise<void> {
  for (const c of data.categories) {
    for (const p of c.programs) {
      p.models = p.models.filter((m) => m.id !== id);
    }
  }
  await persistPlans();
}

// Block
export async function createBlock(modelId: string, block: any): Promise<void> {
  const entry = modelIndex.get(modelId);
  if (entry) entry.model.blocks.push(block);
  await persistPlans();
}
export async function updateBlock(modelId: string, blockIndex: number, patch: any): Promise<void> {
  const entry = modelIndex.get(modelId);
  if (entry && entry.model.blocks[blockIndex]) Object.assign(entry.model.blocks[blockIndex], patch);
  await persistPlans();
}
export async function deleteBlock(modelId: string, blockIndex: number): Promise<void> {
  const entry = modelIndex.get(modelId);
  if (entry) entry.model.blocks.splice(blockIndex, 1);
  await persistPlans();
}

// Exercise (within a block)
export async function updateExercise(modelId: string, blockIndex: number, exerciseIndex: number, patch: any): Promise<void> {
  const entry = modelIndex.get(modelId);
  const block = entry?.model.blocks[blockIndex];
  if (block && block.exercises[exerciseIndex]) {
    for (const k of Object.keys(patch)) {
      const ex: any = block.exercises[exerciseIndex];
      if (patch[k] === undefined) delete ex[k];
      else ex[k] = patch[k];
    }
  }
  await persistPlans();
}
export async function deleteExercise(modelId: string, blockIndex: number, exerciseIndex: number): Promise<void> {
  const entry = modelIndex.get(modelId);
  const block = entry?.model.blocks[blockIndex];
  if (block) block.exercises.splice(exerciseIndex, 1);
  await persistPlans();
}


// Exercise creation
export async function createExercise(modelId: string, blockIndex: number, exercise: any): Promise<void> {
  const entry = modelIndex.get(modelId);
  const block = entry?.model.blocks[blockIndex];
  if (block) block.exercises.push(exercise);
  await persistPlans();
}
