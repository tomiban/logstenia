import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { getDB } from '@/db/open';
import { type ISessionRepository } from '@/repositories';

type EngineModule = typeof import('./engine');
type OutboxModule = typeof import('./outbox');
type RepositoriesModule = typeof import('@/repositories');
type SyncTriggerTargets = import('./engine').SyncTriggerTargets;
type PendingOutboxEntry = import('./outbox').PendingOutboxEntry;

const STORES = ['sessions', 'progress', 'goals', 'settings', 'marks', 'tags', 'outbox'];
const BASE_URL = 'https://sync.test/api';
const NOW = '2026-10-20T18:00:00.000Z';
const T_OLD = '2026-10-20T11:00:00.000Z';
const T_BASE = '2026-10-20T12:00:00.000Z';
const T_NEW = '2026-10-20T13:00:00.000Z';

type SessionInput = Parameters<ISessionRepository['put']>[0];

interface ChangeBody {
  entity: string;
  id: string;
  rev: number;
  updatedAt: string;
  deletedAt: string | null;
  row?: unknown;
}

interface PageBody {
  rev: number;
  more: boolean;
  now: string;
  changes: ChangeBody[];
}

interface FetchCall {
  url: string;
  init: RequestInit | undefined;
}

let engine: EngineModule;
let outbox: OutboxModule;
let repositories: RepositoriesModule;

const realSetTimeout = globalThis.setTimeout.bind(globalThis);

/** Yields to a real macrotask so fake-indexeddb's setImmediate work can finish. */
function nextTask(): Promise<void> {
  return new Promise((resolve) => {
    realSetTimeout(resolve, 0);
  });
}

async function settle(turns = 20): Promise<void> {
  for (let turn = 0; turn < turns; turn += 1) {
    await nextTask();
  }
}

async function clearDatabase(): Promise<void> {
  const db = await getDB();
  for (const store of STORES) {
    await db.clear(store);
  }
}

function sessionInput(id: string, overrides: Partial<SessionInput> = {}): SessionInput {
  return {
    id,
    date: '2026-10-20',
    planId: 'fuerza',
    modelId: 'm1',
    durationSec: 600,
    completed: true,
    ...overrides,
  };
}

function sessionPayload(id: string): Record<string, unknown> {
  return {
    id,
    date: '2026-10-20',
    planId: 'fuerza',
    modelId: 'm1',
    durationSec: 600,
    completed: true,
  };
}

function liveChange(
  entity: string,
  id: string,
  rev: number,
  updatedAt: string,
  row: unknown = sessionPayload(id),
): ChangeBody {
  return { entity, id, rev, updatedAt, deletedAt: null, row };
}

function tombstoneChange(
  entity: string,
  id: string,
  rev: number,
  updatedAt: string,
  row: unknown = null,
): ChangeBody {
  return { entity, id, rev, updatedAt, deletedAt: updatedAt, row };
}

function page(rev: number, more: boolean, changes: ChangeBody[]): PageBody {
  return { rev, more, now: NOW, changes };
}

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    type: 'basic',
    json: async () => body,
  } as unknown as Response;
}

function stubFetch(handler: (url: string, init?: RequestInit) => Promise<Response> | Response) {
  const calls: FetchCall[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    calls.push({ url, init });
    return handler(url, init);
  });
  vi.stubGlobal('fetch', fetchMock);
  return calls;
}

