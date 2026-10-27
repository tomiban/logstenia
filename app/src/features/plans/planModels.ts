import type { Model } from '@/types';

export interface ModelSplit {
  /** Routines the plan is built from. */
  routines: Model[];
  /** Benchmark models (mark-taking routines); they own the only route to `/routine/:id`. */
  special: Model[];
}

/**
 * Splits a program's models into routines and special (benchmark) models.
 * Deliberately blind to challenge anchors: a benchmark whose exercises are all
 * `max` produces no anchors and would be unreachable if anchors gated it.
 */
export function splitModels(models: readonly Model[]): ModelSplit {
  const routines: Model[] = [];
  const special: Model[] = [];

  for (const model of models) {
    if (model.benchmark) special.push(model);
    else routines.push(model);
  }

  return { routines, special };
}
