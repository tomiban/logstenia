import { db, withWrite, type EntityName } from '@/db';

/**
 * Shared query + write surface for the idb-backed entity repositories.
 *
 * Reads go through the `db` shim; writes go through `withWrite` so that a row and
 * its outbox entry can later share a single transaction (design §3).
 */
export abstract class DexieRepository<T> {
  protected abstract readonly entity: EntityName;

  async list(): Promise<T[]> {
    return (await db[this.entity].toArray()) as T[];
  }

  async get(key: string | number): Promise<T | undefined> {
    return (await db[this.entity].get(key)) as T | undefined;
  }

  async listWhere(index: string, value: unknown): Promise<T[]> {
    return (await db[this.entity].where(index).equals(value).toArray()) as T[];
  }

  async put(row: T): Promise<void> {
    await withWrite([this.entity], async (tx) => {
      await tx.objectStore(this.entity).put(row);
    });
  }

  async add(row: T): Promise<void> {
    await withWrite([this.entity], async (tx) => {
      await tx.objectStore(this.entity).add(row);
    });
  }

  async bulkPut(rows: T[]): Promise<void> {
    await withWrite([this.entity], async (tx) => {
      const store = tx.objectStore(this.entity);
      for (const row of rows) {
        await store.put(row);
      }
    });
  }

  /** Tombstone delete. Until schema v1004 adds `deletedAt` this is the previous hard delete. */
  async softDelete(key: string | number): Promise<void> {
    await this.deleteRow(key);
  }

  /** Always-hard removal, for local-only rows that must never leave the device. */
  protected async deleteRow(key: string | number): Promise<void> {
    await withWrite([this.entity], async (tx) => {
      await tx.objectStore(this.entity).delete(key);
    });
  }
}
