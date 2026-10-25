import { describe, expect, it } from 'vitest';
import { openDB as idbOpenDB, unwrap, type IDBPDatabase } from 'idb';
// Installs the global fake `indexedDB` that idb v8 always resolves against.
import 'fake-indexeddb/auto';
import { DB_VERSION, upgradeDatabase } from './open';

/**
 * Migration fixture tests (design §12 T3): build a v1003-shaped database through the
 * legacy schema, re-open it at DB_VERSION through the exported `upgradeDatabase`, and
 * assert the observable v1004 outcome. Every test uses a unique database name against
 * the fake global IndexedDB; the real IndexedDB is never touched.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Recreates the legacy v1003 schema verbatim (autoincrement integer keys). */
function upgradeToLegacy(db: IDBPDatabase<unknown>): void {
  const s = db.createObjectStore('sessions', { keyPath: 'id', autoIncrement: true });
  s.createIndex('date', 'date');
  s.createIndex('planId', 'planId');
  s.createIndex('modelId', 'modelId');
  const p = db.createObjectStore('progress', { keyPath: 'id', autoIncrement: true });
  p.createIndex('exerciseId', 'exerciseId');
  p.createIndex('week', 'week');
  const g = db.createObjectStore('goals', { keyPath: 'id', autoIncrement: true });
  g.createIndex('goalId', 'goalId');
  db.createObjectStore('settings', { keyPath: 'key' });
  const m = db.createObjectStore('marks', { keyPath: 'id', autoIncrement: true });
  m.createIndex('exercise', 'exercise');
  m.createIndex('mesoInicio', 'mesoInicio');
  const t = db.createObjectStore('tags', { keyPath: 'id', autoIncrement: true });
  t.createIndex('targetType', 'targetType');
  t.createIndex('targetId', 'targetId');
  t.createIndex('tag', 'tag');
  t.createIndex('targetType+targetId', ['targetType', 'targetId']);
  db.createObjectStore('plans', { keyPath: 'id' });
}

async function seedLegacyDatabase(name: string): Promise<void> {
  const db = await idbOpenDB(name, 1003, {
    upgrade: (db) => upgradeToLegacy(db),
  });
  const legacySession = { date: '2026-10-20', planId: 'fuerza', modelId: 'm1', durationSec: 600, completed: true };
  await db.add('sessions', legacySession);
  await db.add('sessions', { ...legacySession, date: '2026-10-21' });
  await db.add('tags', { targetType: 'exercise', targetId: 'e1', tag: 'empuje' });
  await db.add('marks', { exercise: 'dominadas', unit: 'reps', value: 8, mesoInicio: '2026-10-01', date: '2026-10-20' });
  await db.put('settings', { key: 'theme', value: 'dark' });
  await db.put('plans', { id: 'fuerza', name: 'Fuerza' });
  db.close();
}

/** A v1004 database whose `plans` store still holds the legacy single document. */
async function seedPlansStore(name: string, rows: Record<string, unknown>[]): Promise<void> {
  const db = await idbOpenDB(name, 1004, {
    upgrade: (upgradeDb) => {
      upgradeDb.createObjectStore('plans', { keyPath: 'id' });
    },
  });
  for (const row of rows) await db.put('plans', row);
  db.close();
}

const legacyCategories = [
  { id: 'cardio', name: 'Cardio', description: 'Resistencia', programs: [] },
  { id: 'movilidad', name: 'Movilidad', description: 'Rango articular', programs: [] },
];

function openAtLatest(name: string) {
  return idbOpenDB(name, DB_VERSION, {
    upgrade(db, oldVersion, _newVersion, tx) {
      upgradeDatabase(unwrap(db), oldVersion, unwrap(tx));
    },
  });
}

