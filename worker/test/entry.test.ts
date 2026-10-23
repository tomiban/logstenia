import { describe, expect, it } from 'vitest';

/**
 * `wrangler.toml` declares `main = "src/index.ts"`, so the module has to expose a default
 * Worker entry. Every other worker test calls `app.request(...)` directly, which bypasses
 * the runtime and cannot see a missing entry: without it the deployed Worker and
 * `wrangler dev` never answer `/api/*` at all.
 */
describe('module entry (wrangler main)', () => {
  it('exposes a default export with a fetch handler', async () => {
    const entry = (await import('../src/index')) as { default?: { fetch?: unknown } };

    expect(typeof entry.default?.fetch).toBe('function');
  });

  it('answers an API request through the default handler, bypass included', async () => {
    const entry = (await import('../src/index')) as {
      default: { fetch: (request: Request, env: unknown) => Promise<Response> };
    };

    const response = await entry.default.fetch(
      new Request('http://localhost/api/health'),
      { DB: {}, CF_ACCESS_TEAM: 'team', CF_ACCESS_AUD: 'aud', SYNC_DEV_NO_AUTH: 'true' },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, devAuthBypass: true });
  });
});
