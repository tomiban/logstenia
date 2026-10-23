/**
 * Client sync engine (`design-plans/backend-sync.md` §7).
 *
 * `run()` is flush-then-pull behind a single-flight guard: the local Dexie copy stays the
 * source of truth, the server is a shared mirror. Network errors and 5xx schedule the next
 * attempt with exponential backoff instead of blocking a caller; an expired Access session
 * (login redirect, 401 or an HTML page) stops retrying and leaves the outbox intact.
 */
import { ENTITY_NAMES, withWrite, type EntityName } from '@/db';
import { createSettingsRepository } from '../factory';
import { resolvePullRow } from './merge';
import {
  deleteOutboxEntries,
  isLocalOnlySettingKey,
  onOutboxWrite,
  pendingOutboxEntries,
} from './outbox';
import {
  syncKeyField,
  type AuthRequiredReason,
  type PullPage,
  type PulledChange,
  type SyncMutation,
  type SyncPushResult,
  type SyncRowMeta,
} from './types';

const FLUSH_BATCH_SIZE = 100;
const PULL_PAGE_SIZE = 200;
const RETRY_BASE_MS = 2_000;
const RETRY_MAX_MS = 60_000;
const OUTBOX_DEBOUNCE_MS = 3_000;
const CURSOR_KEY = 'sync.cursor';
const DEVICE_ID_KEY = 'sync.deviceId';
const LAST_SYNC_KEY = 'sync.lastSync';
const LAST_CONFLICT_KEY = 'sync.lastConflict';

export type SyncStepFailure =
  | { status: 'auth_required'; reason: AuthRequiredReason }
  | { status: 'retryable'; message: string }
  | { status: 'failed'; message: string };

export type FlushResult =
  | { status: 'ok'; pushed: number; rejected: number }
  | { status: 'empty' }
  | SyncStepFailure;

export type PullResult =
  | { status: 'ok'; pulled: number; cursor: number }
  | SyncStepFailure;

export type SyncRunResult =
  | { status: 'ok'; pushed: number; pulled: number; rejected: number }
  | { status: 'auth_required'; reason: AuthRequiredReason }
  | { status: 'retry_scheduled'; attempt: number; delayMs: number; message: string }
  | { status: 'failed'; message: string };

export interface SyncState {
  authRequired: boolean;
  retryAttempt: number;
  /** Server clock minus local clock from the last pulled page, or `null` before any pull. */
  serverClockSkewMs: number | null;
}

/** Event sources the engine subscribes to; injectable so triggers are testable. */
export interface SyncTriggerTargets {
  onOnline(listener: () => void): void;
  onVisible(listener: () => void): void;
}

type Step<T> = { ok: true; value: T } | { ok: false; failure: SyncStepFailure };

let inFlight: Promise<SyncRunResult> | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let retryAttempt = 0;
let authRequired = false;
let serverClockSkewMs: number | null = null;

function settings() {
  return createSettingsRepository();
}

function apiBase(): string {
  const configured: string | undefined = import.meta.env.VITE_SYNC_URL;
  const base = typeof configured === 'string' && configured.trim() !== '' ? configured.trim() : '/api';
  return base.replace(/\/+$/, '');
}

/** Push up to one bounded batch of pending entries, then drop the accepted ones. */
export async function flush(): Promise<FlushResult> {
  const entries = await pendingOutboxEntries(FLUSH_BATCH_SIZE);
  if (entries.length === 0) return { status: 'empty' };

  const deviceId = await deviceIdValue();
  const payload = await requestJson('sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      deviceId,
      mutations: entries.map(toMutation),
    }),
  });
  if (!payload.ok) return payload.failure;
  if (!isPushResult(payload.value)) return { status: 'failed', message: 'invalid push response' };

  await deleteOutboxEntries(entries.map((entry) => entry.seq));

  const rejectedRefs = payload.value.rejected
    .map((rejection) => rejection.ref)
    .filter((ref) => typeof ref === 'string');
  if (rejectedRefs.length > 0) await recordConflict(rejectedRefs);

  return { status: 'ok', pushed: entries.length, rejected: rejectedRefs.length };
}

