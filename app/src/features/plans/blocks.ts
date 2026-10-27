import type { Block, BlockType, Exercise, PlanData } from '@/types';
import { uniqueId } from './ids';
import { getData, persistPlans } from './plans';

/** Stable id for a new block, unique among the blocks of its model. */
export function nextBlockId(type: BlockType, blocks: Block[]): string {
  const existing = new Set<string>();
  for (const block of blocks) {
    if (block.id) existing.add(block.id);
  }
  return uniqueId(`block-${type}`, existing);
}

/** The prescription a legacy row is known by, since it has no id. */
function exerciseSignature(exercise: Exercise): string {
  return [exercise.name, exercise.reps ?? '', exercise.timeSec ?? '', exercise.cadence ?? ''].join('|');
}

/**
 * Stable React key for one exercise row. The stored id when it exists; otherwise the prescription
 * plus the occurrence among identical rows. That way a legacy row keeps its key when it moves — the
 * list is drag-reorderable — and two genuinely identical rows still get different keys.
 */
export function exerciseKey(exercises: Exercise[], index: number): string {
  const exercise = exercises[index];
  if (exercise.id) return exercise.id;
  const signature = exerciseSignature(exercise);
  let occurrence = 1;
  for (let i = 0; i < index; i++) {
    const previous = exercises[i];
    if (!previous.id && exerciseSignature(previous) === signature) occurrence += 1;
  }
  return occurrence === 1 ? signature : `${signature}#${occurrence}`;
}

/** Fills `id` on every block that lacks one. Returns whether anything changed. */
export function assignBlockIds(data: PlanData): boolean {
  let changed = false;
  for (const category of data.categories) {
    for (const program of category.programs) {
      for (const model of program.models) {
        for (const block of model.blocks) {
          if (block.id) continue;
          block.id = nextBlockId(block.type, model.blocks);
          changed = true;
        }
      }
    }
  }
  return changed;
}

/** One-time migration for the loaded catalogue. Idempotent: writes only when a block lacked an id. */
export async function migrateBlocksToIds(): Promise<void> {
  if (assignBlockIds(getData())) await persistPlans();
}
