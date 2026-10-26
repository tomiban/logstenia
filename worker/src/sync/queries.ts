/**
 * SQL layer for `/api/sync` (`odd/tasks/sync-layers.md` S2, S3).
 *
 * `owner` is the first parameter of every function that touches `rows`, so a statement cannot be
 * written without a tenant: isolation stops depending on remembering the `WHERE`. The statements
 * that only touch the global `rev` counter keep `db` first because they are owner-free by design.
 *
 * Statements and their parameters are the ones the router used to inline, so the contract stays
 * where it was; only the code moved.
 */
import type { Mutation } from './schema';

const META_REV_QUERY = "SELECT value FROM meta WHERE key = 'rev'";
const ALLOCATE_REV_QUERY = "UPDATE meta SET value = value + ? WHERE key = 'rev' RETURNING value";
const PAGE_QUERY =
  'SELECT entity, id, rev, updated_at, deleted_at, payload FROM rows WHERE owner = ? AND rev > ? ORDER BY rev LIMIT ?';
/*
 * The last-write-wins check lives in the statement, not in JS (spec S1): the lookup and the write
 * used to be two batches, so a newer row could commit between them and the older push would still
 * overwrite it, taking the higher `rev` with it and leaving every device converging to the wrong
 * value. `julianday` parses an ISO timestamp the way `Date.parse` did, and a NULL comparison (an
 * unparseable value) falls through to the client, so a tie and an ambiguous timestamp keep the
 * behaviour the API already had. `RETURNING` reports what the statement actually wrote, which is
 * how the caller learns what was rejected without a second round trip.
 */
const UPSERT_QUERY = `INSERT INTO rows (owner, entity, id, rev, updated_at, deleted_at, payload)
VALUES (?, ?, ?, (SELECT value FROM meta WHERE key = 'rev') - ? + ?, ?, ?, ?)
ON CONFLICT (owner, entity, id) DO UPDATE SET
  rev = excluded.rev,
  updated_at = excluded.updated_at,
  deleted_at = excluded.deleted_at,
  payload = excluded.payload
WHERE julianday(rows.updated_at) <= julianday(excluded.updated_at)
   OR julianday(rows.updated_at) IS NULL
   OR julianday(excluded.updated_at) IS NULL
RETURNING entity, id`;

export interface RowRecord {
  entity: string;
  id: string;
  rev: number;
  updated_at: string;
  deleted_at: string | null;
  payload: string;
}

export async function readRev(db: D1Database): Promise<number> {
  const record = await db.prepare(META_REV_QUERY).first<{ value?: number }>();
  return revValue(record);
}

/**
 * The caller's page and the current counter travel in one batch: the cursor a client stores has
 * to be the counter that page was cut from.
 */
export async function readPullPage(
  owner: string,
  db: D1Database,
  since: number,
  limit: number,
): Promise<{ rev: number; rows: RowRecord[] }> {
  const [meta, page] = await db.batch([
    db.prepare(META_REV_QUERY),
    db.prepare(PAGE_QUERY).bind(owner, since, limit),
  ]);
  return { rev: revFromResult(meta), rows: readRows<RowRecord>(page) };
}

/**
 * Allocates `total` revisions and writes every mutation in a single batch, so the LWW check and
 * the write cannot be separated by another push (spec S1, S2). `accepted[i]` says whether
 * `mutations[i]` was written; the statement's own `RETURNING` answers it, because a row rejected by
 * the `WHERE` returns nothing. Keeping the allocation and the upserts together is what makes
 * `rev > since` correct: assignment order has to match commit order.
 */
export async function writePush(
  owner: string,
  db: D1Database,
  mutations: readonly Mutation[],
): Promise<{ rev: number; accepted: boolean[] }> {
  const total = mutations.length;
  const statements: D1PreparedStatement[] = [db.prepare(ALLOCATE_REV_QUERY).bind(total)];
  for (const [index, mutation] of mutations.entries()) {
    statements.push(
      db.prepare(UPSERT_QUERY).bind(
        owner,
        mutation.entity,
        mutation.id,
        total,
        index + 1,
        mutation.updatedAt,
        mutation.deletedAt,
        JSON.stringify(mutation.row),
      ),
    );
  }

  const [allocation, ...writes] = await db.batch(statements);
  return { rev: revFromResult(allocation), accepted: writes.map((write) => readRows(write).length > 0) };
}

function readRows<T>(result: { results?: unknown[] } | undefined): T[] {
  return (result?.results ?? []) as T[];
}

function revFromResult(result: { results?: unknown[] } | undefined): number {
  const [record] = readRows<{ value?: number }>(result);
  return revValue(record);
}

function revValue(record: { value?: number } | null | undefined): number {
  if (!record || typeof record.value !== 'number') throw new Error('meta rev counter is missing');
  return record.value;
}
