import plansJson from '../data/plans.json';
import type { PlanData, Category, Program, Model } from '../types';

const data = plansJson as PlanData;

// Precomputed indexes to avoid O(n) scans / N+1 lookups.
const programIndex = new Map<string, Program>();
const modelIndex = new Map<string, { model: Model; program: Program }>();
const categoryIndex = new Map<string, Category>();
for (const c of data.categories) {
  categoryIndex.set(c.id, c);
  for (const p of c.programs) {
    programIndex.set(p.id, p);
    for (const m of p.models) {
      modelIndex.set(m.id, { model: m, program: p });
    }
  }
}

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