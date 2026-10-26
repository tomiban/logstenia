import type { IDBPTransaction } from 'idb';
import type { Category } from '@/types';
import { getDB as getSharedDB } from './open';

function getDB() {
  return getSharedDB();
}

export const ENTITY_NAMES = [
  'sessions',
  'progress',
  'goals',
  'settings',
  'marks',
  'tags',
  'plans',
] as const;

export type EntityName = (typeof ENTITY_NAMES)[number];

export type WriteTransaction = IDBPTransaction<unknown, EntityName[], 'readwrite'>;

/**
 * Run `fn` inside one readwrite transaction spanning every entity in `entities`.
 *
 * Writes must be able to touch a row *and* its outbox entry atomically (design §3),
 * but `makeStore` below opens a single-store transaction per call. Repositories use
 * this helper so multi-store writes share one transaction.
 */
export async function withWrite<T>(
  entities: readonly EntityName[],
  fn: (tx: WriteTransaction) => Promise<T>,
): Promise<T> {
  const db = await getDB();
  const tx = db.transaction([...entities], 'readwrite');
  try {
    const result = await fn(tx);
    await tx.done;
    return result;
  } catch (error) {
    try {
      tx.abort();
    } catch (abortError) {
      // A settled transaction rejects `abort` with a `DOMException`; nothing else is expected.
      if (!(abortError instanceof DOMException)) throw abortError;
    }
    // Re-settling `tx.done` would surface an unhandled rejection; the original error is the one that matters.
    void tx.done.catch(() => undefined);
    throw error;
  }
}

export interface SessionSet {
  exercise: string;
  setIndex: number;
  value: string;
  unit: 'sec' | 'reps';
  bloqueOrden: number;
  orden: number;
}
/**
 * Sync metadata added to every synced row by schema v1004 (design §3). `updatedAt`
 * is the client-clock LWW key; `deletedAt` is the tombstone marker (null when live).
 */
export interface SyncFields {
  updatedAt: string;
  deletedAt?: string | null;
}

/** One pending push entry; `seq` is assigned by the store's autoincrement key. */
export interface OutboxRecord {
  seq?: number;
  entity: string;
  id: string;
  updatedAt: string;
  deletedAt: string | null;
  row: unknown;
}

export interface SessionRecord extends SyncFields {
  id: string;
  date: string;
  planId: string;
  modelId: string;
  durationSec: number;
  completed: boolean;
  sets?: SessionSet[];
}
export interface ProgressRecord extends SyncFields {
  id: string;
  exerciseId: string;
  week: string; // S1..S8
  value: number;
  date: string;
}
export interface GoalRecord extends SyncFields {
  id: string;
  goalId: string;
  current: number;
}
export interface SettingRecord extends SyncFields {
  key: string;
  /** Polymorphic: booleans, strings, numbers and draft objects. Narrow at each read site. */
  value: unknown;
}
export interface MarkRecord extends SyncFields {
  id: string;
  exercise: string; // display name
  exerciseId?: string; // stable id (preferred for queries)
  unit: 'sec' | 'reps';
  value: number;
  mesoInicio: string;
  date: string;
}
export interface TagRecord extends SyncFields {
  id: string;
  targetType: 'exercise' | 'routine' | 'program';
  targetId: string;
  tag: string;
}

/**
 * One category document (spec S2): the category itself is the sync unit, `position`
 * keeps the catalogue order and `updatedAt` / `deletedAt` are the shared sync fields.
 *
 * The string index signature is what makes these rows comparable to the generic
 * `Record<string, unknown>` scan `plansRepository` performs over the stored rows.
 */
interface CategoryDocumentRow {
  [field: string]: unknown;
  id: string;
  category: Category;
  position: number;
  updatedAt: string;
  deletedAt: string | null;
}

/** Catalogue metadata row: `{ id: 'video-catalog-version', version }`. */
/**
 * Metadata row, never a category document: `version` marks the video-catalogue version row and
 * `seeded` the marker that keeps an emptied catalogue from being re-seeded. Both are optional
 * because one row carries one of them.
 */
