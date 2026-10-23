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
