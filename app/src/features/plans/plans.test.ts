import { describe, it, expect } from 'vitest';
import plansJson from '@/data/plans.json';
import type { PlanData } from '@/types';
import { getCategories, getProgram, getModel, allPrograms, syncBundledVideos } from './plans';

describe('plans', () => {
  it('has categories', () => {
    const cats = getCategories();
    expect(cats.length).toBeGreaterThan(0);
    expect(cats.find(c => c.id === 'cardio')).toBeDefined();
    expect(cats.find(c => c.id === 'movilidad')).toBeDefined();
  });

  it('resolves program and model by id', () => {
    const p = getProgram('cardio-casa');
    expect(p).toBeDefined();
    const m = getModel('cardio-r1');
    expect(m?.model.name).toBe('Rutina 1');
    expect(m?.program.id).toBe('cardio-casa');
  });

  it('collects programs with goals', () => {
    const goals = allPrograms().flatMap(p => p.goals);
    expect(goals.length).toBeGreaterThan(0);
  });

  it('updates bundled exercise videos in stored plans without replacing other edits', () => {
    const stored = structuredClone(plansJson as PlanData);
    const frog = stored.categories
      .flatMap((category) => category.programs)
      .flatMap((program) => program.models)
      .flatMap((model) => model.blocks)
      .flatMap((block) => block.exercises)
      .find((exercise) => exercise.name === 'Frog Planche hold');

    if (!frog) throw new Error('Frog Planche hold is missing from the bundled plans');
    frog.notes = 'Keep this local note';
    frog.video = {
      id: 'fQiKCgPJVIk',
      title: 'Old video',
      channel: 'Old channel',
      url: 'https://www.youtube.com/watch?v=fQiKCgPJVIk',
      thumbnail: 'https://i.ytimg.com/vi/fQiKCgPJVIk/hqdefault.jpg',
    };

    syncBundledVideos(stored, plansJson as PlanData);

    expect(frog.video?.id).toBe('IbiVNd5iQOE');
    expect(frog.notes).toBe('Keep this local note');
  });
});
