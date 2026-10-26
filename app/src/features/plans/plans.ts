import type { PlanData, Category, Program, Model, Block, Exercise } from '@/types';
import plansJson from '@/data/plans.json';
import { plansRepository } from '@/data/plansRepository';
import { onPulledRows } from '@/repositories/sync/engine';
import { addTag } from '@/lib/tags';
import { nextBlockId, migrateBlocksToIds, assignBlockIds } from './blocks';

// In-memory cache (storage-agnostic: backed by plansRepository).
let data: PlanData = plansJson as PlanData;
const VIDEO_CATALOG_VERSION = 1;

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

export function syncBundledVideos(stored: PlanData, bundled: PlanData): void {
  const videosByName = new Map<string, Exercise['video']>();
  for (const category of bundled.categories) {
    for (const program of category.programs) {
      for (const model of program.models) {
        for (const block of model.blocks) {
          for (const exercise of block.exercises) {
            if (exercise.video) videosByName.set(exercise.name, exercise.video);
          }
        }
      }
    }
  }

  for (const category of stored.categories) {
    for (const program of category.programs) {
      for (const model of program.models) {
        for (const block of model.blocks) {
          for (const exercise of block.exercises) {
            const video = videosByName.get(exercise.name);
            if (video) exercise.video = video;
          }
        }
      }
    }
  }
}

