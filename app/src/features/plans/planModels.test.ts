import { describe, expect, it } from 'vitest';
import type { Model } from '@/types';
import { splitModels } from './planModels';

/**
 * A benchmark whose exercises are all `max` (like `cardio-casa` in `plans.json`)
 * yields zero challenge anchors, so nothing else in the page can reach it.
 */
function maxBenchmark(id: string): Model {
  return {
    id,
    name: id,
    intensity: 1,
    totalTimeMin: 5,
    benchmark: true,
    blocks: [
      {
        type: 'single',
        sets: 1,
        restBetweenSetsSec: 0,
        exercises: [{ name: 'Registrar marca (max hold)', reps: 'max' }],
      },
    ],
  };
}

function routine(id: string): Model {
  return {
    id,
    name: id,
    intensity: 1,
    totalTimeMin: 20,
    blocks: [
      {
        type: 'single',
        sets: 3,
        restBetweenSetsSec: 60,
        exercises: [{ name: 'Dominadas', reps: '5' }],
      },
    ],
  };
}

describe('splitModels', () => {
  it('returns a max-only benchmark with zero anchors as a special model', () => {
    const split = splitModels([maxBenchmark('cardio-casa-benchmark')]);

    expect(split.special.map((m) => m.id)).toEqual(['cardio-casa-benchmark']);
    expect(split.routines).toEqual([]);
  });

  it('separates special models from routines and keeps the catalogue order', () => {
    const split = splitModels([
      routine('torso-a'),
      maxBenchmark('benchmark-a'),
      routine('pierna-a'),
      maxBenchmark('benchmark-b'),
    ]);

    expect(split.routines.map((m) => m.id)).toEqual(['torso-a', 'pierna-a']);
    expect(split.special.map((m) => m.id)).toEqual(['benchmark-a', 'benchmark-b']);
  });

  it('keeps a model that is not a benchmark in the routines list', () => {
    const split = splitModels([routine('torso-a')]);

    expect(split.routines.map((m) => m.id)).toEqual(['torso-a']);
    expect(split.special).toEqual([]);
  });
});
