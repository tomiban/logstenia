import { Hono } from 'hono';
import { isDevAuthBypass, verifyAccessJwt } from './access';

export interface Env {
  DB: D1Database;
  CF_ACCESS_TEAM: string;
  CF_ACCESS_AUD: string;
  /** Local development only; see `isDevAuthBypass`. */
  SYNC_DEV_NO_AUTH?: string;
}

const MAX_BODY_BYTES = 256 * 1024;
const MAX_MUTATIONS = 500;
const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 200;
const LOOKUP_PAIRS_PER_STATEMENT = 25;

const META_REV_QUERY = "SELECT value FROM meta WHERE key = 'rev'";
const ALLOCATE_REV_QUERY = "UPDATE meta SET value = value + ? WHERE key = 'rev' RETURNING value";
const LOOKUP_QUERY = 'SELECT entity, id, updated_at FROM rows WHERE (entity, id) IN (VALUES ';
const PAGE_QUERY =
  'SELECT entity, id, rev, updated_at, deleted_at, payload FROM rows WHERE rev > ? ORDER BY rev LIMIT ?';
/*
 * `rev` is derived from the counter *after* the allocation statement ran in the same
 * batch, so positional allocation stays atomic without a second round trip.
 */
const UPSERT_QUERY = `INSERT INTO rows (entity, id, rev, updated_at, deleted_at, payload)
VALUES (?, ?, (SELECT value FROM meta WHERE key = 'rev') - ? + ?, ?, ?, ?)
ON CONFLICT (entity, id) DO UPDATE SET
  rev = excluded.rev,
  updated_at = excluded.updated_at,
  deleted_at = excluded.deleted_at,
  payload = excluded.payload`;

interface RowRecord {
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

interface Change {
  entity: string;
  id: string;
  rev: number;
  updatedAt: string;
  deletedAt: string | null;
  row: unknown;
}

interface Mutation {
  entity: string;
  id: string;
  updatedAt: string;
  deletedAt: string | null;
  row: unknown;
}

interface PushBody {
  deviceId: string;
  mutations: Mutation[];
}

export const app = new Hono<{ Bindings: Env }>();

app.get('/api/health', (c) =>
  isDevAuthBypass(c.req.raw, c.env) ? c.json({ ok: true, devAuthBypass: true }) : c.json({ ok: true }),
);

app.use('/api/sync', async (c, next) => {
  const authorized = isDevAuthBypass(c.req.raw, c.env) || (await verifyAccessJwt(c.req.raw, c.env));
  if (!authorized) {
    return c.json({ error: 'unauthorized' }, 401);
  }
  await next();
});

app.get('/api/sync', async (c) => {
  const since = parseInteger(c.req.query('since'), 0);
  const limit = parseInteger(c.req.query('limit'), DEFAULT_LIMIT);
  if (since === null) return c.json({ error: 'invalid_since' }, 400);
  if (limit === null || limit < 1 || limit > MAX_LIMIT) return c.json({ error: 'invalid_limit' }, 400);

  const [meta, page] = await c.env.DB.batch([
    c.env.DB.prepare(META_REV_QUERY),
    c.env.DB.prepare(PAGE_QUERY).bind(since, limit + 1),
  ]);

  const rows = readRows<RowRecord>(page);
  return c.json({
    rev: readRev(meta),
    more: rows.length > limit,
    now: new Date().toISOString(),
    changes: rows.slice(0, limit).map(toChange),
  });
});

app.post('/api/sync', async (c) => {
  const declaredLength = Number(c.req.header('content-length') ?? '');
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return c.json({ error: 'payload_too_large' }, 413);
  }

  const raw = await c.req.text();
  if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) {
    return c.json({ error: 'payload_too_large' }, 413);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return c.json({ error: 'invalid_json' }, 400);
  }

  const body = parsePushBody(parsed);
  if (!body) return c.json({ error: 'invalid_body' }, 400);
  if (body.mutations.length > MAX_MUTATIONS) return c.json({ error: 'too_many_mutations' }, 400);

  if (body.mutations.length === 0) {
    const meta = await c.env.DB.prepare(META_REV_QUERY).first<{ value: number }>();
    return c.json({ rev: readRevValue(meta), applied: [], rejected: [] });
  }

  const existing = await loadExistingRows(c.env.DB, body.mutations);
  const applied: { mutation: Mutation; offset: number }[] = [];
  const rejected: { ref: string; reason: string }[] = [];

