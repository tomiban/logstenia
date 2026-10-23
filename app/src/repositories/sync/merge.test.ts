import { describe, expect, it } from 'vitest';
import { applyMutation, applyPull } from './merge';
import type { PullChange, SyncRowMeta } from './types';

/** Timestamps used by the fixtures, oldest first. */
const T_OLD = '2026-10-20T17:55:00.000Z';
const T_BASE = '2026-10-20T18:00:00.000Z';
const T_NEW = '2026-10-20T18:05:00.000Z';

type SetPayload = { exercise: string; setIndex: number; value: string };

type SessionPayload = {
  date: string;
  planId: string;
  sets: SetPayload[];
};

/** A stored `sessions` row: append-only entity with its sets embedded. */
interface StoredSession extends SyncRowMeta {
  id: string;
  date: string;
  planId: string;
  sets: SetPayload[];
}

function liveSession(updatedAt: string, id = 'session-a'): StoredSession {
  return {
    id,
    date: '2026-10-20',
    planId: 'fuerza',
    sets: [{ exercise: 'dominadas', setIndex: 1, value: '8' }],
    updatedAt,
    deletedAt: null,
  };
}

/** A live change as `GET /sync` returns it: identity in the envelope, payload apart. */
function liveChange(
  updatedAt: string,
  row: SessionPayload = liveSession(updatedAt),
): PullChange<SessionPayload> {
  return { updatedAt, deletedAt: null, row };
}

/** A tombstone coming from the server; `row` may be null or absent. */
function tombstone(
  updatedAt: string,
  row?: SessionPayload | null,
): PullChange<SessionPayload> {
  return row === undefined
    ? { updatedAt, deletedAt: updatedAt }
    : { updatedAt, deletedAt: updatedAt, row };
}

describe('applyPull — last write wins on updatedAt (§6)', () => {
  it('updates when the incoming row is newer than the local row', () => {
    const local = liveSession(T_BASE);
    const incoming = liveChange(T_NEW, {
      date: '2026-10-20',
      planId: 'fuerza',
      sets: [{ exercise: 'fondos', setIndex: 1, value: '12' }],
    });

    expect(applyPull(local, incoming)).toBe('update');
  });

  it('skips when the incoming row is older than the local row', () => {
    const local = liveSession(T_NEW);

    expect(applyPull(local, liveChange(T_BASE))).toBe('skip');
  });

  it('lets the local (client) row win on a timestamp tie and stays idempotent', () => {
    const local = liveSession(T_BASE);
    const conflicting = liveChange(T_BASE, {
      date: '2026-10-20',
      planId: 'fuerza',
      sets: [{ exercise: 'fondos', setIndex: 1, value: '12' }],
    });

    // Tie rule (design-plans §5 `>=`, §6 strict `>`): the server already accepted the
    // pushing client on a tie, so the pull keeps the local row instead of rewriting it.
    expect(applyPull(local, conflicting)).toBe('skip');
    // Re-applying an already-absorbed page must not touch the row again (crash-safe pull).
    expect(applyPull(local, liveChange(T_BASE, liveSession(T_BASE)))).toBe('skip');
  });
});

describe('applyPull — tombstones (§6)', () => {
  it('marks a live local row as deleted when the incoming tombstone is newer', () => {
    const local = liveSession(T_BASE);

    expect(applyPull(local, tombstone(T_NEW, local))).toBe('update');
    expect(applyPull(local, tombstone(T_NEW))).toBe('update');
  });

  it('does not let an older tombstone clobber a newer local live edit', () => {
    // The LWW compare runs first: a deletedAt shortcut would resurrect the delete here.
    const local = liveSession(T_NEW);

    expect(applyPull(local, tombstone(T_OLD))).toBe('skip');
    expect(applyPull(local, tombstone(T_OLD, liveSession(T_OLD)))).toBe('skip');
  });

  it('does not re-apply a tombstone the local row already carries', () => {
    // A stored tombstone keeps the timestamp of the delete, so replaying the same page
    // hits a tie and an older page loses: both leave the row alone (§7 crash-safe pull).
    const tombstoned: StoredSession = { ...liveSession(T_NEW), deletedAt: T_NEW };

    expect(applyPull(tombstoned, tombstone(T_NEW))).toBe('skip');
    expect(applyPull(tombstoned, tombstone(T_OLD))).toBe('skip');
  });
});

describe('applyPull — rows unknown locally (§6)', () => {
  it('inserts a live row that does not exist locally', () => {
    expect(applyPull(null, liveChange(T_NEW))).toBe('insert');
    expect(applyPull(undefined, liveChange(T_NEW))).toBe('insert');
  });

  it('inserts a tombstone-only change that carries no payload', () => {
    expect(applyPull(null, tombstone(T_NEW))).toBe('insert');
    expect(applyPull(undefined, tombstone(T_NEW, null))).toBe('insert');
  });
});

describe('applyPull — append-only union for embedded-set rows (§1)', () => {
  it('inserts a session recorded on the other device, sets and all', () => {
    // The engine looks the local row up by the incoming id, so a session that exists only
    // on the server arrives with no local row and is added to the union.
    const otherDevice = liveChange(T_NEW, liveSession(T_NEW, 'session-laptop'));

    expect(applyPull(null, otherDevice)).toBe('insert');
  });

  it('treats a stored session as one atomic row: same snapshot skips, a newer one replaces it', () => {
    const local = liveSession(T_BASE, 'session-laptop');

    expect(applyPull(local, liveChange(T_BASE, liveSession(T_BASE, 'session-laptop')))).toBe(
      'skip',
    );
    // Embedded sets are never merged per set: the whole session row is the unit.
    expect(
      applyPull(
        local,
        liveChange(T_NEW, {
          ...liveSession(T_NEW, 'session-laptop'),
          sets: [
            { exercise: 'dominadas', setIndex: 1, value: '8' },
            { exercise: 'dominadas', setIndex: 2, value: '6' },
          ],
        }),
      ),
    ).toBe('update');
  });
});

describe('applyMutation — the local write always happens (§6)', () => {
  it('writes the local row even when the outgoing mutation is older', () => {
    expect(applyMutation(liveSession(T_NEW), liveSession(T_OLD))).toBe('write');
  });

  it('writes when there is no local row yet', () => {
    expect(applyMutation(null, liveSession(T_NEW))).toBe('write');
    expect(applyMutation(undefined, liveSession(T_NEW))).toBe('write');
  });

  it('writes on a timestamp tie, so the client wins locally', () => {
    expect(applyMutation(liveSession(T_BASE), liveSession(T_BASE))).toBe('write');
  });
});
