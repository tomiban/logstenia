import { beforeEach, describe, expect, it } from 'vitest';
import { app } from '../src/index';

const TEAM = 'logstenia';
const AUD = 'aud-logstenia';
const JWKS_URL = `https://${TEAM}.cloudflareaccess.com/cdn-cgi/access/certs`;
const ISSUER = `https://${TEAM}.cloudflareaccess.com`;

const T_OLD = '2026-10-20T17:55:00.000Z';
const T_BASE = '2026-10-20T18:00:00.000Z';
const T_NEW = '2026-10-20T18:05:00.000Z';

const MAX_BODY_BYTES = 256 * 1024;
const LOOKUP_PAIRS_PER_STATEMENT = 25;
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
const LOOKUP_PREFIX = 'SELECT entity, id, updated_at FROM rows';
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
      this.rows.set(rowKey(row.entity, row.id), {
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

    if (sql.startsWith(LOOKUP_PREFIX)) {
      const results: unknown[] = [];
      for (let i = 0; i < params.length; i += 2) {
        const stored = this.rows.get(rowKey(String(params[i]), String(params[i + 1])));
        if (stored) results.push({ entity: stored.entity, id: stored.id, updated_at: stored.updatedAt });
      }
      return { results };
    }

    if (sql.startsWith(PAGE_PREFIX)) {
      const since = Number(params[0]);
      const limit = Number(params[1]);
      const results = [...this.rows.values()]
        .filter((row) => row.rev > since)
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
      const [entity, id, total, offset, updatedAt, deletedAt, payload] = params as string[];
      const rev = this.rev - Number(total) + Number(offset);
      this.rows.set(rowKey(String(entity), String(id)), {
        entity: String(entity),
        id: String(id),
        rev,
        updatedAt: String(updatedAt),
        deletedAt: (deletedAt as string | null) ?? null,
        payload: String(payload),
      });
      return { results: [] };
    }

    throw new Error(`FakeD1: unexpected statement: ${sql}`);
  }
}

function rowKey(entity: string, id: string): string {
  return `${entity}\u0000${id}`;
}

class MemoryCache {
  private readonly entries = new Map<string, string>();

  async match(request: Request | string): Promise<Response | undefined> {
    const body = this.entries.get(cacheKey(request));
    if (body === undefined) return undefined;
    return new Response(body, { headers: { 'content-type': 'application/json' } });
  }

  async put(request: Request | string, response: Response): Promise<void> {
    this.entries.set(cacheKey(request), await response.clone().text());
  }

  get size(): number {
    return this.entries.size;
  }
}

function cacheKey(request: Request | string): string {
  return typeof request === 'string' ? request : request.url;
}

type JsonWebKeySet = { keys: (JsonWebKey & { kid?: string; alg?: string; use?: string })[] };

const keyPairPromise = generateKeyPair();

async function generateKeyPair(): Promise<CryptoKeyPair> {
  return (await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify'],
  )) as CryptoKeyPair;
}

async function jwksFor(keyPair: CryptoKeyPair): Promise<JsonWebKeySet> {
  const jwk = (await crypto.subtle.exportKey('jwk', keyPair.publicKey)) as JsonWebKey;
  return { keys: [{ ...jwk, kid: 'test-kid', alg: 'RS256', use: 'sig' }] };
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function jsonToBase64Url(value: unknown): string {
  return toBase64Url(new TextEncoder().encode(JSON.stringify(value)));
}

interface TokenClaims {
  aud?: string | string[];
  exp?: number;
  iss?: string;
}

async function signToken(
  key: CryptoKey,
  claims: TokenClaims = {},
  header: Record<string, unknown> = { alg: 'RS256', kid: 'test-kid', typ: 'JWT' },
): Promise<string> {
  const encodedHeader = jsonToBase64Url(header);
  const encodedPayload = jsonToBase64Url({
    aud: AUD,
    iss: ISSUER,
    exp: Math.floor(Date.now() / 1000) + 3600,
    ...claims,
  });
  const signature = await crypto.subtle.sign(
    { name: 'RSASSA-PKCS1-v1_5' },
    key,
    new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`),
  );
  return `${encodedHeader}.${encodedPayload}.${toBase64Url(new Uint8Array(signature))}`;
}

let fetchCalls: string[] = [];
let cache: MemoryCache;

function installPlatform(jwks: JsonWebKeySet): void {
  fetchCalls = [];
  cache = new MemoryCache();
  Object.defineProperty(globalThis, 'caches', {
    value: { default: cache },
    configurable: true,
    writable: true,
  });
  globalThis.fetch = (async (input: Request | string | URL) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    fetchCalls.push(url);
    if (url !== JWKS_URL) throw new Error(`unexpected fetch: ${url}`);
    return new Response(JSON.stringify(jwks), {
      status: 200,
      headers: { 'content-type': 'application/json', 'cache-control': 'max-age=3600' },
    });
  }) as typeof fetch;
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
    const other = await generateKeyPair();
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

  it('chunks the lookup for 500 mutations under the 100-parameter D1 limit', async () => {
    const mutations = Array.from({ length: 500 }, (_, index) => mutation('tags', `tag-${index}`));

    const response = await postSync(db, { deviceId: 'dev_a', mutations }, token);
    const body = (await response.json()) as PushBody;

    expect(response.status).toBe(200);
    expect(body.applied).toHaveLength(500);
    expect(db.rows.size).toBe(500);

    const lookups = db.log.filter((statement) => statement.sql.startsWith(LOOKUP_PREFIX));
    expect(lookups).toHaveLength(500 / LOOKUP_PAIRS_PER_STATEMENT);
    for (const statement of db.log) {
      expect(statement.params.length).toBeLessThanOrEqual(D1_MAX_BOUND_PARAMS);
    }
    for (const statement of lookups) {
      expect(statement.params.length / 2).toBeLessThanOrEqual(LOOKUP_PAIRS_PER_STATEMENT);
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