// ---- init / seed ----
export async function initPlans(): Promise<void> {
  const stored = await plansRepository.load();
  if (stored) {
    data = stored;
    const videoCatalogVersion = await plansRepository.getVideoCatalogVersion();
    if (videoCatalogVersion < VIDEO_CATALOG_VERSION) {
      syncBundledVideos(data, plansJson as PlanData);
      await plansRepository.save(data);
      await plansRepository.setVideoCatalogVersion(VIDEO_CATALOG_VERSION);
    }
  } else {
    // Fresh install: the ids go in before seeding so the frozen SEED_UPDATED_AT stamp
    // survives (decision L8). A seed re-saved with `now` would win last-write-wins
    // against a real edit made on another device.
    data = structuredClone(plansJson) as PlanData;
    assignBlockIds(data);
    await plansRepository.seedIfEmpty(data);
    await plansRepository.setVideoCatalogVersion(VIDEO_CATALOG_VERSION);
  }
  rebuildIndexes();
  // Before the first render: `main.tsx` awaits this function, so every block already
  // has its stable id when the first screen draws (Layout repeats the call on mount
  // for the path where init fails and the app renders anyway).
  await migrateBlocksToIds();
  notify();
  // Seed tags declared on models (idempotent).
  for (const c of data.categories) {
    for (const p of c.programs) {
      for (const m of p.models) {
        for (const t of m.tags ?? []) {
          // A failed tag is best-effort: it must never lose the routine.
          await addTag('routine', m.id, t).catch(() => undefined);
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

/**
 * Re-reads the catalogue from storage (spec S8, finding L7). A pull writes category rows
 * straight to IndexedDB, behind this cache, so without this the screen keeps showing the
 * old catalogue until a reload.
 *
 * Resolves `false` when nothing was stored, leaving the previous catalogue in place: an
 * emptied catalogue must not blank the screen (same trade-off as deleting the last category).
 */
export async function refreshPlansFromStore(): Promise<boolean> {
  const stored = await plansRepository.load();
  if (!stored) return false;
  data = stored;
  rebuildIndexes();
  notify();
  return true;
}

let refreshError: unknown = null;

/** Last failed catalogue refresh after a pull, or `null`. Observable, unlike a swallowed rejection. */
export function getPlansRefreshError(): unknown {
  return refreshError;
}

// Pulled category rows invalidate the cache; other entities leave the catalogue alone.
onPulledRows((entities) => {
  if (!entities.includes('plans')) return;
  void refreshPlansFromStore().then(
    () => { refreshError = null; },
    (error: unknown) => { refreshError = error; },
  );
});

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

function normalizeBlockType(block: Block): void {
  if (!Array.isArray(block.exercises)) return;
  const n = block.exercises.length;
  if (n <= 1) block.type = 'single';
  else if (n === 2) block.type = 'biseries';
  else block.type = 'superseries';
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
  // Clean progression links pointing to the deleted program.
  for (const c of data.categories) {
    for (const p of c.programs) {
      if (p.easierProgramId === id) delete p.easierProgramId;
      if (p.harderProgramId === id) delete p.harderProgramId;
    }
  }
  for (const c of data.categories) {
    c.programs = c.programs.filter((p) => p.id !== id);
  }
  await persistPlans();
}

// ---- Program progression links ----
export function unlinkProgram(programId: string): void {
  const p = programIndex.get(programId);
  if (!p) return;
  const prev = p.easierProgramId;
  const next = p.harderProgramId;
  // Reconnect the gap left by removing this program from its chain.
  if (prev) {
    const prevP = programIndex.get(prev);
    if (prevP) {
      if (next) prevP.harderProgramId = next;
      else delete prevP.harderProgramId;
    }
  }
  if (next) {
    const nextP = programIndex.get(next);
    if (nextP) {
      if (prev) nextP.easierProgramId = prev;
      else delete nextP.easierProgramId;
    }
  }
  delete p.easierProgramId;
  delete p.harderProgramId;
}

export function chainsForCategory(categoryId: string, excludeId?: string): string[][] {
  const c = categoryIndex.get(categoryId);
  if (!c) return [];
  const visited = new Set<string>();
  const chains: string[][] = [];
  for (const p of c.programs) {
    if (excludeId && p.id === excludeId) { visited.add(p.id); continue; }
    if (visited.has(p.id)) continue;
    // Build chain by walking links, skipping excluded.
    let head = p.id;
    const seen = new Set<string>();
    while (true) {
      const cur = programIndex.get(head);
      if (!cur?.easierProgramId || seen.has(cur.easierProgramId)) break;
      if (excludeId && cur.easierProgramId === excludeId) break;
      seen.add(head);
      head = cur.easierProgramId;
    }
    const chain: string[] = [];
    const v2 = new Set<string>();
    let cur: string | undefined = head;
    while (cur && !v2.has(cur)) {
      if (excludeId && cur === excludeId) break;
      v2.add(cur);
      chain.push(cur);
      const nxt: string | undefined = programIndex.get(cur)?.harderProgramId;
      cur = nxt;
    }
    if (chain.length > 1) {
      chain.forEach((id) => visited.add(id));
      chains.push(chain);
    } else {
      visited.add(p.id);
    }
  }
  return chains;
}

export async function insertProgramIntoChain(
  programId: string,
  categoryId: string,
  chainIndex: number | null,
  slotIndex: number,
): Promise<void> {
  // Remove from any current chain first (reconnecting neighbors).
  unlinkProgram(programId);
  if (chainIndex === null) {
    await persistPlans();
    return;
  }
  const chains = chainsForCategory(categoryId, programId);
  const target = chains[chainIndex];
  if (!target) {
    await persistPlans();
    return;
  }
  const newChain = [...target];
  const pos = Math.max(0, Math.min(slotIndex, newChain.length));
  newChain.splice(pos, 0, programId);
  for (let i = 0; i < newChain.length; i++) {
    const cur = programIndex.get(newChain[i]);
    if (!cur) continue;
    if (i > 0) cur.easierProgramId = newChain[i - 1];
    else delete cur.easierProgramId;
    if (i < newChain.length - 1) cur.harderProgramId = newChain[i + 1];
    else delete cur.harderProgramId;
  }
  await persistPlans();
}

export async function setProgramRelation(
  programId: string,
  relation: 'none' | 'easier' | 'harder',
  otherId: string | null,
): Promise<void> {
  const p = programIndex.get(programId);
  if (!p) return;
  // Remove any existing relation for both endpoints.
  unlinkProgram(programId);
  if (otherId) unlinkProgram(otherId);
  if (relation === 'harder' && otherId) {
    // this program is harder than otherId (otherId is easier)
    p.easierProgramId = otherId;
    const other = programIndex.get(otherId);
    if (other) other.harderProgramId = programId;
  } else if (relation === 'easier' && otherId) {
    // this program is easier than otherId (otherId is harder)
    p.harderProgramId = otherId;
    const other = programIndex.get(otherId);
    if (other) other.easierProgramId = programId;
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
export async function createBlock(modelId: string, block: Block): Promise<void> {
  const entry = modelIndex.get(modelId);
  if (entry) {
    if (!block.id) block.id = nextBlockId(block.type, entry.model.blocks);
    entry.model.blocks.push(block);
  }
  await persistPlans();
}
export async function updateBlock(modelId: string, blockIndex: number, patch: Partial<Block>): Promise<void> {
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
export async function updateExercise(modelId: string, blockIndex: number, exerciseIndex: number, patch: Partial<Exercise>): Promise<void> {
  const entry = modelIndex.get(modelId);
  const block = entry?.model.blocks[blockIndex];
  if (block && block.exercises[exerciseIndex]) {
    const ex = block.exercises[exerciseIndex];
    const target = ex as Exercise & Record<string, unknown>;
    const source = patch as Partial<Exercise> & Record<string, unknown>;
    for (const k of Object.keys(source)) {
      if (source[k] === undefined) delete target[k];
      else target[k] = source[k];
    }
  }
  await persistPlans();
}
export async function deleteExercise(modelId: string, blockIndex: number, exerciseIndex: number): Promise<void> {
  const entry = modelIndex.get(modelId);
  const block = entry?.model.blocks[blockIndex];
  if (block) {
    block.exercises.splice(exerciseIndex, 1);
    normalizeBlockType(block);
  }
  await persistPlans();
}


// Move an exercise between blocks (or within the same block).
export async function moveExercise(modelId: string, fromBlockIndex: number, fromExIndex: number, toBlockIndex: number, toExIndex: number): Promise<void> {
  const entry = modelIndex.get(modelId);
  const model = entry?.model;
  if (!model) return;
  const fromBlock = model.blocks[fromBlockIndex];
  const toBlock = model.blocks[toBlockIndex];
  if (!fromBlock || !toBlock) return;
  if (fromExIndex < 0 || fromExIndex >= fromBlock.exercises.length) return;
  const [moved] = fromBlock.exercises.splice(fromExIndex, 1);
  let insertAt = toExIndex;
  if (insertAt < 0) insertAt = toBlock.exercises.length;
  if (insertAt > toBlock.exercises.length) insertAt = toBlock.exercises.length;
  toBlock.exercises.splice(insertAt, 0, moved);
  normalizeBlockType(fromBlock);
  normalizeBlockType(toBlock);
  await persistPlans();
}

// Reorder exercises within a block
export async function reorderExercises(modelId: string, blockIndex: number, fromIndex: number, toIndex: number): Promise<void> {
  const entry = modelIndex.get(modelId);
  const block = entry?.model.blocks[blockIndex];
  if (!block) return;
  if (fromIndex < 0 || toIndex < 0 || fromIndex >= block.exercises.length || toIndex >= block.exercises.length) return;
  const [moved] = block.exercises.splice(fromIndex, 1);
  block.exercises.splice(toIndex, 0, moved);
  normalizeBlockType(block);
  await persistPlans();
}

// Reorder blocks within a model
export async function reorderBlocks(modelId: string, fromIndex: number, toIndex: number): Promise<void> {
  const entry = modelIndex.get(modelId);
  const model = entry?.model;
  if (!model) return;
  if (fromIndex < 0 || toIndex < 0 || fromIndex >= model.blocks.length || toIndex >= model.blocks.length) return;
  const [moved] = model.blocks.splice(fromIndex, 1);
  model.blocks.splice(toIndex, 0, moved);
  await persistPlans();
}

// Exercise creation
export async function createExercise(modelId: string, blockIndex: number, exercise: Exercise): Promise<void> {
  const entry = modelIndex.get(modelId);
  const block = entry?.model.blocks[blockIndex];
  if (block) {
    block.exercises.push(exercise);
    normalizeBlockType(block);
  }
  await persistPlans();
}
