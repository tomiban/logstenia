import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { authenticate, isDevAuthBypass, type AccessEnv, type Identity } from './access';
import { parsePushBody } from './sync/schema';
import { pullChanges, pushMutations } from './sync/service';

export interface Env extends AccessEnv {
  DB: D1Database;
}

const MAX_BODY_BYTES = 256 * 1024;
const MAX_MUTATIONS = 500;
const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 200;

/** Routes served without an Access session; every other `/api/*` path requires one. */
const PUBLIC_PATHS = new Set(['/api/health']);

export const app = new Hono<{ Bindings: Env; Variables: { identity: Identity } }>();

/*
 * The platform answers an uncaught error with HTML, which a client that only speaks JSON cannot
 * interpret: it treats the failure as transient and retries forever. Rendering JSON here keeps
 * every response parseable, and a domain `HTTPException` keeps the status it asked for. An
 * exception built around its own `Response` is returned as-is, so a custom payload survives
 * instead of being flattened into `{ message }`.
 */
app.onError((error, c) => {
  if (error instanceof HTTPException) {
    return error.res ? error.getResponse() : c.json({ message: error.message }, error.status);
  }
  return c.json({ error: 'internal_error' }, 500);
});

app.get('/api/health', (c) =>
  isDevAuthBypass(c.req.raw, c.env) ? c.json({ ok: true, devAuthBypass: true }) : c.json({ ok: true }),
);

/*
 * Deny by default: every `/api/*` route needs a verified identity unless it is listed as
 * public. Mounting the middleware on the exact `/api/sync` path would leave the next route
 * unauthenticated, which is the failure this shape prevents.
 */
app.use('/api/*', async (c, next) => {
  if (PUBLIC_PATHS.has(c.req.path)) return next();

  const result = await authenticate(c.req.raw, c.env);
  if (!result.ok) {
    return c.json({ error: 'unauthorized' }, 401);
  }

  c.set('identity', result.identity);
  await next();
});

app.get('/api/sync', async (c) => {
  const identity = c.get('identity');
  const since = parseInteger(c.req.query('since'), 0);
  const limit = parseInteger(c.req.query('limit'), DEFAULT_LIMIT);
  if (since === null) return c.json({ error: 'invalid_since' }, 400);
  if (limit === null || limit < 1 || limit > MAX_LIMIT) return c.json({ error: 'invalid_limit' }, 400);

  const page = await pullChanges(c.env.DB, identity.email, since, limit);
  return c.json({
    rev: page.rev,
    more: page.more,
    now: new Date().toISOString(),
    user: identity.email,
    changes: page.changes,
  });
});

app.post('/api/sync', async (c) => {
  const identity = c.get('identity');

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

  const push = parsePushBody(parsed);
  if (!push.ok) return c.json({ error: push.error }, 400);
  const body = push.body;
  if (body.mutations.length > MAX_MUTATIONS) return c.json({ error: 'too_many_mutations' }, 400);

  const result = await pushMutations(c.env.DB, identity.email, body.mutations);
  return c.json({ rev: result.rev, applied: result.applied, rejected: result.rejected });
});

function parseInteger(raw: string | undefined, fallback: number): number | null {
  if (raw === undefined || raw === '') return fallback;
  if (!/^\d+$/.test(raw)) return null;
  return Number(raw);
}

/**
 * Module Worker entry for `wrangler.toml`'s `main`. Without it the runtime never dispatches
 * to Hono: `wrangler dev` and the deployed Worker hang on every `/api/*` request while
 * static assets keep working, and the unit tests cannot notice because they call
 * `app.request(...)` directly.
 */
export default { fetch: app.fetch };
