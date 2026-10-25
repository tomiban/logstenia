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
const LOOKUP_QUERY = 'SELECT entity, id, updated_at FROM rows WHERE (owner, entity, id) IN (VALUES ';
const PAGE_QUERY =
  'SELECT entity, id, rev, updated_at, deleted_at, payload FROM rows WHERE owner = ? AND rev > ? ORDER BY rev LIMIT ?';
/*
 * `rev` is derived from the counter *after* the allocation statement ran in the same
 * batch, so positional allocation stays atomic without a second round trip. The counter is
 * global and monotonic: each owner keeps its own cursor, and gaps left by rejected mutations
 * are harmless.
 */
const UPSERT_QUERY = `INSERT INTO rows (owner, entity, id, rev, updated_at, deleted_at, payload)
VALUES (?, ?, ?, (SELECT value FROM meta WHERE key = 'rev') - ? + ?, ?, ?, ?)
ON CONFLICT (owner, entity, id) DO UPDATE SET
  rev = excluded.rev,
  updated_at = excluded.updated_at,
  deleted_at = excluded.deleted_at,
  payload = excluded.payload`;

/** `(owner, entity, id)` triples per lookup statement: 33 × 3 = 99 parameters, under D1's 100. */
const LOOKUP_TRIPLES_PER_STATEMENT = 33;

export interface RowRecord {
  entity: string;
  id: string;
  rev: number;
  updated_at: string;
  deleted_at: string | null;
  payload: string;
}

interface LookupRecord {
  entity: string;
  id: string;
  updated_at: string;
}

/** A mutation the domain accepted, with its 1-based position inside the pushed batch. */
export interface AcceptedMutation {
  mutation: Mutation;
  offset: number;
}

export function rowKey(entity: string, id: string): string {
  return `${entity}\u0000${id}`;
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

export async function readExistingUpdatedAt(
  owner: string,
  db: D1Database,
  mutations: readonly Mutation[],
): Promise<Map<string, string>> {
  const existing = new Map<string, string>();
  const statements: D1PreparedStatement[] = [];

  for (let start = 0; start < mutations.length; start += LOOKUP_TRIPLES_PER_STATEMENT) {
    const chunk = mutations.slice(start, start + LOOKUP_TRIPLES_PER_STATEMENT);
    const placeholders = chunk.map(() => '(?, ?, ?)').join(', ');
    const params = chunk.flatMap((mutation) => [owner, mutation.entity, mutation.id]);
    statements.push(db.prepare(`${LOOKUP_QUERY}${placeholders})`).bind(...params));
  }

  const results = await db.batch(statements);
  for (const result of results) {
    for (const row of readRows<LookupRecord>(result)) {
      existing.set(rowKey(row.entity, row.id), row.updated_at);
    }
  }

  return existing;
}

/** Allocates `total` revisions and writes the accepted ones in a single batch. */
export async function writeMutations(
  owner: string,
  db: D1Database,
  total: number,
  accepted: readonly AcceptedMutation[],
): Promise<number> {
  const statements: D1PreparedStatement[] = [db.prepare(ALLOCATE_REV_QUERY).bind(total)];
  for (const { mutation, offset } of accepted) {
    statements.push(
      db.prepare(UPSERT_QUERY).bind(
        owner,
        mutation.entity,
        mutation.id,
        total,
        offset,
        mutation.updatedAt,
        mutation.deletedAt,
        JSON.stringify(mutation.row),
      ),
    );
  }

  const [allocation] = await db.batch(statements);
  return revFromResult(allocation);
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
