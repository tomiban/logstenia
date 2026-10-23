import type { IDBPTransaction } from 'idb';
import { getDB as getSharedDB } from './open';

function getDB() {
  return getSharedDB();
}

export const ENTITY_NAMES = ['sessions', 'progress', 'goals', 'settings', 'marks', 'tags'] as const;

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
    } catch {
      // Transaction already settled; the original error is the one that matters.
    }
    tx.done.catch(() => {});
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
export interface SessionRecord {
  id?: number;
  date: string;
  planId: string;
  modelId: string;
  durationSec: number;
  completed: boolean;
  sets?: SessionSet[];
}
export interface ProgressRecord {
  id?: number;
  exerciseId: string;
  week: string; // S1..S8
  value: number;
  date: string;
}
export interface GoalRecord {
  id?: number;
  goalId: string;
  current: number;
  updatedAt: string;
}
export interface SettingRecord {
  key: string;
  value: any;
}
export interface MarkRecord {
  id?: number;
  exercise: string; // display name
  exerciseId?: string; // stable id (preferred for queries)
  unit: 'sec' | 'reps';
  value: number;
  mesoInicio: string;
  date: string;
}
export interface TagRecord {
  id?: number;
  targetType: 'exercise' | 'routine' | 'program';
  targetId: string;
  tag: string;
}

function idxName(name: string): string {
  return name.replace(/^\[|\]$/g, '');
}

function makeStore(name: string) {
  return {
    async get(key: any): Promise<any> {
      const db = await getDB();
      return db.get(name, key);
    },
    async put(value: any): Promise<any> {
      const db = await getDB();
      return db.put(name, value);
    },
    async add(value: any): Promise<any> {
      const db = await getDB();
      return db.add(name, value);
    },
    async delete(key: any): Promise<void> {
      const db = await getDB();
      return db.delete(name, key);
    },
    async toArray(): Promise<any[]> {
      const db = await getDB();
      return db.getAll(name);
    },
    async bulkPut(values: any[]): Promise<void> {
      const db = await getDB();
      const tx = db.transaction(name, 'readwrite');
      for (const v of values) {
        await tx.store.put(v);
      }
      await tx.done;
    },
    where(indexName: string) {
      return {
        equals(value: any) {
          let cached: any[] | null = null;
          const fetch = async (): Promise<any[]> => {
            if (cached) return cached;
            const db = await getDB();
            const all = await db.getAll(name);
            const fields = idxName(indexName).split('+');
            cached = all.filter((row: any) => {
              if (fields.length > 1) {
                return fields.every((f, i) => row[f] === (Array.isArray(value) ? value[i] : value));
              }
              return row[fields[0]] === value;
            });
            return cached;
          };
          return {
            toArray: async (): Promise<any[]> => fetch(),
            count: async (): Promise<number> => (await fetch()).length,
            and: (fn: (row: any) => boolean) => ({
              toArray: async (): Promise<any[]> => (await fetch()).filter(fn),
              count: async (): Promise<number> => (await fetch()).filter(fn).length,
            }),
          };
        },
      };
    },
  };
}

/** Single-store read/write shim used by the repositories' read paths. */
export const db = {
  sessions: makeStore('sessions'),
  progress: makeStore('progress'),
  goals: makeStore('goals'),
  settings: makeStore('settings'),
  marks: makeStore('marks'),
  tags: makeStore('tags'),
};