import { db, withWrite, type EntityName } from '@/db';

type LegacyRow = Record<string, unknown>;

function nowISO(): string {
  return new Date().toISOString();
}

/**
 * Fill the v1004 row identity: UUID string `id`, client-clock `updatedAt`, live
 * `deletedAt`. Existing values are preserved so backups and server rows keep their
 * timestamps (design §3, §5).
 */
function normalizeSyncRow(row: unknown): LegacyRow {
  const source = (row ?? {}) as LegacyRow;
  return {
    ...source,
    id: typeof source.id === 'string' ? source.id : crypto.randomUUID(),
    updatedAt: typeof source.updatedAt === 'string' ? source.updatedAt : nowISO(),
    deletedAt: source.deletedAt ?? null,
  };
}

/** Rows marked with a tombstone never come back through the repository surface. */
function isLive(row: unknown): boolean {
  const deletedAt = (row as LegacyRow | null)?.deletedAt;
  return deletedAt == null;
}

/**
 * Shared query + write surface for the idb-backed entity repositories.
 *
 * Reads go through the `db` shim (tombstones filtered out); writes go through
 * `withWrite` so a row and its outbox entry can share one transaction (design §3).
 */
export abstract class DexieRepository<T> {
  protected abstract readonly entity: EntityName;

  async list(): Promise<T[]> {
    const rows = (await db[this.entity].toArray()) as unknown[];
    return rows.filter(isLive) as T[];
  }

  async get(key: string | number): Promise<T | undefined> {
    const row = (await db[this.entity].get(key)) as unknown;
    return row != null && isLive(row) ? (row as T) : undefined;
  }

  async listWhere(index: string, value: unknown): Promise<T[]> {
    const rows = (await db[this.entity].where(index).equals(value).toArray()) as unknown[];
    return rows.filter(isLive) as T[];
  }

  async put(row: T): Promise<void> {
    const normalized = normalizeSyncRow(row);
    await withWrite([this.entity], async (tx) => {
      await tx.objectStore(this.entity).put(normalized);
    });
  }

  async add(row: Omit<T, 'id' | 'updatedAt' | 'deletedAt'> & { id?: string }): Promise<void> {
    const normalized = normalizeSyncRow(row);
    await withWrite([this.entity], async (tx) => {
      await tx.objectStore(this.entity).add(normalized);
    });
  }

  async bulkPut(rows: T[]): Promise<void> {
    const normalized = rows.map(normalizeSyncRow);
    await withWrite([this.entity], async (tx) => {
      const store = tx.objectStore(this.entity);
      for (const row of normalized) {
        await store.put(row);
      }
    });
  }

  /**
   * Tombstone delete (design §2, §6): the row stays in Dexie with `deletedAt` set and
   * a bumped `updatedAt`, so the deletion wins last-write-wins on the next push.
   */
  async softDelete(key: string | number): Promise<void> {
    await withWrite([this.entity], async (tx) => {
      const store = tx.objectStore(this.entity);
      const row = (await store.get(key)) as LegacyRow | undefined;
      if (!row || row.deletedAt != null) return;
      const deletedAt = nowISO();
      await store.put({ ...row, updatedAt: deletedAt, deletedAt });
    });
  }

  /** Always-hard removal, for local-only rows that must never leave the device. */
  protected async deleteRow(key: string | number): Promise<void> {
    await withWrite([this.entity], async (tx) => {
      await tx.objectStore(this.entity).delete(key);
    });
  }
}
