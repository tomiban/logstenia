import { beforeEach, describe, expect, it } from 'vitest';
import { app } from '../src/index';
import {
  AUD,
  DEFAULT_EMAIL,
  installAccessPlatform,
  jwksFor,
  JWKS_URL,
  makeKeyPair,
  MemoryCache,
  signToken,
  TEAM,
  type JsonWebKeySet,
  type PlatformState,
} from './helpers/access';

const T_OLD = '2026-10-20T17:55:00.000Z';
const T_BASE = '2026-10-20T18:00:00.000Z';
const T_NEW = '2026-10-20T18:05:00.000Z';

const MAX_BODY_BYTES = 256 * 1024;
const D1_MAX_BOUND_PARAMS = 100;

interface SyncChange {
  entity: string;
  id: string;
  rev: number;
  updatedAt: string;
  deletedAt: string | null;
  row: unknown;
}

interface PullBody {
  rev: number;
  more: boolean;
  now: string;
  changes: SyncChange[];
}

interface PushBody {
  rev: number;
  applied: string[];
  rejected: { ref: string; reason: string }[];
}

interface Mutation {
  entity: string;
  id: string;
  updatedAt: string;
  deletedAt?: string | null;
  row?: unknown;
}

interface StoredRow {
  owner: string;
  entity: string;
  id: string;
  rev: number;
  updatedAt: string;
  deletedAt: string | null;
  payload: string;
}

interface LoggedStatement {
  sql: string;
  params: unknown[];
  batch: number;
}

const META_REV = "SELECT value FROM meta WHERE key = 'rev'";
const PAGE_PREFIX = 'SELECT entity, id, rev, updated_at, deleted_at, payload FROM rows';
const ALLOCATE_PREFIX = 'UPDATE meta SET value = value +';
const UPSERT_PREFIX = 'INSERT INTO rows';

class FakeStatement {
  constructor(
    private readonly db: FakeD1,
    readonly sql: string,
    readonly params: unknown[] = [],
  ) {}

  bind(...params: unknown[]): FakeStatement {
    return new FakeStatement(this.db, this.sql, params);
  }

  async execute(): Promise<{ results: unknown[] }> {
    return this.db.execute(this);
  }

  async all(): Promise<{ results: unknown[] }> {
    return this.execute();
  }

  async first(): Promise<unknown> {
    const { results } = await this.execute();
    return results[0] ?? null;
  }

  async run(): Promise<{ results: unknown[] }> {
    return this.execute();
  }
}

class FakeD1 {
  readonly rows = new Map<string, StoredRow>();
  readonly log: LoggedStatement[] = [];
  rev = 0;
  private batchIndex = 0;

  prepare(sql: string): FakeStatement {
    return new FakeStatement(this, sql.trim());
  }

  async batch(statements: FakeStatement[]): Promise<{ results: unknown[] }[]> {
    this.batchIndex += 1;
    const results: { results: unknown[] }[] = [];
    for (const statement of statements) results.push(await statement.execute());
    return results;
  }

  seed(rows: { entity: string; id: string; updatedAt: string; deletedAt?: string | null; row: unknown }[]): void {
    for (const row of rows) {
      this.rev += 1;
      this.rows.set(rowKey(DEFAULT_EMAIL, row.entity, row.id), {
        owner: DEFAULT_EMAIL,
        entity: row.entity,
        id: row.id,
        rev: this.rev,
        updatedAt: row.updatedAt,
        deletedAt: row.deletedAt ?? null,
        payload: JSON.stringify(row.row ?? null),
      });
    }
  }

  execute(statement: FakeStatement): { results: unknown[] } {
    const sql = statement.sql;
    const params = statement.params;
    this.log.push({ sql, params, batch: this.batchIndex });

    if (sql === META_REV) return { results: [{ value: this.rev }] };

    if (sql.startsWith(PAGE_PREFIX)) {
      const owner = String(params[0]);
      const since = Number(params[1]);
      const limit = Number(params[2]);
      const results = [...this.rows.values()]
        .filter((row) => row.owner === owner && row.rev > since)
        .sort((a, b) => a.rev - b.rev)
        .slice(0, limit)
        .map((row) => ({
          entity: row.entity,
          id: row.id,
          rev: row.rev,
          updated_at: row.updatedAt,
          deleted_at: row.deletedAt,
          payload: row.payload,
        }));
      return { results };
    }

    if (sql.startsWith(ALLOCATE_PREFIX)) {
      this.rev += Number(params[0]);
      return { results: [{ value: this.rev }] };
    }

    if (sql.startsWith(UPSERT_PREFIX)) {
      const [owner, entity, id, total, offset, updatedAt, deletedAt, payload] = params as string[];
      const key = rowKey(String(owner), String(entity), String(id));
      const stored = this.rows.get(key);
      // Mirrors the statement's own `WHERE`: a stored row that is strictly newer wins and a tie
      // belongs to the client. A rejected row returns nothing, exactly as `RETURNING` would.
      if (stored && Date.parse(stored.updatedAt) > Date.parse(String(updatedAt))) {
        return { results: [] };
      }
      const rev = this.rev - Number(total) + Number(offset);
      this.rows.set(key, {
        owner: String(owner),
        entity: String(entity),
        id: String(id),
        rev,
        updatedAt: String(updatedAt),
        deletedAt: (deletedAt as string | null) ?? null,
        payload: String(payload),
      });
      return { results: [{ entity: String(entity), id: String(id) }] };
    }

    throw new Error(`FakeD1: unexpected statement: ${sql}`);
  }
}