/** Apply every page the server has after the local cursor, persisting it page by page. */
export async function pull(): Promise<PullResult> {
  let cursor = await readCursor();
  let pulled = 0;

  for (;;) {
    const response = await requestJson(`sync?since=${cursor}&limit=${PULL_PAGE_SIZE}`);
    if (!response.ok) return response.failure;
    if (!isPullPage(response.value)) {
      return { status: 'failed', message: 'invalid pull response' };
    }

    const { changes, more } = response.value;
    pulled += await applyChanges(changes);
    recordServerClock(response.value.now);

    // §5: the next `since` is the last received change rev, so a page watermark pointing
    // past the rows it returned cannot skip them.
    const lastChangeRev = changes.at(-1)?.rev;
    const nextCursor =
      typeof lastChangeRev === 'number' && lastChangeRev > cursor ? lastChangeRev : cursor;
    await writeCursor(nextCursor);

    if (!more || nextCursor <= cursor) return { status: 'ok', pulled, cursor: nextCursor };
    cursor = nextCursor;
  }
}

/** Flush then pull, single flight, with backoff on retryable failures. */
export function run(): Promise<SyncRunResult> {
  if (inFlight) return inFlight;

  const attempt = runOnce()
    .catch((error: unknown): SyncRunResult => ({ status: 'failed', message: messageOf(error) }))
    .finally(() => {
      inFlight = null;
    });

  inFlight = attempt;
  return attempt;
}

export function getSyncState(): SyncState {
  return { authRequired, retryAttempt, serverClockSkewMs };
}

/**
 * Wires every §7 trigger: app start, `online`, a visible tab, and a 3 s debounce after any
 * outbox write. Returns the disposer that detaches them.
 */
export function registerSyncTriggers(
  targets: SyncTriggerTargets = browserTriggers(),
): () => void {
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  const scheduleDebouncedRun = (): void => {
    if (debounceTimer !== null) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      void run();
    }, OUTBOX_DEBOUNCE_MS);
  };

  const unsubscribeOutbox = onOutboxWrite(scheduleDebouncedRun);
  targets.onOnline(() => void run());
  targets.onVisible(() => void run());
  void run();

  return () => {
    unsubscribeOutbox();
    if (debounceTimer !== null) clearTimeout(debounceTimer);
    debounceTimer = null;
  };
}

async function runOnce(): Promise<SyncRunResult> {
  const flushed = await flush();
  if (flushed.status !== 'ok' && flushed.status !== 'empty') return handleFailure(flushed);

  const pulled = await pull();
  if (pulled.status !== 'ok') return handleFailure(pulled);

  cancelRetry();
  retryAttempt = 0;
  authRequired = false;
  await settings().put({ key: LAST_SYNC_KEY, value: new Date().toISOString() });

  return {
    status: 'ok',
    pushed: flushed.status === 'ok' ? flushed.pushed : 0,
    pulled: pulled.pulled,
    rejected: flushed.status === 'ok' ? flushed.rejected : 0,
  };
}

function handleFailure(failure: SyncStepFailure): SyncRunResult {
  if (failure.status === 'auth_required') {
    authRequired = true;
    cancelRetry();
    return { status: 'auth_required', reason: failure.reason };
  }

  if (failure.status === 'retryable') {
    const delayMs = scheduleRetry();
    return { status: 'retry_scheduled', attempt: retryAttempt, delayMs, message: failure.message };
  }

  cancelRetry();
  return { status: 'failed', message: failure.message };
}

function scheduleRetry(): number {
  retryAttempt += 1;
  const delayMs = Math.min(RETRY_BASE_MS * 2 ** (retryAttempt - 1), RETRY_MAX_MS);

  cancelRetry();
  retryTimer = setTimeout(() => {
    retryTimer = null;
    void run();
  }, delayMs);

  return delayMs;
}

function cancelRetry(): void {
  if (retryTimer !== null) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
}

