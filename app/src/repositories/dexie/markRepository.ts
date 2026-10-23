import { withWrite } from '@/db';
import { DexieRepository } from './baseRepository';
import type { IMarkRepository, MarkRecord } from '../types';

export class DexieMarkRepository extends DexieRepository<MarkRecord> implements IMarkRepository {
  protected readonly entity = 'marks' as const;

  /**
   * Fill `exerciseId` on marks that lack it. Idempotent, so re-running after a
   * crash is harmless; one transaction keeps the migration all-or-nothing.
   */
  async migrateExerciseIds(resolve: (exercise: string) => string | undefined): Promise<void> {
    await withWrite(['marks'], async (tx) => {
      const store = tx.objectStore('marks');
      const rows = (await store.getAll()) as MarkRecord[];
      for (const mark of rows) {
        if (mark.exerciseId || mark.id == null) continue;
        const exerciseId = resolve(mark.exercise);
        if (!exerciseId) continue;
        await store.put({ ...mark, exerciseId });
      }
    });
  }
}