  for (const [index, mutation] of body.mutations.entries()) {
    const serverUpdatedAt = existing.get(rowKey(mutation.entity, mutation.id));
    if (serverUpdatedAt !== undefined && isServerNewer(serverUpdatedAt, mutation.updatedAt)) {
      rejected.push({ ref: `${mutation.entity}/${mutation.id}`, reason: 'stale_server_newer' });
      continue;
    }
    applied.push({ mutation, offset: index + 1 });
  }

  const statements = [c.env.DB.prepare(ALLOCATE_REV_QUERY).bind(body.mutations.length)];
  for (const { mutation, offset } of applied) {
    statements.push(
      c.env.DB.prepare(UPSERT_QUERY).bind(
        mutation.entity,
        mutation.id,
        body.mutations.length,
        offset,
        mutation.updatedAt,
        mutation.deletedAt,
        JSON.stringify(mutation.row),
      ),
    );
  }

  const [allocation] = await c.env.DB.batch(statements);

  return c.json({
    rev: readRev(allocation),
    applied: applied.map(({ mutation }) => `${mutation.entity}/${mutation.id}`),
    rejected,
  });
});

async function loadExistingRows(db: D1Database, mutations: Mutation[]): Promise<Map<string, string>> {
  const existing = new Map<string, string>();
  const statements: D1PreparedStatement[] = [];

  for (let start = 0; start < mutations.length; start += LOOKUP_PAIRS_PER_STATEMENT) {
    const chunk = mutations.slice(start, start + LOOKUP_PAIRS_PER_STATEMENT);
    const placeholders = chunk.map(() => '(?, ?)').join(', ');
    const params = chunk.flatMap((mutation) => [mutation.entity, mutation.id]);
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

function toChange(row: RowRecord): Change {
  return {
    entity: row.entity,
    id: row.id,
    rev: row.rev,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    row: JSON.parse(row.payload) as unknown,
  };
}

function isServerNewer(serverUpdatedAt: string, clientUpdatedAt: string): boolean {
  const serverTime = Date.parse(serverUpdatedAt);
  const clientTime = Date.parse(clientUpdatedAt);
  // A tie (and an ambiguous server timestamp) belongs to the client, keeping retries idempotent.
  if (Number.isNaN(serverTime) || Number.isNaN(clientTime)) return false;
  return serverTime > clientTime;
}

function rowKey(entity: string, id: string): string {
  return `${entity}\u0000${id}`;
}

function parseInteger(raw: string | undefined, fallback: number): number | null {
  if (raw === undefined || raw === '') return fallback;
  if (!/^\d+$/.test(raw)) return null;
  return Number(raw);
}

function parsePushBody(value: unknown): PushBody | null {
  if (!isRecord(value)) return null;
  const { deviceId, mutations } = value;
  if (typeof deviceId !== 'string' || !Array.isArray(mutations)) return null;

  const parsed: Mutation[] = [];
  for (const entry of mutations) {
    const mutation = parseMutation(entry);
    if (!mutation) return null;
    parsed.push(mutation);
  }

  return { deviceId, mutations: parsed };
}

function parseMutation(value: unknown): Mutation | null {
  if (!isRecord(value)) return null;
  const { entity, id, updatedAt, deletedAt, row } = value;
  if (typeof entity !== 'string' || entity === '') return null;
  if (typeof id !== 'string' || id === '') return null;
  if (typeof updatedAt !== 'string' || Number.isNaN(Date.parse(updatedAt))) return null;
  if (deletedAt !== undefined && deletedAt !== null && typeof deletedAt !== 'string') return null;

  return { entity, id, updatedAt, deletedAt: deletedAt ?? null, row: row ?? null };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readRows<T>(result: D1Result | undefined): T[] {
  return (result?.results ?? []) as T[];
}

function readRev(result: D1Result | undefined): number {
  const [record] = readRows<{ value?: number }>(result);
  return readRevValue(record);
}

function readRevValue(record: { value?: number } | null | undefined): number {
  if (!record || typeof record.value !== 'number') throw new Error('meta rev counter is missing');
  return record.value;
}

/**
 * Module Worker entry for `wrangler.toml`'s `main`. Without it the runtime never dispatches
 * to Hono: `wrangler dev` and the deployed Worker hang on every `/api/*` request while
 * static assets keep working, and the unit tests cannot notice because they call
 * `app.request(...)` directly.
 */
export default { fetch: app.fetch };