interface PlansMetaRow {
  [field: string]: unknown;
  id: string;
  version?: number;
  seeded?: boolean;
}

export type PlansRow = CategoryDocumentRow | PlansMetaRow;

/** Row type stored by each entity, so the shim hands back rows instead of `unknown`. */
export interface EntityRowMap {
  sessions: SessionRecord;
  progress: ProgressRecord;
  goals: GoalRecord;
  settings: SettingRecord;
  marks: MarkRecord;
  tags: TagRecord;
  plans: PlansRow;
}

function idxName(name: string): string {
  return name.replace(/^\[|\]$/g, '');
}

/** Rows matched by one index equality query. */
export interface MatchedRows<Row> {
  toArray(): Promise<Row[]>;
  count(): Promise<number>;
}

export interface MatchingRows<Row> extends MatchedRows<Row> {
  and(predicate: (row: Row) => boolean): MatchedRows<Row>;
}

export interface StoreIndex<Row> {
  equals(value: unknown): MatchingRows<Row>;
}

/** Shape of one single-store shim; `db` below is keyed by `EntityName`. */
export interface Store<K extends EntityName> {
  get(key: string | number): Promise<EntityRowMap[K] | undefined>;
  put(value: EntityRowMap[K]): Promise<IDBValidKey>;
  add(value: EntityRowMap[K]): Promise<IDBValidKey>;
  delete(key: string | number): Promise<void>;
  toArray(): Promise<EntityRowMap[K][]>;
  bulkPut(values: EntityRowMap[K][]): Promise<void>;
  where(indexName: string): StoreIndex<EntityRowMap[K]>;
}

function makeStore<K extends EntityName>(name: K): Store<K> {
  type Row = EntityRowMap[K];

  // Index lookups are a scan over the whole store, so every call must re-read it:
  // a remembered match set would serve rows from before a later write.
  async function matching(indexName: string, value: unknown): Promise<Row[]> {
    const db = await getDB();
    const all: Record<string, unknown>[] = await db.getAll(name);
    const fields = idxName(indexName).split('+');
    const rows = all.filter((row) => {
      if (fields.length > 1) {
        return fields.every((field, i) => row[field] === (Array.isArray(value) ? value[i] : value));
      }
      return row[fields[0]] === value;
    });
    return rows as Row[];
  }

  return {
    async get(key: string | number) {
      const db = await getDB();
      return db.get(name, key);
    },
    async put(value: EntityRowMap[K]) {
      const db = await getDB();
      return db.put(name, value);
    },
    async add(value: EntityRowMap[K]) {
      const db = await getDB();
      return db.add(name, value);
    },
    async delete(key: string | number) {
      const db = await getDB();
      return db.delete(name, key);
    },
    async toArray() {
      const db = await getDB();
      return db.getAll(name);
    },
    async bulkPut(values: EntityRowMap[K][]) {
      const db = await getDB();
      const tx = db.transaction(name, 'readwrite');
      for (const v of values) {
        await tx.store.put(v);
      }
      await tx.done;
    },
    where(indexName: string) {
      return {
        equals(value: unknown) {
          return {
            toArray: () => matching(indexName, value),
            count: async () => (await matching(indexName, value)).length,
            and: (predicate: (row: Row) => boolean) => ({
              toArray: async () => (await matching(indexName, value)).filter(predicate),
              count: async () => (await matching(indexName, value)).filter(predicate).length,
            }),
          };
        },
      };
    },
  };
}

/** Single-store read/write shim used by the repositories' read paths. */
export const db: { [K in EntityName]: Store<K> } = {
  sessions: makeStore('sessions'),
  progress: makeStore('progress'),
  goals: makeStore('goals'),
  settings: makeStore('settings'),
  marks: makeStore('marks'),
  tags: makeStore('tags'),
  plans: makeStore('plans'),
};