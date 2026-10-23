/**
 * Outbox write and read paths (`design-plans/backend-sync.md` §3, §7).
 *
 * A repository write stores the row and its pending push entry in one transaction, and
 * coalesces by `(entity, id)`: two offline edits of the same row leave a single entry
 * holding the newest snapshot, so an outdated snapshot cannot be rejected later as a
 * false conflict. Reads are ordered by `seq` so a bounded flush batch always pushes the
 * oldest pending changes first.
 */
import type { IDBPTransaction } from 'idb';
import { withWrite, type EntityName, type WriteTransaction } from '@/db';
import { getDB } from '@/db/open';
import type { SyncMutation } from './types';

export interface PendingOutboxEntry extends SyncMutation {
  seq: number;
}

/** Store added in schema v1004; `EntityName` still lists only the six synced tables. */
const OUTBOX_STORE = 'outbox';
const OUTBOX_SCOPE = OUTBOX_STORE as unknown as EntityName;
const LOCAL_ONLY_SETTING_PREFIXES = ['sync.', 'borrador:'];

/**
 * Local-only settings keys (`sync.cursor`, runner drafts, …) never leave the device: they
 * are excluded from the outbox, from pull-applied rows and from the JSON backup (§1).
 */
export function isLocalOnlySettingKey(key: string): boolean {
  return LOCAL_ONLY_SETTING_PREFIXES.some((prefix) => key.startsWith(prefix));
}

type OutboxWriteListener = () => void;

const writeListeners = new Set<OutboxWriteListener>();

/** Notifies after a pending entry is written, so the engine can debounce a sync (§7). */
export function onOutboxWrite(listener: OutboxWriteListener): () => void {
  writeListeners.add(listener);
  return () => {
    writeListeners.delete(listener);
  };
}

/** One readwrite transaction over `entity` and the outbox, for atomic row + entry writes. */
export function withOutboxWrite<T>(
  entity: EntityName,
  fn: (tx: WriteTransaction) => Promise<T>,
): Promise<T> {
  return withWrite([entity, OUTBOX_SCOPE], fn);
}

/** Stores the newest snapshot for `(entity, id)`, replacing any pending entry in place. */
export async function enqueueOutbox(tx: WriteTransaction, mutation: SyncMutation): Promise<void> {
  const store = outboxStore(tx);
  const pending = (await store.getAll()) as PendingOutboxEntry[];
  const existing = pending.find(
    (entry) => entry.entity === mutation.entity && entry.id === mutation.id,
  );
  await store.put(existing ? { ...mutation, seq: existing.seq } : mutation);
  for (const listener of writeListeners) listener();
}

/** Pending entries ordered by `seq`, capped at `limit` so a flush batch stays bounded. */
export async function pendingOutboxEntries(limit: number): Promise<PendingOutboxEntry[]> {
  const db = await getDB();
  return (await db.getAll(OUTBOX_STORE, undefined, limit)) as PendingOutboxEntry[];
}

export async function pendingCount(): Promise<number> {
  const db = await getDB();
  return db.count(OUTBOX_STORE);
}

/** Drops the entries the server accepted (applied or rejected) after a successful push. */
export async function deleteOutboxEntries(seqs: readonly number[]): Promise<void> {
  if (seqs.length === 0) return;
  const db = await getDB();
  const tx = db.transaction(OUTBOX_STORE, 'readwrite');
  for (const seq of seqs) {
    await tx.store.delete(seq);
  }
  await tx.done;
}

function outboxStore(tx: WriteTransaction) {
  const scope = tx as unknown as IDBPTransaction<unknown, string[], 'readwrite'>;
  return scope.objectStore(OUTBOX_STORE);
}
