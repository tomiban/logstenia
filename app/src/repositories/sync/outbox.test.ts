import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import 'fake-indexeddb/auto';
import type { WriteTransaction } from '@/db';
import { getDB } from '@/db/open';
import {
  createSessionRepository,
  createSettingsRepository,
  createTagRepository,
  type ISessionRepository,
} from '@/repositories';
import { flush } from './engine';
import {
  deleteFlushedEntries,
  isLocalOnlySettingKey,
  onOutboxWrite,
  pendingCount,
  pendingOutboxEntries,
} from './outbox';
import type { SyncMutation } from './types';

const failures = vi.hoisted(() => ({ enqueue: false }));

vi.mock('./outbox', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./outbox')>();
  return {
    ...actual,
    enqueueOutbox: async (tx: WriteTransaction, mutation: SyncMutation) => {
      if (failures.enqueue) throw new Error('outbox unavailable');
      return actual.enqueueOutbox(tx, mutation);
    },
  };
});

const STORES = ['sessions', 'progress', 'goals', 'settings', 'marks', 'tags', 'outbox'];

type SessionInput = Parameters<ISessionRepository['put']>[0];

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

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    type: 'basic',
    json: async () => body,
  } as unknown as Response;
}

function stubResponse(body: unknown, status = 200) {
  const fetchMock = vi.fn(
    async (_input: RequestInfo | URL, _init?: RequestInit) => jsonResponse(body, status),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

beforeEach(async () => {
  failures.enqueue = false;
  vi.stubEnv('VITE_SYNC_URL', 'https://sync.test/api');
  await clearDatabase();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('repository writes enqueue their outbox entry (§7)', () => {
  it('writes the row and its outbox entry in the same transaction', async () => {
    const sessions = createSessionRepository();

    await sessions.put(sessionInput('s1'));

    expect(await sessions.get('s1')).toMatchObject({ id: 's1', date: '2026-10-20' });
    const pending = await pendingOutboxEntries(100);
    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({ entity: 'sessions', id: 's1' });
    expect(typeof pending[0].updatedAt).toBe('string');
    expect(pending[0].deletedAt).toBeNull();
    expect(pending[0].row).toMatchObject({ id: 's1', deletedAt: null });
  });

  it('stamps an added row and enqueues it', async () => {
    const tags = createTagRepository();

    await tags.add({ id: 't1', targetType: 'exercise', targetId: 'e1', tag: 'empuje' });

    const stored = await tags.get('t1');
    expect(typeof stored?.updatedAt).toBe('string');
    expect(stored?.deletedAt).toBeNull();
    expect(await pendingOutboxEntries(100)).toHaveLength(1);
  });

  it('writes and enqueues every bulkPut row', async () => {
    const sessions = createSessionRepository();

    await sessions.bulkPut([
      { ...sessionInput('s1'), updatedAt: '2026-10-20T10:00:00.000Z', deletedAt: null },
      { ...sessionInput('s2'), updatedAt: '2026-10-20T10:00:00.000Z', deletedAt: null },
    ]);

    expect(await sessions.list()).toHaveLength(2);
    expect(await pendingCount()).toBe(2);
  });

  it('rolls the row back when the outbox write fails', async () => {
    const sessions = createSessionRepository();
    failures.enqueue = true;

    await expect(sessions.put(sessionInput('doomed'))).rejects.toThrow('outbox unavailable');

    expect(await sessions.get('doomed')).toBeUndefined();
    expect(await pendingCount()).toBe(0);
  });

  it('notifies outbox write listeners so the engine can debounce a sync', async () => {
    const listener = vi.fn();
    const unsubscribe = onOutboxWrite(listener);
    const sessions = createSessionRepository();

    await sessions.put(sessionInput('s1'));
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    await sessions.put(sessionInput('s2'));
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe('coalescing by (entity, id) (§7)', () => {
  it('replaces the pending snapshot with the newest one instead of queueing twice', async () => {
    const sessions = createSessionRepository();

    await sessions.put(sessionInput('s1', { updatedAt: '2026-10-20T10:00:00.000Z' }));
    const [first] = await pendingOutboxEntries(100);
    await sessions.put(
      sessionInput('s1', { updatedAt: '2026-10-20T11:00:00.000Z', durationSec: 900 }),
    );

    const pending = await pendingOutboxEntries(100);
    expect(pending).toHaveLength(1);
    expect(pending[0].seq).toBe(first.seq);
    expect(pending[0].updatedAt).toBe('2026-10-20T11:00:00.000Z');
    expect(pending[0].row).toMatchObject({ durationSec: 900 });
  });

  it('keeps one entry per row ordered by seq and serves a bounded batch', async () => {
    const sessions = createSessionRepository();

    await sessions.put(sessionInput('s1'));
    await sessions.put(sessionInput('s2'));
    await sessions.put(sessionInput('s3'));

    const pending = await pendingOutboxEntries(100);
    expect(pending.map((entry) => entry.id)).toEqual(['s1', 's2', 's3']);
    expect(pending.map((entry) => entry.seq)).toEqual([...pending.map((entry) => entry.seq)].sort((a, b) => a - b));
    expect((await pendingOutboxEntries(2)).map((entry) => entry.id)).toEqual(['s1', 's2']);
  });

  it('enqueues a tombstone on softDelete and hides the row from every read', async () => {
    const sessions = createSessionRepository();
    await sessions.put(sessionInput('s1'));

    await sessions.softDelete('s1');

    expect(await sessions.get('s1')).toBeUndefined();
    expect(await sessions.list()).toHaveLength(0);
    const pending = await pendingOutboxEntries(100);
    expect(pending).toHaveLength(1);
    expect(typeof pending[0].deletedAt).toBe('string');
    expect(pending[0].updatedAt).toBe(pending[0].deletedAt);
  });
});

describe('settings rows and the local-only denylist (§1, §2)', () => {
  it('stamps a settings row with updatedAt and enqueues it by key', async () => {
    const settings = createSettingsRepository();

    await settings.put({ key: 'theme', value: 'dark' });

    const stored = await settings.get('theme');
    expect(stored?.value).toBe('dark');
    expect(typeof stored?.updatedAt).toBe('string');
    expect(stored?.deletedAt).toBeNull();

    const pending = await pendingOutboxEntries(100);
    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({ entity: 'settings', id: 'theme' });
    expect(pending[0].row).toMatchObject({ key: 'theme', value: 'dark', deletedAt: null });
  });

  it('classifies sync.* keys as local-only and never enqueues them', async () => {
    const settings = createSettingsRepository();

    expect(isLocalOnlySettingKey('sync.cursor')).toBe(true);
    expect(isLocalOnlySettingKey('sync.lastConflict')).toBe(true);
    expect(isLocalOnlySettingKey('borrador:m1')).toBe(true);
    expect(isLocalOnlySettingKey('theme')).toBe(false);

    await settings.put({ key: 'sync.cursor', value: 42 });

    expect((await settings.get('sync.cursor'))?.value).toBe(42);
    expect(await pendingCount()).toBe(0);
  });

  it('hard-deletes a local-only settings row without enqueueing it', async () => {
    const settings = createSettingsRepository();
    await settings.put({ key: 'borrador:m1', value: { step: 2 } });

    await settings.delete('borrador:m1');

    expect(await settings.get('borrador:m1')).toBeUndefined();
    expect(await settings.list()).toHaveLength(0);
    expect(await pendingCount()).toBe(0);
  });
});

describe('flush (§7)', () => {
  it('deletes the flushed entries after a successful push', async () => {
    const sessions = createSessionRepository();
    await sessions.put(sessionInput('s1'));
    await sessions.put(sessionInput('s2'));
    const fetchMock = stubResponse({ rev: 7, applied: ['sessions/s1', 'sessions/s2'], rejected: [] });

    const result = await flush();

    expect(result).toEqual({ status: 'ok', pushed: 2, rejected: 0 });
    expect(await pendingCount()).toBe(0);

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as {
      deviceId: string;
      mutations: SyncMutation[];
    };
    expect(body.deviceId).toMatch(/^dev_/);
    expect(body.mutations.map((mutation) => mutation.id)).toEqual(['s1', 's2']);
    expect(fetchMock.mock.calls[0]?.[1]?.redirect).toBe('manual');
  });

  it('keeps every pending entry when the push fails', async () => {
    const sessions = createSessionRepository();
    await sessions.put(sessionInput('s1'));
    await sessions.put(sessionInput('s2'));
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({}, 503)));

    const result = await flush();

    expect(result).toMatchObject({ status: 'retryable' });
    expect(await pendingCount()).toBe(2);

    const unreachable = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    vi.stubGlobal('fetch', unreachable);
    expect(await flush()).toMatchObject({ status: 'retryable' });
    expect(await pendingCount()).toBe(2);
  });

  it('drops rejected entries and records the conflict note', async () => {
    const sessions = createSessionRepository();
    const settings = createSettingsRepository();
    await settings.put({ key: 'theme', value: 'dark' });
    await sessions.put(sessionInput('s1'));
    stubResponse({
      rev: 9,
      applied: ['sessions/s1'],
      rejected: [{ ref: 'settings/theme', reason: 'stale_server_newer' }],
    });

    const result = await flush();

    expect(result).toEqual({ status: 'ok', pushed: 2, rejected: 1 });
    expect(await pendingCount()).toBe(0);

    const conflict = await settings.get('sync.lastConflict');
    expect(conflict?.value).toMatchObject({ refs: ['settings/theme'] });
    expect(await pendingCount()).toBe(0);
  });
});

describe('deleteFlushedEntries (§7)', () => {
  it('drops the accepted snapshot when nothing changed during the push', async () => {
    const settings = createSettingsRepository();
    await settings.put({ key: 'theme', value: 'dark' });
    const [sent] = await pendingOutboxEntries(10);

    await deleteFlushedEntries([sent!]);

    expect(await pendingCount()).toBe(0);
  });

  it('keeps the newer edit that coalesced into the same seq while the push was in flight', async () => {
    const settings = createSettingsRepository();
    await settings.put({ key: 'theme', value: 'dark' });
    const [sent] = await pendingOutboxEntries(10);

    await settings.put({ key: 'theme', value: 'light' });
    await deleteFlushedEntries([sent!]);

    const pending = await pendingOutboxEntries(10);
    expect(pending.map((entry) => (entry.row as { value: string }).value)).toEqual(['light']);
  });
});