function rowKey(owner: string, entity: string, id: string): string {
  return `${owner}\u0000${entity}\u0000${id}`;
}

const keyPairPromise = makeKeyPair();

let fetchCalls: string[] = [];
let cache: MemoryCache;

function installPlatform(jwks: JsonWebKeySet): void {
  const state: PlatformState = installAccessPlatform(jwks);
  fetchCalls = state.fetchCalls;
  cache = state.cache;
}

function envFor(db: FakeD1): { DB: D1Database; CF_ACCESS_TEAM: string; CF_ACCESS_AUD: string } {
  return { DB: db as unknown as D1Database, CF_ACCESS_TEAM: TEAM, CF_ACCESS_AUD: AUD };
}

async function getSync(db: FakeD1, query = '', token?: string): Promise<Response> {
  const headers: Record<string, string> = {};
  if (token !== undefined) headers['cf-access-jwt-assertion'] = token;
  return app.request(`/api/sync${query}`, { method: 'GET', headers }, envFor(db));
}

async function postSync(db: FakeD1, body: unknown, token?: string): Promise<Response> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (token !== undefined) headers['cf-access-jwt-assertion'] = token;
  return app.request(
    '/api/sync',
    { method: 'POST', headers, body: typeof body === 'string' ? body : JSON.stringify(body) },
    envFor(db),
  );
}

async function authorizedToken(keys?: CryptoKeyPair): Promise<string> {
  const resolved = keys ?? (await keyPairPromise);
  return signToken(resolved.privateKey);
}

function mutation(entity: string, id: string, updatedAt = T_BASE): Mutation {
  return { entity, id, updatedAt, deletedAt: null, row: { id, entity, updatedAt } };
}

describe('access verification', () => {
  let db: FakeD1;

  beforeEach(async () => {
    db = new FakeD1();
    installPlatform(await jwksFor(await keyPairPromise));
  });

  it('rejects a request with no Cf-Access-Jwt-Assertion', async () => {
    const response = await getSync(db);

    expect(response.status).toBe(401);
    expect(fetchCalls).toEqual([]);
    expect(db.log).toEqual([]);
  });

  it('rejects a malformed token', async () => {
    const response = await getSync(db, '', 'not-a-jwt');

    expect(response.status).toBe(401);
    expect(db.log).toEqual([]);
  });

  it('rejects a token signed by another key', async () => {
    const other = await makeKeyPair();
    const token = await signToken(other.privateKey);

    const response = await getSync(db, '', token);

    expect(response.status).toBe(401);
    expect(db.log).toEqual([]);
  });

  it('rejects a token for another audience', async () => {
    const token = await authorizedToken();
    const foreign = await signToken((await keyPairPromise).privateKey, { aud: 'someone-else' });

    expect((await getSync(db, '', foreign)).status).toBe(401);
    expect((await getSync(db, '', token)).status).toBe(200);
  });

  it('rejects an expired token', async () => {
    const token = await signToken((await keyPairPromise).privateKey, {
      exp: Math.floor(Date.now() / 1000) - 60,
    });

    expect((await getSync(db, '', token)).status).toBe(401);
  });

  it('accepts a valid token and caches the team JWKS', async () => {
    const token = await authorizedToken();

    expect((await getSync(db, '', token)).status).toBe(200);
    expect((await getSync(db, '', token)).status).toBe(200);
    expect(fetchCalls).toEqual([JWKS_URL]);
    expect(cache.size).toBe(1);
  });

  describe('local development bypass', () => {
    const withDevFlag = (flag?: string) => ({
      ...envFor(db),
      ...(flag === undefined ? {} : { SYNC_DEV_NO_AUTH: flag }),
    });

    it('serves the API on loopback without a token when the dev flag is exactly true', async () => {
      const response = await app.request('/api/sync', { method: 'GET' }, withDevFlag('true'));

      expect(response.status).toBe(200);
      expect(fetchCalls).toEqual([]);
    });

    it('keeps failing closed on loopback when the dev flag is absent', async () => {
      const response = await app.request('/api/sync', { method: 'GET' }, withDevFlag());

      expect(response.status).toBe(401);
    });

    it('ignores a dev flag that is not exactly true', async () => {
      expect((await app.request('/api/sync', { method: 'GET' }, withDevFlag('1'))).status).toBe(401);
      expect((await app.request('/api/sync', { method: 'GET' }, withDevFlag('yes'))).status).toBe(401);
    });

    it('keeps the bypass off a non-loopback host even with the dev flag set', async () => {
      const response = await app.request(
        'https://logstenia-sync.example.workers.dev/api/sync',
        { method: 'GET' },
        withDevFlag('true'),
      );

      expect(response.status).toBe(401);
      expect(fetchCalls).toEqual([]);
    });

    it('announces the bypass on health only while it is active', async () => {
      const devHealth = await app.request('/api/health', { method: 'GET' }, withDevFlag('true'));
      const plainHealth = await app.request('/api/health', { method: 'GET' }, withDevFlag());

      expect(await devHealth.json()).toEqual({ ok: true, devAuthBypass: true });
      expect(await plainHealth.json()).toEqual({ ok: true });
    });
  });

  it('serves health without an Access session', async () => {
    const response = await app.request('/api/health', { method: 'GET' }, envFor(db));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });
});