function stubEmptySync() {
  return stubFetch((_url, init) =>
    init?.method === 'POST'
      ? jsonResponse({ rev: 1, applied: [], rejected: [] })
      : jsonResponse(page(1, false, [])),
  );
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  vi.resetModules();
  vi.stubEnv('VITE_SYNC_URL', BASE_URL);
  await clearDatabase();
  engine = await import('./engine');
  outbox = await import('./outbox');
  repositories = await import('@/repositories');
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('pull — paginated and crash safe (§5, §7)', () => {
  it('follows every page, persists the cursor per page and never skips or duplicates', async () => {
    const settings = repositories.createSettingsRepository();
    const cursorsSeen: unknown[] = [];
    const pages = [
      page(10, true, [
        liveChange('sessions', 'a', 10, T_BASE),
        liveChange('marks', 'm1', 10, T_BASE, {
          exercise: 'dominadas',
          unit: 'reps',
          value: 8,
          mesoInicio: '2026-10-01',
          date: '2026-10-20',
        }),
      ]),
      page(20, false, [liveChange('sessions', 'b', 20, T_BASE)]),
    ];

    const calls = stubFetch(async (url) => {
      const since = Number(new URL(url).searchParams.get('since'));
      const index = since === 0 ? 0 : 1;
      if (index === 1) cursorsSeen.push((await settings.get('sync.cursor'))?.value);
      return jsonResponse(pages[index]);
    });

    const result = await engine.run();

    expect(result).toEqual({ status: 'ok', pushed: 0, pulled: 3, rejected: 0 });
    expect(calls.map((call) => call.url)).toEqual([
      `${BASE_URL}/sync?since=0&limit=200`,
      `${BASE_URL}/sync?since=10&limit=200`,
    ]);
    expect(cursorsSeen).toEqual([10]);
    expect((await repositories.createSessionRepository().list()).map((row) => row.id).sort()).toEqual([
      'a',
      'b',
    ]);
    expect(await repositories.createMarkRepository().list()).toHaveLength(1);
    expect((await settings.get('sync.cursor'))?.value).toBe(20);
  });

  it('advances the cursor to the last change rev when the page reports a higher watermark', async () => {
    const sessions = repositories.createSessionRepository();
    const all = Array.from({ length: 250 }, (_, index) =>
      liveChange('sessions', `s${index + 1}`, index + 1, T_BASE),
    );
    const lastRev = all.length;

    const calls = stubFetch((url) => {
      const params = new URL(url).searchParams;
      const since = Number(params.get('since'));
      const limit = Number(params.get('limit'));
      const remaining = all.filter((change) => change.rev > since);
      return jsonResponse({
        rev: lastRev,
        more: remaining.length > limit,
        now: NOW,
        changes: remaining.slice(0, limit),
      });
    });

    const result = await engine.pull();

    expect(result).toEqual({ status: 'ok', pulled: 250, cursor: 250 });
    expect(calls.map((call) => call.url)).toEqual([
      `${BASE_URL}/sync?since=0&limit=200`,
      `${BASE_URL}/sync?since=200&limit=200`,
    ]);
    expect(await sessions.list()).toHaveLength(250);
  });

  it('records the server clock offset from the page timestamp (§7)', async () => {
    const serverNow = new Date(Date.now() - 7 * 60_000).toISOString();
    stubFetch(() => jsonResponse({ rev: 1, more: false, now: serverNow, changes: [] }));

    await engine.pull();

    const skew = engine.getSyncState().serverClockSkewMs;
    expect(skew).not.toBeNull();
    expect(skew ?? 0).toBeLessThan(-6.9 * 60_000);
    expect(skew ?? 0).toBeGreaterThan(-7.1 * 60_000);
  });

  it('re-applies a page idempotently when the cursor write was lost', async () => {
    const sessions = repositories.createSessionRepository();
    stubFetch(() => jsonResponse(page(10, false, [liveChange('sessions', 'a', 10, T_BASE)])));

    expect(await engine.pull()).toEqual({ status: 'ok', pulled: 1, cursor: 10 });
    expect(await engine.pull()).toEqual({ status: 'ok', pulled: 0, cursor: 10 });

    const rows = await sessions.list();
    expect(rows).toHaveLength(1);
    expect(rows[0].updatedAt).toBe(T_BASE);
  });

  it('inserts a tombstone-only change so an older live change cannot resurrect the row', async () => {
    const sessions = repositories.createSessionRepository();
    const pages = [
      page(1, false, [tombstoneChange('sessions', 'ghost', 1, T_NEW)]),
      page(2, false, [liveChange('sessions', 'ghost', 2, T_BASE)]),
    ];
    let call = 0;
    stubFetch(() => {
      const body = pages[Math.min(call, 1)];
      call += 1;
      return jsonResponse(body);
    });

    await engine.pull();
    expect(await sessions.get('ghost')).toBeUndefined();

    await engine.pull();
    expect(await sessions.get('ghost')).toBeUndefined();
    expect(await sessions.list()).toHaveLength(0);
  });

  it('keeps a newer local edit when an older tombstone arrives', async () => {
    const sessions = repositories.createSessionRepository();
    await sessions.put(sessionInput('a', { updatedAt: T_NEW }));
    stubFetch(() => jsonResponse(page(5, false, [tombstoneChange('sessions', 'a', 5, T_OLD)])));

    await engine.pull();

    expect(await sessions.get('a')).toMatchObject({ id: 'a' });
  });

  it('applies a newer tombstone and keeps the local payload out of every read', async () => {
    const sessions = repositories.createSessionRepository();
    await sessions.put(sessionInput('a', { updatedAt: T_OLD }));
    stubFetch(() => jsonResponse(page(5, false, [tombstoneChange('sessions', 'a', 5, T_NEW)])));

    await engine.pull();

    expect(await sessions.get('a')).toBeUndefined();
    expect(await sessions.list()).toHaveLength(0);
  });

  it('never pulls a local-only sync.* settings row', async () => {
    const settings = repositories.createSettingsRepository();
    await settings.put({ key: 'sync.deviceId', value: 'dev_local' });
    stubFetch(() =>
      jsonResponse(
        page(4, false, [
          liveChange('settings', 'sync.deviceId', 4, T_NEW, { key: 'sync.deviceId', value: 'dev_remote' }),
          liveChange('settings', 'theme', 4, T_NEW, { key: 'theme', value: 'dark' }),
        ]),
      ),
    );

    const result = await engine.pull();

    expect(result).toEqual({ status: 'ok', pulled: 1, cursor: 4 });
    expect((await settings.get('sync.deviceId'))?.value).toBe('dev_local');
    expect((await settings.get('theme'))?.value).toBe('dark');
  });
});

describe('state — sync status for Settings (§9)', () => {
  it('notifies subscribers every time a run finishes', async () => {
    const seen: boolean[] = [];
    const unsubscribe = engine.onSyncStateChange(() => {
      seen.push(engine.getSyncState().authRequired);
    });
    stubFetch(() => jsonResponse({ error: 'unauthorized' }, 401));

    await engine.run();
    unsubscribe();
    await engine.run();

    expect(seen).toEqual([true]);
  });

  it('exposes the timestamp of the last successful sync', async () => {
    stubEmptySync();
    expect(await engine.lastSyncAt()).toBeNull();

    await engine.run();

    const stamp = await engine.lastSyncAt();
    expect(stamp).not.toBeNull();
    expect(Number.isNaN(Date.parse(stamp ?? ''))).toBe(false);
  });
});

describe('onPulledRows (§9)', () => {
  it('names the entities a pull wrote so cached views can re-read them', async () => {
    const seen: string[][] = [];
    const unsubscribe = engine.onPulledRows((entities) => seen.push([...entities]));
    stubFetch(() =>
      jsonResponse(
        page(4, false, [
          liveChange('settings', 'theme', 4, T_NEW, { key: 'theme', value: 'dark' }),
          liveChange('sessions', 'a', 4, T_NEW),
        ]),
      ),
    );

    await engine.pull();
    unsubscribe();

    expect(seen).toEqual([['settings', 'sessions']]);
  });

  it('stays silent when the pull had nothing to apply', async () => {
    const seen: string[][] = [];
    const unsubscribe = engine.onPulledRows((entities) => seen.push([...entities]));
    stubFetch(() => jsonResponse(page(1, false, [])));

    await engine.pull();
    unsubscribe();

    expect(seen).toEqual([]);
  });
});

describe('flush — body budget (§5, §7)', () => {
  const entryOf = (seq: number, padding: number): PendingOutboxEntry => ({
    seq,
    entity: 'sessions',
    id: `s${seq}`,
    updatedAt: T_BASE,
    deletedAt: null,
    row: { id: `s${seq}`, padding: 'x'.repeat(padding) },
  });

  it('trims a batch to what fits the body cap instead of sending all of it', () => {
    const batch = engine.batchWithinBudget(
      [entryOf(1, 90_000), entryOf(2, 90_000), entryOf(3, 90_000)],
      200_000,
    );

    expect(batch.map((entry) => entry.seq)).toEqual([1, 2]);
  });

  it('still sends a single entry larger than the budget instead of stalling silently', () => {
    const batch = engine.batchWithinBudget([entryOf(1, 300_000)], 200_000);

    expect(batch.map((entry) => entry.seq)).toEqual([1]);
  });

  it('drains a backlog whose full batch would exceed the 256 KB body cap', async () => {
    const sessions = repositories.createSessionRepository();
    const sets = Array.from({ length: 30 }, (_, index) => ({
      exercise: 'dominadas',
      setIndex: index,
      value: '10',
      unit: 'reps' as const,
      bloqueOrden: 1,
      orden: index + 1,
    }));
    for (let index = 0; index < 101; index += 1) {
      await sessions.put(sessionInput(`s${index}`, { sets }));
    }

    const bodySizes: number[] = [];
    stubFetch((_url, init) => {
      if (init?.method !== 'POST') return jsonResponse(page(1, false, []));
      const size = new TextEncoder().encode(String(init.body)).length;
      bodySizes.push(size);
      if (size > 262_144) return jsonResponse({ error: 'payload_too_large' }, 413);
      return jsonResponse({ rev: 1, applied: [], rejected: [] });
    });

    for (let attempt = 0; attempt < 5 && (await outbox.pendingCount()) > 0; attempt += 1) {
      await engine.flush();
    }

    expect(await outbox.pendingCount()).toBe(0);
    expect(bodySizes.every((size) => size <= 262_144)).toBe(true);
  });
});

describe('flush — in-flight writes (§7)', () => {
  it('keeps a newer edit of the same row that lands while the push is in flight', async () => {
    const settings = repositories.createSettingsRepository();
    await settings.put({ key: 'theme', value: 'dark' });

    const sent: { mutations: { row: { value: string } }[] }[] = [];
    stubFetch(async (_url, init) => {
      if (init?.method !== 'POST') return jsonResponse(page(1, false, []));
      sent.push(JSON.parse(String(init.body)) as { mutations: { row: { value: string } }[] });
      await settings.put({ key: 'theme', value: 'light' });
      return jsonResponse({ rev: 3, applied: ['settings/theme'], rejected: [] });
    });

    await engine.flush();

    expect(sent[0]?.mutations[0]?.row.value).toBe('dark');
    expect((await settings.get('theme'))?.value).toBe('light');
    expect(await outbox.pendingCount()).toBe(1);
  });
});

describe('run — auth, backoff and single flight (§7)', () => {
  it('sends a manual redirect fetch and disables retry on 401, keeping the outbox', async () => {
    const sessions = repositories.createSessionRepository();
    await sessions.put(sessionInput('s1'));
    const calls = stubFetch(() => jsonResponse({ error: 'unauthorized' }, 401));

    const result = await engine.run();

    expect(result).toEqual({ status: 'auth_required', reason: 'unauthorized' });
    expect(engine.getSyncState().authRequired).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
    expect(await outbox.pendingCount()).toBe(1);
    expect(calls[0]?.init?.redirect).toBe('manual');

    await vi.advanceTimersByTimeAsync(120_000);
    expect(calls).toHaveLength(1);
  });

  it('maps an Access login redirect to auth_required without retrying', async () => {
    stubFetch(
      () =>
        ({
          ok: false,
          status: 0,
          type: 'opaqueredirect',
          json: async () => ({}),
        }) as unknown as Response,
    );

    const result = await engine.run();

    expect(result).toEqual({ status: 'auth_required', reason: 'redirect' });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('maps a non-JSON body to auth_required without retrying', async () => {
    stubFetch(
      () =>
        ({
          ok: true,
          status: 200,
          type: 'basic',
          json: async () => {
            throw new SyntaxError('Unexpected token <');
          },
        }) as unknown as Response,
    );

    const result = await engine.run();

    expect(result).toEqual({ status: 'auth_required', reason: 'non_json' });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('runs a single flight when triggers fire concurrently', async () => {
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const calls = stubFetch(async () => {
      await gate;
      return jsonResponse(page(3, false, []));
    });

    const first = engine.run();
    const second = engine.run();

    expect(second).toBe(first);
    await settle();
    expect(calls).toHaveLength(1);

    release?.();
    await expect(first).resolves.toEqual({ status: 'ok', pushed: 0, pulled: 0, rejected: 0 });
    expect(calls).toHaveLength(1);
  });

  it('backs off 2s → 60s on network errors, then resets after a success', async () => {
    const calls = stubFetch(() => {
      throw new TypeError('Failed to fetch');
    });

    const result = await engine.run();
    expect(result).toMatchObject({ status: 'retry_scheduled', attempt: 1, delayMs: 2_000 });
    expect(calls).toHaveLength(1);

    const schedule = [2_000, 4_000, 8_000, 16_000, 32_000, 60_000, 60_000];
    for (const [index, delay] of schedule.entries()) {
      const before = calls.length;
      await vi.advanceTimersByTimeAsync(delay - 1);
      await settle();
      expect(calls).toHaveLength(before);
      await vi.advanceTimersByTimeAsync(1);
      await settle();
      expect(calls).toHaveLength(before + 1);
      expect(engine.getSyncState().retryAttempt).toBe(index + 2);
    }

    stubEmptySync();
    await vi.advanceTimersByTimeAsync(60_000);
    await settle();

    expect(engine.getSyncState().retryAttempt).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('retries a 5xx and a 429 but not a 400', async () => {
    stubFetch(() => jsonResponse({ error: 'boom' }, 500));
    expect(await engine.run()).toMatchObject({ status: 'retry_scheduled', delayMs: 2_000 });

    stubFetch(() => jsonResponse({ error: 'slow down' }, 429));
    await vi.advanceTimersByTimeAsync(2_000);
    await settle();
    expect(engine.getSyncState().retryAttempt).toBe(2);

    stubFetch(() => jsonResponse({ error: 'bad request' }, 400));
    await vi.advanceTimersByTimeAsync(4_000);
    await settle();
    expect(engine.getSyncState().retryAttempt).toBe(2);
  });
});

describe('flush — bounded batch (§7)', () => {
  it('posts at most 100 pending entries ordered by seq', async () => {
    const sessions = repositories.createSessionRepository();
    for (let index = 0; index < 101; index += 1) {
      await sessions.put(sessionInput(`s${index}`));
    }
    const calls = stubFetch(() => jsonResponse({ rev: 1, applied: [], rejected: [] }));

    const result = await engine.flush();

    expect(result).toEqual({ status: 'ok', pushed: 100, rejected: 0 });
    const body = JSON.parse(String(calls[0]?.init?.body)) as { mutations: ChangeBody[] };
    expect(body.mutations).toHaveLength(100);
    expect(body.mutations[0]?.id).toBe('s0');
    expect(body.mutations[99]?.id).toBe('s99');
    expect(await outbox.pendingOutboxEntries(100)).toHaveLength(1);
  });
});

describe('base URL (§10)', () => {
  it('falls back to the relative /api base when VITE_SYNC_URL is unset', async () => {
    vi.stubEnv('VITE_SYNC_URL', '');
    const calls = stubFetch(() => jsonResponse(page(1, false, [])));

    await engine.pull();

    expect(calls[0]?.url).toBe('/api/sync?since=0&limit=200');
  });
});

describe('triggers (§7)', () => {
  it('syncs on start, on online, on visible and 3s after an outbox write', async () => {
    const calls = stubEmptySync();
    const online: Array<() => void> = [];
    const visible: Array<() => void> = [];
    const targets: SyncTriggerTargets = {
      onOnline: (listener) => online.push(listener),
      onVisible: (listener) => visible.push(listener),
    };

    const unregister = engine.registerSyncTriggers(targets);
    await settle();
    expect(calls).toHaveLength(1);

    await repositories.createSessionRepository().put(sessionInput('s1'));
    await vi.advanceTimersByTimeAsync(2_999);
    await settle();
    expect(calls).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    await settle();
    expect(calls).toHaveLength(3);

    online[0]?.();
    await settle();
    expect(calls).toHaveLength(4);

    visible[0]?.();
    await settle();
    expect(calls).toHaveLength(5);

    unregister();
    await repositories.createSessionRepository().put(sessionInput('s2'));
    await vi.advanceTimersByTimeAsync(10_000);
    await settle();
    expect(calls).toHaveLength(5);
  });
});
