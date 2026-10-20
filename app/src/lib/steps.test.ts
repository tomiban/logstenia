import { describe, it, expect } from 'vitest';
import { buildSteps } from './steps';

describe('buildSteps', () => {
  it('flattens a single block with sets and rest', () => {
    const model = {
      blocks: [
        { type: 'single', sets: 2, restBetweenSetsSec: 30, restBetweenExercisesSec: 0,
          exercises: [{ name: 'Plank', timeSec: 30 }] },
      ],
    };
    const steps = buildSteps(model);
    // 2 sets: work + rest between sets
    expect(steps).toHaveLength(3);
    expect(steps[0]).toMatchObject({ kind: 'work' });
    expect(steps[1]).toMatchObject({ kind: 'rest', seconds: 30 });
    expect(steps[2]).toMatchObject({ kind: 'work' });
  });

  it('adds rest between exercises in biseries', () => {
    const model = {
      blocks: [
        { type: 'biseries', sets: 1, restBetweenSetsSec: 0, restBetweenExercisesSec: 15,
          exercises: [{ name: 'A', timeSec: 10 }, { name: 'B', timeSec: 10 }] },
      ],
    };
    const steps = buildSteps(model);
    expect(steps).toHaveLength(3);
    expect(steps[1]).toMatchObject({ kind: 'rest', seconds: 15 });
  });

  it('returns empty for no blocks', () => {
    expect(buildSteps({ blocks: [] })).toEqual([]);
  });
});