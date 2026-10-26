/**
 * Error rendering for `/api/sync` (`odd/tasks/sync-layers.md` S5, L4).
 *
 * A Worker that lets a server fault escape unanswered returns the platform's HTML 500, which the
 * client cannot parse: it swallows the failure and retries forever. `app.onError` is therefore
 * verified against a real database with `meta` dropped, so the error is a genuine SQLite failure
 * and not a stub, and the assertion is about the response the client would actually receive.
 */
import { HTTPException } from 'hono/http-exception';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installAccessPlatform, jwksFor } from './helpers/access';
import { applySchema, SqliteD1 } from './helpers/sqliteD1';
import { envFor, keyPairPromise, migrations, tokenFor } from './helpers/syncApi';

const OWNER = 'ana@ejemplo.com';

/*
 * Every transport rule stays in the router (S4), so the only way to reach `onError` with a domain
 * `HTTPException` is a failure raised where the service meets the database. This hook injects one
 * there; with no failure queued the real statement runs, which is what the first case needs.
 */
const injected = vi.hoisted(() => ({ failure: null as Error | null }));

vi.mock('../src/sync/queries', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/sync/queries')>();
  return {
    ...actual,
    readPullPage: async (...args: Parameters<typeof actual.readPullPage>) => {
      if (injected.failure) throw injected.failure;
      return actual.readPullPage(...args);
    },
  };
});

const { app } = await import('../src/index');

async function getSync(db: SqliteD1): Promise<Response> {
  return app.request(
    '/api/sync',
    { method: 'GET', headers: { 'cf-access-jwt-assertion': await tokenFor(OWNER) } },
    envFor(db),
  );
}

describe('sync error rendering', () => {
  let db: SqliteD1;

  beforeEach(async () => {
    injected.failure = null;
    installAccessPlatform(await jwksFor(await keyPairPromise));
    db = new SqliteD1();
    applySchema(db, migrations());
  });

  it('renders a database failure as a JSON 500 instead of the platform HTML', async () => {
    db.exec('DROP TABLE meta');

    const response = await getSync(db);

    expect(response.status).toBe(500);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(await response.json()).toEqual({ error: 'internal_error' });
  });

  it('renders an HTTPException raised by the service with its own status and a JSON body', async () => {
    injected.failure = new HTTPException(409, { message: 'conflict' });

    const response = await getSync(db);

    expect(response.status).toBe(409);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(await response.json()).toEqual({ message: 'conflict' });
  });

  it('preserves the custom response an HTTPException carries instead of rendering a message', async () => {
    injected.failure = new HTTPException(503, {
      res: new Response('custom-payload', { status: 503 }),
    });

    const response = await getSync(db);

    expect(response.status).toBe(503);
    expect(await response.text()).toBe('custom-payload');
  });
});
