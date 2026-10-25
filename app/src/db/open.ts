import { openDB, unwrap, type IDBPDatabase } from 'idb';

export const DB_NAME = 'logstenia';
export const DB_VERSION = 1005;

type LegacyRow = Record<string, unknown>;

let dbPromise: Promise<IDBPDatabase> | null = null;

interface StoreIndex {
  name: string;
  keyPath: string | string[];
  unique?: boolean;
}

interface SyncedStoreSpec {
  name: string;
  indexes: StoreIndex[];
}

/** Index set of the five synced stores; identical in v1003 and v1004. */
const SYNCED_STORES: SyncedStoreSpec[] = [
  {
    name: 'sessions',
    indexes: [
      { name: 'date', keyPath: 'date' },
      { name: 'planId', keyPath: 'planId' },
      { name: 'modelId', keyPath: 'modelId' },
    ],
  },
  {
    name: 'progress',
    indexes: [
      { name: 'exerciseId', keyPath: 'exerciseId' },
      { name: 'week', keyPath: 'week' },
    ],
  },
  { name: 'goals', indexes: [{ name: 'goalId', keyPath: 'goalId' }] },
  {
    name: 'marks',
    indexes: [
      { name: 'exercise', keyPath: 'exercise' },
      { name: 'mesoInicio', keyPath: 'mesoInicio' },
    ],
  },
  {
    name: 'tags',
    indexes: [
      { name: 'targetType', keyPath: 'targetType' },
      { name: 'targetId', keyPath: 'targetId' },
      { name: 'tag', keyPath: 'tag' },
      { name: 'targetType+targetId', keyPath: ['targetType', 'targetId'] },
    ],
  },
];

/**
 * Create the five synced stores in their legacy v1003 shape (autoincrement integer
 * keys). Both a fresh install and an upgrade pass through here; the v1004 step below
 * then re-keys every store uniformly, so there is a single migration path to test.
 */
function createLegacySyncedStores(db: IDBDatabase): void {
  for (const spec of SYNCED_STORES) {
    if (db.objectStoreNames.contains(spec.name)) continue;
    const store = db.createObjectStore(spec.name, { keyPath: 'id', autoIncrement: true });
    for (const index of spec.indexes) {
      store.createIndex(index.name, index.keyPath, { unique: index.unique ?? false });
    }
  }
}

function putRow(store: IDBObjectStore, row: LegacyRow): void {
  const request = store.put(row);
  request.onerror = () => {
    throw request.error;
  };
}

const PLANS_STORE = 'plans';
const PLANS_ROOT_KEY = 'root';

/** Category rows carry the document payload; every other `plans` row is metadata. */
function isCategoryRow(row: LegacyRow): boolean {
  return row.category != null && typeof row.category === 'object';
}

function categoriesOf(document: unknown): LegacyRow[] {
  const categories = (document as { categories?: unknown } | null | undefined)?.categories;
  if (!Array.isArray(categories)) return [];
  return categories.filter(
    (category): category is LegacyRow =>
      category != null && typeof category === 'object' && typeof (category as LegacyRow).id === 'string',
  );
}

/**
 * v1005 (spec S4): the legacy single document `{ id: 'root', data }` becomes one row per
 * category, so upgrading no longer has to recreate the store and destroy an edited
 * catalogue. Idempotent: existing category rows are never rewritten or duplicated, and
 * the `video-catalog-version` metadata row is left alone.
 */
function migratePlansRows(tx: IDBTransaction): void {
  const request = tx.objectStore(PLANS_STORE).getAll();
  request.onsuccess = () => {
    const rows = request.result as LegacyRow[];
    const store = tx.objectStore(PLANS_STORE);
    const rootRow = rows.find((row) => row.id === PLANS_ROOT_KEY);

    if (rootRow) {
      if (!rows.some(isCategoryRow)) {
        const now = new Date().toISOString();
        categoriesOf(rootRow.data).forEach((category, position) => {
          putRow(store, { id: category.id, category, position, updatedAt: now, deletedAt: null });
        });
      }
      store.delete(PLANS_ROOT_KEY);
    }
  };
}

/**
 * Schema migration, exported for the fixture-based migration test: runs inside the
 * open upgrade transaction of a fake-indexeddb database with the same shapes.
 *
 * v1004 (design §2, §3): the five synced stores drop `autoIncrement` and their rows
 * are re-keyed with `crypto.randomUUID()` strings; every row gains the LWW/tombstone
 * sync fields (`updatedAt`, `deletedAt`); the `outbox` store is created.
 *
 * v1005 (spec S4): `plans` stops being recreated on upgrade; its legacy root document is
 * migrated to one row per category (see `migratePlansRows`).
 *
 * Must stay fully synchronous: the versionchange transaction is only kept alive by
 * pending requests, so the migration walks the stores one `getAll` at a time and
 * continues from each request's `onsuccess` handler. An `async` body would resolve
 * after the transaction committed and silently migrate nothing.
 *
 * Callers pass the *raw* objects from idb (`unwrap(db)`, `unwrap(tx)`): idb's upgrade
 * callback hands out proxies whose `getAll()` returns a promise instead of an
 * `IDBRequest`, which would swallow the `onsuccess` continuation.
 */
export function upgradeDatabase(db: IDBDatabase, oldVersion: number, tx: IDBTransaction): void {
  createLegacySyncedStores(db);

  if (!db.objectStoreNames.contains('settings')) {
    db.createObjectStore('settings', { keyPath: 'key' });
  }

  // v1005 (spec S4): never recreate `plans` on upgrade; the rows hold the user's catalogue.
  if (!db.objectStoreNames.contains(PLANS_STORE)) {
    db.createObjectStore(PLANS_STORE, { keyPath: 'id' });
  }

  if (oldVersion >= DB_VERSION) return;

  const now = new Date().toISOString();
  const queue = [...SYNCED_STORES];

  const migrateNext = (): void => {
    const spec = queue.shift();
    if (!spec) {
      if (!db.objectStoreNames.contains('outbox')) {
        db.createObjectStore('outbox', { keyPath: 'seq', autoIncrement: true });
      }
      migratePlansRows(tx);
      return;
    }

    const request = tx.objectStore(spec.name).getAll();
    request.onsuccess = () => {
      const rows = request.result as LegacyRow[];
      db.deleteObjectStore(spec.name);
      const store = db.createObjectStore(spec.name, { keyPath: 'id' });
      for (const index of spec.indexes) {
        store.createIndex(index.name, index.keyPath, { unique: index.unique ?? false });
      }
      for (const row of rows) {
        putRow(store, {
          ...row,
          id: typeof row.id === 'string' ? row.id : crypto.randomUUID(),
          updatedAt: typeof row.updatedAt === 'string' ? row.updatedAt : now,
          deletedAt: row.deletedAt ?? null,
        });
      }
      migrateNext();
    };
  };

  migrateNext();
}

export function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, _newVersion, tx) {
        upgradeDatabase(unwrap(db), oldVersion, unwrap(tx));
      },
    });
  }
  return dbPromise;
}
