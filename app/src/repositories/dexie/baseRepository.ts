import { db, withWrite, type EntityName, type WriteTransaction } from '@/db';
import { enqueueOutbox, isLocalOnlySettingKey, withOutboxWrite } from '../sync/outbox';
import { syncKeyField, type SyncMutation } from '../sync/types';

type LegacyRow = Record<string, unknown>;

function nowISO(): string {
  return new Date().toISOString();
}

/**
 * Fill the v1004 row identity: key string, client-clock `updatedAt`, live `deletedAt`.
 * Existing values are preserved so backups and server rows keep their timestamps
 * (design §3, §5).
 */
function normalizeSyncRow(entity: EntityName, row: unknown): LegacyRow {
  const source = (row ?? {}) as LegacyRow;
  const normalized: LegacyRow = {
    ...source,
    updatedAt: typeof source.updatedAt === 'string' ? source.updatedAt : nowISO(),
    deletedAt: source.deletedAt ?? null,
  };

  if (syncKeyField(entity) === 'id') {
    normalized.id = typeof source.id === 'string' ? source.id : crypto.randomUUID();
  }

  return normalized;
}

/** The outbox entry for a stored row, or `null` for rows that must never leave the device. */
function mutationOf(entity: EntityName, row: LegacyRow): SyncMutation | null {
  const key = row[syncKeyField(entity)];
  if (typeof key !== 'string') return null;
  if (entity === 'settings' && isLocalOnlySettingKey(key)) return null;

  return {
    entity,
    id: key,
    updatedAt: String(row.updatedAt),
    deletedAt: typeof row.deletedAt === 'string' ? row.deletedAt : null,
    row,
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
 * Reads go through the `db` shim (tombstones filtered out); writes share one transaction
 * with their outbox entry, so a row never exists without its pending push and vice versa
 * (design §3, §7).
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
    const normalized = normalizeSyncRow(this.entity, row);
    await withOutboxWrite(this.entity, async (tx) => {
      await tx.objectStore(this.entity).put(normalized);
      await this.enqueue(tx, normalized);
    });
  }

  async add(row: Omit<T, 'id' | 'updatedAt' | 'deletedAt'> & { id?: string }): Promise<void> {
    const normalized = normalizeSyncRow(this.entity, row);
    await withOutboxWrite(this.entity, async (tx) => {
      await tx.objectStore(this.entity).add(normalized);
      await this.enqueue(tx, normalized);
    });
  }

  async bulkPut(rows: T[]): Promise<void> {
    const normalized = rows.map((row) => normalizeSyncRow(this.entity, row));
    await withOutboxWrite(this.entity, async (tx) => {
      const store = tx.objectStore(this.entity);
      for (const row of normalized) {
        await store.put(row);
        await this.enqueue(tx, row);
      }
    });
  }

  /**
   * Tombstone delete (design §2, §6): the row stays in Dexie with `deletedAt` set and
   * a bumped `updatedAt`, so the deletion wins last-write-wins on the next push.
   */
  async softDelete(key: string | number): Promise<void> {
    await withOutboxWrite(this.entity, async (tx) => {
      const store = tx.objectStore(this.entity);
      const row = (await store.get(key)) as LegacyRow | undefined;
      if (!row || row.deletedAt != null) return;
      const deletedAt = nowISO();
      const tombstone = { ...row, updatedAt: deletedAt, deletedAt };
      await store.put(tombstone);
      await this.enqueue(tx, tombstone);
    });
  }

  /** Always-hard removal, for local-only rows that must never leave the device. */
  protected async deleteRow(key: string | number): Promise<void> {
    await withWrite([this.entity], async (tx) => {
      await tx.objectStore(this.entity).delete(key);
    });
  }

  private async enqueue(tx: WriteTransaction, row: LegacyRow): Promise<void> {
    const mutation = mutationOf(this.entity, row);
    if (mutation) await enqueueOutbox(tx, mutation);
  }
}
