import type { Block, BlockType, PlanData } from '@/types';
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