describe('GET /api/sync', () => {
  let db: FakeD1;
  let token: string;

  beforeEach(async () => {
    db = new FakeD1();
    installPlatform(await jwksFor(await keyPairPromise));
    token = await authorizedToken();
  });

  it('returns an empty first page with the current rev and server clock', async () => {
    const response = await getSync(db, '', token);
    const body = (await response.json()) as PullBody;

    expect(response.status).toBe(200);
    expect(body.rev).toBe(0);
    expect(body.more).toBe(false);
    expect(body.changes).toEqual([]);
    expect(Number.isNaN(Date.parse(body.now))).toBe(false);
  });

  it('paginates by cursor without skipping or repeating a row', async () => {
    db.seed(
      Array.from({ length: 5 }, (_, index) => ({
        entity: 'sessions',
        id: `session-${index}`,
        updatedAt: T_BASE,
        row: { id: `session-${index}` },
      })),
    );

    const seen: SyncChange[] = [];
    let since = 0;
    let more = true;
    while (more) {
      const body = (await (await getSync(db, `?since=${since}&limit=2`, token)).json()) as PullBody;
      seen.push(...body.changes);
      since = body.changes.at(-1)?.rev ?? since;
      more = body.more;
    }

    expect(seen.map((change) => change.id)).toEqual([
      'session-0',
      'session-1',
      'session-2',
      'session-3',
      'session-4',
    ]);
    expect(new Set(seen.map((change) => change.rev)).size).toBe(5);
    const revs = seen.map((change) => change.rev);
    expect(revs).toEqual([...revs].sort((a, b) => a - b));
    expect(more).toBe(false);
  });

  it('rejects invalid cursor parameters', async () => {
    expect((await getSync(db, '?since=abc', token)).status).toBe(400);
    expect((await getSync(db, '?limit=0', token)).status).toBe(400);
  });
});

