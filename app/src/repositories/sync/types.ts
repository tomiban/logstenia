/**
 * Shapes shared by the client sync layer (`design-plans/backend-sync.md` §1, §3, §6).
 *
 * Every synced row carries the same bookkeeping fields: `updatedAt` is the
 * last-write-wins key and `deletedAt` marks a tombstone (`null`/absent while the row is
 * live). The merge functions only read these fields, so any table row satisfies them
 * structurally and no repository type has to be imported here.
 */
export interface SyncRowMeta {
  /** ISO timestamp of the last local write; the LWW conflict key. */
  updatedAt: string;
  /** ISO timestamp of the tombstone; `null` or absent while the row is live. */
  deletedAt?: string | null;
}

/**
 * One change of a `GET /sync` page (§5): envelope metadata plus the opaque row payload.
 * `row` is absent or `null` for a tombstone-only change, which the client still has to
 * store as a tombstone when the row is unknown locally.
 */
export interface PullChange<TPayload = unknown> extends SyncRowMeta {
  /** Stored row payload, or `null`/absent for a tombstone-only change. */
  row?: TPayload | null;
}

/** What the client must do with one pulled change (§6). */
export type PullDecision = 'insert' | 'update' | 'skip';

/** What the client must do with one local mutation: always write locally first (§6). */
export type MutationDecision = 'write';

/** One entry of `POST /sync` (§5): envelope metadata plus the opaque row payload. */
export interface SyncMutation extends SyncRowMeta {
  entity: string;
  id: string;
  row: unknown;
}

/** One mutation the server refused to apply because its own copy is newer (§5). */
export interface SyncRejection {
  ref: string;
  reason: string;
}

/** Body of a `POST /sync` response (§5). */
export interface SyncPushResult {
  rev: number;
  applied: string[];
  rejected: SyncRejection[];
}

/** One change of a `GET /sync` page: the merge payload plus its server identity (§5). */
export interface PulledChange extends PullChange {
  entity: string;
  id: string;
  rev: number;
}

/** Body of a `GET /sync` response; `more` asks the client for the next page (§5). */
export interface PullPage {
  rev: number;
  more: boolean;
  now?: string;
  changes: PulledChange[];
}

/**
 * Why the engine stopped and asked for a session: an Access login redirect, a rejected
 * JWT, or an HTML login page where JSON was expected (§7).
 */
export type AuthRequiredReason = 'redirect' | 'unauthorized' | 'non_json';

/**
 * Dexie primary-key field of a synced entity: `settings` keeps its natural `key`, every
 * other table stores a UUID under `id` (§2).
 */
export function syncKeyField(entity: string): 'id' | 'key' {
  return entity === 'settings' ? 'key' : 'id';
}
