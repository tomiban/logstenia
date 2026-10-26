import { beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import type { Category } from '@/types';
import { getDB } from '@/db/open';
import { pendingOutboxEntries } from '@/repositories/sync/outbox';
import type { PendingOutboxEntry } from '@/repositories/sync/outbox';
import { plansRepository } from './plansRepository';

/**
 * Repository contract tests for the per-category `plans` store (spec S2, S3): rows are
 * the syncable unit, `load()` rebuilds the `PlanData` document and `save()` writes only
 * what changed. Uses the fake global IndexedDB, never the real one.
 */

const STORE = 'plans';
const SEEDED_AT = '2000-01-01T00:00:00.000Z';

interface StoredRow {
  id: string;
  category?: Category;
  position?: number;
  updatedAt?: string;
  deletedAt?: string | null;
  version?: number;
}

function category(id: string, name: string): Category {
  return { id, name, description: `${name} description`, programs: [] };
}

const cardio = category('cardio', 'Cardio');
const movilidad = category('movilidad', 'Movilidad');

async function putRows(rows: StoredRow[]): Promise<void> {
  const db = await getDB();
  for (const row of rows) await db.put(STORE, row);
}

async function storedRows(): Promise<StoredRow[]> {
  const db = await getDB();
  return (await db.getAll(STORE)) as StoredRow[];
}

function rowById(rows: StoredRow[], id: string): StoredRow {
  const row = rows.find((candidate) => candidate.id === id);
  if (!row) throw new Error(`missing plans row ${id}`);
  return row;
}

function liveCategoryIds(): Promise<string[]> {
  return plansRepository.load().then((data) => (data?.categories ?? []).map((c: Category) => c.id));
}

function pendingPlansEntries(): Promise<PendingOutboxEntry[]> {
  return pendingOutboxEntries(100);
}

function outboxEntry(entries: PendingOutboxEntry[], id: string): PendingOutboxEntry {
  const entry = entries.find((candidate) => candidate.id === id);
  if (!entry) throw new Error(`missing outbox entry ${id}`);
  return entry;
}

beforeEach(async () => {
  const db = await getDB();
  await db.clear(STORE);
  await db.clear('outbox');
});

describe('plansRepository.load', () => {
  it('rebuilds the plan data from the live rows ordered by position', async () => {
    await putRows([
      { id: 'movilidad', category: movilidad, position: 1, updatedAt: SEEDED_AT, deletedAt: null },
      { id: 'cardio', category: cardio, position: 0, updatedAt: SEEDED_AT, deletedAt: null },
      { id: 'video-catalog-version', version: 1 },
    ]);

    expect(await plansRepository.load()).toEqual({ categories: [cardio, movilidad] });
  });

  it('stays null while the store has no live category rows', async () => {
    await putRows([
      { id: 'video-catalog-version', version: 1 },
      { id: 'movilidad', category: movilidad, position: 0, updatedAt: SEEDED_AT, deletedAt: SEEDED_AT },
    ]);

    expect(await plansRepository.load()).toBeNull();
  });
});

describe('plansRepository.save', () => {
  it('soft-deletes the categories that are no longer in the document', async () => {
    await putRows([
      { id: 'cardio', category: cardio, position: 0, updatedAt: SEEDED_AT, deletedAt: null },
      { id: 'movilidad', category: movilidad, position: 1, updatedAt: SEEDED_AT, deletedAt: null },
    ]);

    await plansRepository.save({ categories: [cardio] });

    const rows = await storedRows();
    const removed = rowById(rows, 'movilidad');
    expect(typeof removed.deletedAt).toBe('string');
    expect(removed.updatedAt).not.toBe(SEEDED_AT);
    expect(rowById(rows, 'cardio').deletedAt).toBeNull();
    expect(await liveCategoryIds()).toEqual(['cardio']);
  });

  it('rewrites only the category rows whose content changed', async () => {
    await putRows([
      { id: 'cardio', category: cardio, position: 0, updatedAt: SEEDED_AT, deletedAt: null },
      { id: 'movilidad', category: movilidad, position: 1, updatedAt: SEEDED_AT, deletedAt: null },
    ]);
    const edited = { ...movilidad, name: 'Movilidad adaptada' };

    await plansRepository.save({ categories: [cardio, edited] });

    const rows = await storedRows();
    expect(rowById(rows, 'cardio').updatedAt).toBe(SEEDED_AT);
    expect(rowById(rows, 'movilidad').updatedAt).not.toBe(SEEDED_AT);
    expect(rowById(rows, 'movilidad').category).toEqual(edited);
    expect(await liveCategoryIds()).toEqual(['cardio', 'movilidad']);
  });

  it('stamps position from the array index and never writes a root row', async () => {
    await putRows([
      { id: 'cardio', category: cardio, position: 0, updatedAt: SEEDED_AT, deletedAt: null },
      { id: 'movilidad', category: movilidad, position: 1, updatedAt: SEEDED_AT, deletedAt: null },
    ]);

    await plansRepository.save({ categories: [movilidad, cardio] });

    const rows = await storedRows();
    expect(rowById(rows, 'movilidad').position).toBe(0);
    expect(rowById(rows, 'cardio').position).toBe(1);
    expect(rows.some((row) => row.id === 'root')).toBe(false);
    expect((await plansRepository.load())?.categories).toEqual([movilidad, cardio]);
  });

  it('keeps the video catalog version row untouched', async () => {
    await plansRepository.setVideoCatalogVersion(4);
    await plansRepository.save({ categories: [cardio] });

    expect(await plansRepository.getVideoCatalogVersion()).toBe(4);
    expect(await liveCategoryIds()).toEqual(['cardio']);
  });
});

describe('plansRepository.save outbox (spec S5)', () => {
  it('leaves exactly one pending entry for the category it edited', async () => {
    await putRows([
      { id: 'cardio', category: cardio, position: 0, updatedAt: SEEDED_AT, deletedAt: null },
      { id: 'movilidad', category: movilidad, position: 1, updatedAt: SEEDED_AT, deletedAt: null },
    ]);
    const edited = { ...cardio, name: 'Cardio adaptado' };

    await plansRepository.save({ categories: [edited, movilidad] });

    const entries = await pendingPlansEntries();
    expect(entries).toHaveLength(1);
    const entry = outboxEntry(entries, 'cardio');
    const stored = rowById(await storedRows(), 'cardio');
    expect(entry.entity).toBe('plans');
    expect(entry.deletedAt).toBeNull();
    expect(entry.updatedAt).toBe(stored.updatedAt);
    expect(entry.row).toEqual(stored);
  });

  it('enqueues nothing when the document did not change', async () => {
    await putRows([
      { id: 'cardio', category: cardio, position: 0, updatedAt: SEEDED_AT, deletedAt: null },
      { id: 'movilidad', category: movilidad, position: 1, updatedAt: SEEDED_AT, deletedAt: null },
    ]);

    await plansRepository.save({ categories: [cardio, movilidad] });

    expect(await pendingPlansEntries()).toEqual([]);
  });

  it('enqueues a tombstone for a category the document removed', async () => {
    await putRows([
      { id: 'cardio', category: cardio, position: 0, updatedAt: SEEDED_AT, deletedAt: null },
      { id: 'movilidad', category: movilidad, position: 1, updatedAt: SEEDED_AT, deletedAt: null },
    ]);

    await plansRepository.save({ categories: [cardio] });

    const entries = await pendingPlansEntries();
    expect(entries).toHaveLength(1);
    const entry = outboxEntry(entries, 'movilidad');
    const stored = rowById(await storedRows(), 'movilidad');
    expect(entry.entity).toBe('plans');
    expect(typeof entry.deletedAt).toBe('string');
    expect(entry.deletedAt).toBe(stored.deletedAt);
    expect(entry.row).toEqual(stored);
  });

  it('never enqueues the video catalog version row', async () => {
    await plansRepository.setVideoCatalogVersion(7);

    await plansRepository.save({ categories: [cardio] });

    const entries = await pendingPlansEntries();
    expect(entries.map((entry) => entry.id)).toEqual(['cardio']);
    expect(await plansRepository.getVideoCatalogVersion()).toBe(7);
  });
});

describe('plansRepository.seedIfEmpty', () => {
  it('writes the seed only when there are no live category rows', async () => {
    const seed = { categories: [cardio, movilidad] };

    await plansRepository.seedIfEmpty(seed);
    expect(await plansRepository.load()).toEqual(seed);

    await plansRepository.seedIfEmpty({ categories: [category('fuerza', 'Fuerza')] });
    expect(await liveCategoryIds()).toEqual(['cardio', 'movilidad']);
  });
});
