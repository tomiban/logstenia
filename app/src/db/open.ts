import { openDB, type IDBPDatabase } from 'idb';

export const DB_NAME = 'logstenia';
export const DB_VERSION = 1003; // force re-seed plans (rename benchmarks)

let dbPromise: Promise<IDBPDatabase> | null = null;

export function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('sessions')) {
          const s = db.createObjectStore('sessions', { keyPath: 'id', autoIncrement: true });
          s.createIndex('date', 'date');
          s.createIndex('planId', 'planId');
          s.createIndex('modelId', 'modelId');
        }
        if (!db.objectStoreNames.contains('progress')) {
          const s = db.createObjectStore('progress', { keyPath: 'id', autoIncrement: true });
          s.createIndex('exerciseId', 'exerciseId');
          s.createIndex('week', 'week');
        }
        if (!db.objectStoreNames.contains('goals')) {
          const s = db.createObjectStore('goals', { keyPath: 'id', autoIncrement: true });
          s.createIndex('goalId', 'goalId');
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains('marks')) {
          const s = db.createObjectStore('marks', { keyPath: 'id', autoIncrement: true });
          s.createIndex('exercise', 'exercise');
          s.createIndex('mesoInicio', 'mesoInicio');
        }
        if (!db.objectStoreNames.contains('tags')) {
          const s = db.createObjectStore('tags', { keyPath: 'id', autoIncrement: true });
          s.createIndex('targetType', 'targetType');
          s.createIndex('targetId', 'targetId');
          s.createIndex('tag', 'tag');
          s.createIndex('targetType+targetId', ['targetType', 'targetId']);
        }
        if (db.objectStoreNames.contains('plans')) {
          db.deleteObjectStore('plans');
        }
        db.createObjectStore('plans', { keyPath: 'id' });
      },
    });
  }
  return dbPromise;
}
