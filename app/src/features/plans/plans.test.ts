import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import 'fake-indexeddb/auto';
import plansJson from '@/data/plans.json';
import type { Category, PlanData } from '@/types';
import type { EntityName } from '@/db';
import { getDB } from '@/db/open';
import {
  getCategories,
  getCategory,
  getProgram,
  getModel,
  getPlansVersion,
  allPrograms,
  saveData,
  subscribePlans,
  syncBundledVideos,
} from './plans';

// The catalogue refreshes on the sync engine's pulled-rows notification, so the engine is
// replaced by a recorder that lets each test deliver the entities a pull would report.
const { pulledListeners } = vi.hoisted(() => ({
  pulledListeners: [] as ((entities: readonly EntityName[]) => void)[],
}));

vi.mock('@/repositories/sync/engine', () => ({
  onPulledRows: (listener: (entities: readonly EntityName[]) => void) => {
    pulledListeners.push(listener);
    return () => {
      const index = pulledListeners.indexOf(listener);
      if (index >= 0) pulledListeners.splice(index, 1);
    };
  },
}));

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

describe('plans cache refresh on pulled rows (spec S8, finding L7)', () => {
  const PULLED_AT = '2026-01-01T00:00:00.000Z';
  const pulled: Category = {
    id: 'pulled',
    name: 'Catálogo remoto',
    description: 'Llega por sync',
    programs: [],
  };

  async function storeCategory(category: Category, position: number): Promise<void> {
    const db = await getDB();
    await db.put('plans', {
      id: category.id,
      category,
      position,
      updatedAt: PULLED_AT,
      deletedAt: null,
    });
  }

  /** Delivers the notification the engine emits after writing pulled rows. */
  function notifyPulled(entities: readonly EntityName[]): void {
    for (const listener of pulledListeners) listener(entities);
  }

  /** Fake IndexedDB settles on macrotasks, so a refresh needs a turn to complete. */
  function settle(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 20));
  }

  beforeEach(async () => {
    const db = await getDB();
    await db.clear('plans');
  });

  afterEach(async () => {
    // Restores the in-memory catalogue the other tests read from.
    await saveData(structuredClone(plansJson as PlanData));
  });

  it('subscribes the catalogue to the pulled-rows notification', () => {
    expect(pulledListeners).toHaveLength(1);
  });

  it('re-reads the catalogue and notifies subscribers when plans rows arrive', async () => {
    await storeCategory(pulled, 0);
    const version = getPlansVersion();
    let notified = 0;
    const unsubscribe = subscribePlans(() => {
      notified += 1;
    });

    notifyPulled(['plans']);
    await vi.waitFor(() => {
      expect(getCategories().map((category) => category.id)).toEqual(['pulled']);
    });
    unsubscribe();

    expect(notified).toBeGreaterThan(0);
    expect(getPlansVersion()).toBeGreaterThan(version);
    expect(getCategory('pulled')).toEqual(pulled);
  });

  it('leaves the catalogue alone when the pulled entities are not plans', async () => {
    await storeCategory(pulled, 0);
    const version = getPlansVersion();
    const before = getCategories().map((category) => category.id);

    notifyPulled(['sessions', 'settings']);
    await settle();

    expect(getPlansVersion()).toBe(version);
    expect(getCategories().map((category) => category.id)).toEqual(before);
    expect(getCategory('pulled')).toBeUndefined();
  });
});