describe('POST /api/sync', () => {
  let db: FakeD1;
  let token: string;

  beforeEach(async () => {
    db = new FakeD1();
    installPlatform(await jwksFor(await keyPairPromise));
    token = await authorizedToken();
  });

  it('applies a new row and exposes it on the next pull', async () => {
    const response = await postSync(
      db,
      { deviceId: 'dev_a', mutations: [mutation('sessions', 'session-1')] },
      token,
    );
    const body = (await response.json()) as PushBody;

    expect(response.status).toBe(200);
    expect(body.applied).toEqual(['sessions/session-1']);
    expect(body.rejected).toEqual([]);
    expect(body.rev).toBe(1);

    const pulled = (await (await getSync(db, '?since=0', token)).json()) as PullBody;
    expect(pulled.changes).toHaveLength(1);
    expect(pulled.changes[0]?.id).toBe('session-1');
    expect(pulled.changes[0]?.row).toEqual({ id: 'session-1', entity: 'sessions', updatedAt: T_BASE });
  });

  it('rejects a mutation older than the stored row and leaves the server copy untouched', async () => {
    db.seed([{ entity: 'settings', id: 'theme', updatedAt: T_NEW, row: { value: 'dark' } }]);

    const response = await postSync(
      db,
      {
        deviceId: 'dev_a',
        mutations: [{ entity: 'settings', id: 'theme', updatedAt: T_OLD, row: { value: 'light' } }],
      },
      token,
    );
    const body = (await response.json()) as PushBody;

    expect(response.status).toBe(200);
    expect(body.applied).toEqual([]);
    expect(body.rejected).toEqual([{ ref: 'settings/theme', reason: 'stale_server_newer' }]);

    const pulled = (await (await getSync(db, '?since=0', token)).json()) as PullBody;
    expect(pulled.changes[0]?.row).toEqual({ value: 'dark' });
  });

  it('lets the client win a timestamp tie', async () => {
    db.seed([{ entity: 'settings', id: 'theme', updatedAt: T_BASE, row: { value: 'light' } }]);

    const body = (await (
      await postSync(
        db,
        {
          deviceId: 'dev_a',
          mutations: [{ entity: 'settings', id: 'theme', updatedAt: T_BASE, row: { value: 'dark' } }],
        },
        token,
      )
    ).json()) as PushBody;

    expect(body.applied).toEqual(['settings/theme']);
    expect(body.rejected).toEqual([]);
  });

  it('stores tombstones with their deletedAt', async () => {
    await postSync(
      db,
      {
        deviceId: 'dev_a',
        mutations: [{ entity: 'tags', id: 'tag-1', updatedAt: T_NEW, deletedAt: T_NEW, row: null }],
      },
      token,
    );

    const pulled = (await (await getSync(db, '?since=0', token)).json()) as PullBody;
    expect(pulled.changes[0]?.deletedAt).toBe(T_NEW);
    expect(pulled.changes[0]?.row).toBeNull();
  });

  it('allocates a strictly higher rev on every POST', async () => {
    const first = (await (
      await postSync(db, { deviceId: 'dev_a', mutations: [mutation('sessions', 'session-1')] }, token)
    ).json()) as PushBody;
    const second = (await (
      await postSync(
        db,
        { deviceId: 'dev_b', mutations: [mutation('marks', 'mark-1'), mutation('tags', 'tag-1')] },
        token,
      )
    ).json()) as PushBody;

    expect(first.rev).toBe(1);
    expect(second.rev).toBe(3);
    expect(second.applied).toEqual(['marks/mark-1', 'tags/tag-1']);

    const pulled = (await (await getSync(db, '?since=0&limit=200', token)).json()) as PullBody;
    expect(pulled.changes.map((change) => change.rev)).toEqual([1, 2, 3]);
    expect(pulled.rev).toBe(3);
  });

  it('writes 500 mutations in one batch, within the parameter limit per statement', async () => {
    const mutations = Array.from({ length: 500 }, (_, index) => mutation('tags', `tag-${index}`));

    const response = await postSync(db, { deviceId: 'dev_a', mutations }, token);
    const body = (await response.json()) as PushBody;

    expect(response.status).toBe(200);
    expect(body.applied).toHaveLength(500);
    expect(db.rows.size).toBe(500);

    // The lookup and the write share a batch now (spec S1), so one allocation covers the push.
    const allocations = db.log.filter((statement) => statement.sql.startsWith(ALLOCATE_PREFIX));
    expect(allocations).toHaveLength(1);
    for (const statement of db.log) {
      expect(statement.params.length).toBeLessThanOrEqual(D1_MAX_BOUND_PARAMS);
    }

    const revs: number[] = [];
    let since = 0;
    let more = true;
    while (more) {
      const page = (await (await getSync(db, `?since=${since}&limit=200`, token)).json()) as PullBody;
      revs.push(...page.changes.map((change) => change.rev));
      since = page.changes.at(-1)?.rev ?? since;
      more = page.more;
    }
    expect(revs).toHaveLength(500);
    expect(new Set(revs).size).toBe(500);
  });

  it('rejects more than 500 mutations without touching the database', async () => {
    const mutations = Array.from({ length: 501 }, (_, index) => mutation('tags', `tag-${index}`));

    const response = await postSync(db, { deviceId: 'dev_a', mutations }, token);
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe('too_many_mutations');
    expect(db.rows.size).toBe(0);
    expect(db.log).toEqual([]);
  });

  it('rejects a body over 256 KB without touching the database', async () => {
    const body = JSON.stringify({
      deviceId: 'dev_a',
      mutations: [{ entity: 'sessions', id: 'session-1', updatedAt: T_BASE, row: { blob: 'x'.repeat(MAX_BODY_BYTES) } }],
    });

    const response = await postSync(db, body, token);
    const parsed = (await response.json()) as { error: string };

    expect(response.status).toBe(413);
    expect(parsed.error).toBe('payload_too_large');
    expect(db.rows.size).toBe(0);
    expect(db.log).toEqual([]);
  });

  it('rejects a malformed body', async () => {
    expect((await postSync(db, 'not json', token)).status).toBe(400);
    expect((await postSync(db, { deviceId: 'dev_a' }, token)).status).toBe(400);
    expect((await postSync(db, { deviceId: 'dev_a', mutations: [{ id: 'x' }] }, token)).status).toBe(400);
  });
});
