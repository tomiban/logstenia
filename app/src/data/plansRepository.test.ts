import { beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import type { Category } from '@/types';
import { getDB } from '@/db/open';
import { pendingOutboxEntries } from '@/repositories/sync/outbox';
import type { PendingOutboxEntry } from '@/repositories/sync/outbox';
import { resolvePullRow } from '@/repositories/sync/merge';
import { plansRepository, SEED_UPDATED_AT } from './plansRepository';

/**
 * Repository contract tests for the per-category `plans` store (spec S2, S3): rows are
 * the syncable unit, `load()` rebuilds the `PlanData` document and `save()` writes only
 * what changed. Uses the fake global IndexedDB, never the real one.
 */

const STORE = 'plans';
const SEEDED_AT = '2000-01-01T00:00:00.000Z';
const T_LOCAL = '2020-01-01T00:00:00.000Z';
const T_REMOTE = '2021-01-01T00:00:00.000Z';

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

/**
 * One category change arriving from the server, written the way the sync engine writes a
 * pulled row: the merge decision picks the row, Dexie stores it. Keeps the tests on the
 * public pull interface instead of a second copy of the LWW rules.
 */
async function pullCategory(category: Category, updatedAt: string, position: number): Promise<void> {
  const db = await getDB();
  const local = (await db.get(STORE, category.id)) as StoredRow | undefined;
  const localMeta =
    local && typeof local.updatedAt === 'string'
      ? { id: local.id, updatedAt: local.updatedAt, deletedAt: local.deletedAt ?? null }
      : null;
  const row = resolvePullRow(localMeta, {
    entity: STORE,
    id: category.id,
    rev: 1,
    updatedAt,
    deletedAt: null,
    row: { id: category.id, category, position, updatedAt, deletedAt: null },
  });
  if (row) await db.put(STORE, row);
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

  it('stamps an ordinary save with the current time, not the seed timestamp', async () => {
    await plansRepository.save({ categories: [cardio] });

    const stamp = rowById(await storedRows(), 'cardio').updatedAt;
    expect(stamp).not.toBe(SEED_UPDATED_AT);
    expect(typeof stamp).toBe('string');
    expect(Math.abs(Date.parse(stamp as string) - Date.now())).toBeLessThan(60_000);
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

  it('stamps every seeded row with the frozen timestamp and enqueues it for publish', async () => {
    await plansRepository.seedIfEmpty({ categories: [cardio, movilidad] });

    const rows = await storedRows();
    const stamps = rows
      .filter((row) => row.id === 'cardio' || row.id === 'movilidad')
      .map((row) => row.updatedAt);
    expect(stamps).toEqual([SEED_UPDATED_AT, SEED_UPDATED_AT]);

    const entries = await pendingPlansEntries();
    expect(entries.map((entry) => entry.id).sort()).toEqual(['cardio', 'movilidad']);
    expect(entries.every((entry) => entry.updatedAt === SEED_UPDATED_AT)).toBe(true);
  });

  it('does not resurrect a catalogue the user emptied on purpose', async () => {
    const seed = { categories: [cardio, movilidad] };
    await plansRepository.seedIfEmpty(seed);

    await plansRepository.save({ categories: [] });
    expect(await plansRepository.load()).toBeNull();
    expect(await plansRepository.getSeeded()).toBe(true);

    await plansRepository.seedIfEmpty(seed);
    expect(await liveCategoryIds()).toEqual([]);
  });

  it('treats a catalogue stored before the flag existed as already seeded', async () => {
    await putRows([
      { id: 'cardio', category: cardio, position: 0, updatedAt: T_LOCAL, deletedAt: null },
    ]);

    await plansRepository.seedIfEmpty({ categories: [movilidad] });

    expect(await plansRepository.getSeeded()).toBe(true);
    expect(await liveCategoryIds()).toEqual(['cardio']);
  });
});

describe('plansRepository merge per category (spec S7)', () => {
  it('keeps the categories edited independently on two devices', async () => {
    await putRows([
      { id: 'cardio', category: cardio, position: 0, updatedAt: T_LOCAL, deletedAt: null },
      { id: 'movilidad', category: movilidad, position: 1, updatedAt: T_LOCAL, deletedAt: null },
    ]);
    const localCardio = { ...cardio, name: 'Cardio en casa' };
    await plansRepository.save({ categories: [localCardio, movilidad] });

    const remoteMovilidad = { ...movilidad, name: 'Movilidad remota' };
    await pullCategory(remoteMovilidad, T_REMOTE, 1);

    const loaded = (await plansRepository.load())?.categories ?? [];
    expect(loaded.map((category_) => category_.id)).toEqual(['cardio', 'movilidad']);
    expect(loaded[0].name).toBe('Cardio en casa');
    expect(loaded[1].name).toBe('Movilidad remota');
  });

  it('replaces the whole category with the newer side instead of merging its fields', async () => {
    const localCardio = { ...cardio, name: 'Cardio local' };
    await putRows([
      { id: 'cardio', category: localCardio, position: 0, updatedAt: T_LOCAL, deletedAt: null },
    ]);

    const remoteCardio = { ...cardio, name: 'Cardio remoto', description: 'Otra descripción' };
    await pullCategory(remoteCardio, T_REMOTE, 0);

    expect((await plansRepository.load())?.categories).toEqual([remoteCardio]);
  });

  it('keeps the newer local category when the pulled copy is older', async () => {
    const localCardio = { ...cardio, name: 'Cardio local' };
    await putRows([
      { id: 'cardio', category: localCardio, position: 0, updatedAt: T_REMOTE, deletedAt: null },
    ]);

    await pullCategory({ ...cardio, name: 'Cardio viejo' }, T_LOCAL, 0);

    expect((await plansRepository.load())?.categories).toEqual([localCardio]);
  });

  it('does not let a freshly seeded category overwrite one edited on another device', async () => {
    await plansRepository.seedIfEmpty({ categories: [cardio, movilidad] });

    const editedCardio = { ...cardio, name: 'Cardio editado en otro dispositivo' };
    await pullCategory(editedCardio, T_REMOTE, 0);

    const loaded = (await plansRepository.load())?.categories ?? [];
    expect(loaded.find((category_) => category_.id === 'cardio')).toEqual(editedCardio);
  });
});