describe('schema v1004 migration (fixture DB)', () => {
  it('re-keys legacy integer ids as UUID strings and adds the sync fields', async () => {
    await seedLegacyDatabase('migrate-rekey');
    const db = await openAtLatest('migrate-rekey');

    const sessions = await db.getAll('sessions');
    expect(sessions).toHaveLength(2);
    for (const session of sessions) {
      expect(typeof session.id).toBe('string');
      expect(session.id).toMatch(UUID_RE);
      expect(typeof session.updatedAt).toBe('string');
      expect(Number.isNaN(Date.parse(session.updatedAt))).toBe(false);
      expect(session.deletedAt).toBeNull();
    }
    expect(new Set(sessions.map((s) => s.date))).toEqual(new Set(['2026-10-20', '2026-10-21']));

    const tags = await db.getAll('tags');
    expect(tags).toHaveLength(1);
    expect(typeof tags[0].id).toBe('string');
    expect(tags[0].deletedAt).toBeNull();

    const settings = await db.getAll('settings');
    expect(settings).toHaveLength(1);
    expect(settings[0].key).toBe('theme');

    db.close();
  });

  it('preserves the store indexes and the settings natural key', async () => {
    await seedLegacyDatabase('migrate-indexes');
    const db = await openAtLatest('migrate-indexes');

    expect(db.objectStoreNames.contains('sessions')).toBe(true);
    expect(db.objectStoreNames.contains('tags')).toBe(true);

    const sessions = await db.getAllFromIndex('sessions', 'date');
    expect(sessions).toHaveLength(2);
    const tagByCompound = await db.getAllFromIndex('tags', 'targetType+targetId', ['exercise', 'e1']);
    expect(tagByCompound).toHaveLength(1);
    const theme = await db.get('settings', 'theme');
    expect(theme?.value).toBe('dark');

    db.close();
  });

  it('creates the outbox store with an autoincrement seq key', async () => {
    await seedLegacyDatabase('migrate-outbox');
    const db = await openAtLatest('migrate-outbox');

    expect(db.objectStoreNames.contains('outbox')).toBe(true);

    const entry = {
      entity: 'sessions',
      id: '6f1c-mock',
      updatedAt: '2026-10-20T17:02:00.000Z',
      deletedAt: null,
      row: { date: '2026-10-20' },
    };
    await db.add('outbox', entry);
    const stored = await db.getAll('outbox');
    expect(stored).toHaveLength(1);
    expect(typeof stored[0].seq).toBe('number');
    expect(stored[0].entity).toBe('sessions');

    db.close();
  });

  it('keeps a pre-existing string id and updatedAt instead of overwriting them', async () => {
    const db = await idbOpenDB('migrate-preserves', 1003, {
      upgrade: (db) => upgradeToLegacy(db),
    });
    await db.add('sessions', {
      id: 'already-uuid',
      updatedAt: '2026-10-19T10:00:00.000Z',
      date: '2026-10-19',
      planId: 'fuerza',
      modelId: 'm1',
      durationSec: 300,
      completed: true,
    });
    db.close();

    const reopened = await openAtLatest('migrate-preserves');
    const row = await reopened.get('sessions', 'already-uuid');
    expect(row?.id).toBe('already-uuid');
    expect(row?.updatedAt).toBe('2026-10-19T10:00:00.000Z');

    reopened.close();
  });

  it('creates the v1004 shape on a fresh install (no legacy rows to migrate)', async () => {
    const db = await openAtLatest('migrate-fresh');

    expect(db.objectStoreNames.contains('outbox')).toBe(true);
    expect(db.objectStoreNames.contains('settings')).toBe(true);
    expect(db.objectStoreNames.contains('plans')).toBe(true);

    await db.put('settings', { key: 'theme', value: 'dark' });
    expect((await db.get('settings', 'theme'))?.value).toBe('dark');

    const id = crypto.randomUUID();
    await db.add('sessions', { id, date: '2026-10-20', planId: 'fuerza', modelId: 'm1', durationSec: 1, completed: false });
    const sessions = await db.getAll('sessions');
    expect(sessions).toHaveLength(1);
    expect(sessions[0].id).toBe(id);

    db.close();
  });
});

interface PlansMigrationRow {
  id: string;
  category?: typeof legacyCategories[number];
  position?: number;
  updatedAt?: string;
  deletedAt?: string | null;
  version?: number;
}

function categoryRowsOf(rows: PlansMigrationRow[]): PlansMigrationRow[] {
  return rows
    .filter((row) => row.category != null)
    .sort((a, b) => (a.position ?? -1) - (b.position ?? -1));
}

describe('schema v1005 plans migration (one row per category)', () => {
  it('splits the legacy root document into ordered category rows', async () => {
    await seedPlansStore('migrate-plans-root', [
      { id: 'root', data: { categories: legacyCategories } },
      { id: 'video-catalog-version', version: 1 },
    ]);

    const db = await openAtLatest('migrate-plans-root');
    const rows = (await db.getAll('plans')) as PlansMigrationRow[];
    const categoryRows = categoryRowsOf(rows);

    expect(categoryRows).toHaveLength(2);
    expect(categoryRows.map((row) => row.id)).toEqual(['cardio', 'movilidad']);
    expect(categoryRows.map((row) => row.position)).toEqual([0, 1]);
    expect(categoryRows.map((row) => row.category)).toEqual(legacyCategories);
    for (const row of categoryRows) {
      expect(typeof row.updatedAt).toBe('string');
      expect(Number.isNaN(Date.parse(row.updatedAt ?? ''))).toBe(false);
      expect(row.deletedAt).toBeNull();
    }

    expect(await db.get('plans', 'root')).toBeUndefined();
    expect(rows.some((row) => row.id === 'root')).toBe(false);
    expect((await db.get('plans', 'video-catalog-version'))?.version).toBe(1);

    db.close();
  });

  it('does not re-migrate a database that already holds category rows', async () => {
    const migratedAt = '2000-01-01T00:00:00.000Z';
    await seedPlansStore('migrate-plans-idempotent', [
      { id: 'root', data: { categories: [{ id: 'cardio', name: 'Old copy', description: '', programs: [] }] } },
      { id: 'cardio', category: legacyCategories[0], position: 0, updatedAt: migratedAt, deletedAt: null },
      { id: 'movilidad', category: legacyCategories[1], position: 1, updatedAt: migratedAt, deletedAt: null },
      { id: 'video-catalog-version', version: 3 },
    ]);

    const db = await openAtLatest('migrate-plans-idempotent');
    const rows = (await db.getAll('plans')) as PlansMigrationRow[];
    const categoryRows = categoryRowsOf(rows);

    expect(categoryRows).toHaveLength(2);
    expect(categoryRows.map((row) => row.id)).toEqual(['cardio', 'movilidad']);
    expect(categoryRows.map((row) => row.updatedAt)).toEqual([migratedAt, migratedAt]);
    expect(categoryRows.map((row) => row.category)).toEqual(legacyCategories);
    expect(await db.get('plans', 'root')).toBeUndefined();
    expect((await db.get('plans', 'video-catalog-version'))?.version).toBe(3);

    db.close();
  });
});