async function applyChanges(changes: readonly PulledChange[]): Promise<number> {
  const grouped = new Map<EntityName, PulledChange[]>();

  for (const change of changes) {
    const entity = entityName(change.entity);
    if (!entity) continue;
    if (entity === 'settings' && isLocalOnlySettingKey(change.id)) continue;
    const list = grouped.get(entity) ?? [];
    list.push(change);
    grouped.set(entity, list);
  }

  let applied = 0;
  for (const [entity, list] of grouped) {
    applied += await withWrite([entity], async (tx) => {
      const store = tx.objectStore(entity);
      const keyField = syncKeyField(entity);
      let count = 0;

      for (const change of list) {
        const localRow = (await store.get(change.id)) as SyncRowMeta | undefined;
        const row = resolvePullRow(localRow ?? null, change, keyField);
        if (!row) continue;
        await store.put(row);
        count += 1;
      }

      return count;
    });
  }

  return applied;
}

async function requestJson(path: string, init?: RequestInit): Promise<Step<unknown>> {
  let response: Response;
  try {
    response = await fetch(`${apiBase()}/${path}`, { ...init, redirect: 'manual' });
  } catch (error) {
    return failed({ status: 'retryable', message: messageOf(error) });
  }

  if (response.type === 'opaqueredirect' || response.status === 0) {
    return failed({ status: 'auth_required', reason: 'redirect' });
  }
  if (response.status === 401 || response.status === 403) {
    return failed({ status: 'auth_required', reason: 'unauthorized' });
  }
  if (response.status === 429 || response.status >= 500) {
    return failed({ status: 'retryable', message: `HTTP ${response.status}` });
  }
  if (!response.ok) {
    return failed({ status: 'failed', message: `HTTP ${response.status}` });
  }

  try {
    return { ok: true, value: await response.json() };
  } catch {
    return failed({ status: 'auth_required', reason: 'non_json' });
  }
}

function failed<T>(failure: SyncStepFailure): Step<T> {
  return { ok: false, failure };
}

function toMutation(entry: SyncMutation & { seq: number }): SyncMutation {
  return {
    entity: entry.entity,
    id: entry.id,
    updatedAt: entry.updatedAt,
    deletedAt: entry.deletedAt,
    row: entry.row,
  };
}

function entityName(value: string): EntityName | null {
  return (ENTITY_NAMES as readonly string[]).includes(value) ? (value as EntityName) : null;
}

function isPushResult(value: unknown): value is SyncPushResult {
  if (!isRecord(value)) return false;
  return typeof value.rev === 'number' && Array.isArray(value.applied) && Array.isArray(value.rejected);
}

function isPullPage(value: unknown): value is PullPage {
  if (!isRecord(value)) return false;
  return (
    typeof value.rev === 'number' &&
    typeof value.more === 'boolean' &&
    Array.isArray(value.changes) &&
    value.changes.every(isPulledChange)
  );
}

function isPulledChange(value: unknown): value is PulledChange {
  if (!isRecord(value)) return false;
  return (
    typeof value.entity === 'string' &&
    typeof value.id === 'string' &&
    typeof value.updatedAt === 'string' &&
    typeof value.rev === 'number'
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Keeps the last server-vs-local offset so Settings can warn past two minutes (§7). */
function recordServerClock(now: unknown): void {
  if (typeof now !== 'string') return;
  const serverTime = Date.parse(now);
  if (Number.isNaN(serverTime)) return;
  serverClockSkewMs = serverTime - Date.now();
}

async function readCursor(): Promise<number> {
  const row = await settings().get(CURSOR_KEY);
  const value: unknown = row?.value;
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

async function writeCursor(rev: number): Promise<void> {
  await settings().put({ key: CURSOR_KEY, value: rev });
}

async function deviceIdValue(): Promise<string> {
  const row = await settings().get(DEVICE_ID_KEY);
  const value: unknown = row?.value;
  if (typeof value === 'string' && value.length > 0) return value;

  const deviceId = `dev_${crypto.randomUUID()}`;
  await settings().put({ key: DEVICE_ID_KEY, value: deviceId });
  return deviceId;
}

async function recordConflict(refs: readonly string[]): Promise<void> {
  await settings().put({
    key: LAST_CONFLICT_KEY,
    value: { at: new Date().toISOString(), refs: [...refs] },
  });
}

function browserTriggers(): SyncTriggerTargets {
  return {
    onOnline(listener) {
      if (typeof window === 'undefined') return;
      window.addEventListener('online', listener);
    },
    onVisible(listener) {
      if (typeof document === 'undefined') return;
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') listener();
      });
    },
  };
}
