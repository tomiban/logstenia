import { useEffect, useState } from 'react';
import { getSyncState, lastSyncAt, onSyncStateChange, pendingCount, run } from '@/repositories';
import { describeSync, deviceLabel, type SyncStatusView } from './syncStatus';

interface Snapshot {
  lastSyncAt: string | null;
  pendingCount: number;
  authRequired: boolean;
  clockSkewMs: number | null;
}

const EMPTY_SNAPSHOT: Snapshot = {
  lastSyncAt: null,
  pendingCount: 0,
  authRequired: false,
  clockSkewMs: null,
};

async function readSnapshot(): Promise<Snapshot> {
  const state = getSyncState();
  return {
    lastSyncAt: await lastSyncAt(),
    pendingCount: await pendingCount(),
    authRequired: state.authRequired,
    clockSkewMs: state.serverClockSkewMs,
  };
}

function currentDevice(): string {
  return typeof navigator === 'undefined' ? 'este dispositivo' : deviceLabel(navigator.userAgent);
}

/**
 * Sync state for the Settings popover (§9): the status line, the session line, the clock
 * warning and the manual trigger, redrawn after every engine run.
 */
export function useSyncStatus(): SyncStatusView & { syncing: boolean; syncNow: () => void } {
  const [snapshot, setSnapshot] = useState<Snapshot>(EMPTY_SNAPSHOT);
  const [syncing, setSyncing] = useState(false);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let cancelled = false;

    const refresh = () => {
      // A failed local read keeps the last snapshot on screen instead of breaking the popover.
      void readSnapshot().then(
        (next) => {
          if (cancelled) return;
          setSnapshot(next);
          setNow(new Date());
        },
        () => undefined,
      );
    };

    refresh();
    const unsubscribe = onSyncStateChange(refresh);

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const syncNow = () => {
    setSyncing(true);
    void run().finally(() => {
      setSyncing(false);
    });
  };

  return { ...describeSync({ ...snapshot, device: currentDevice(), now }), syncing, syncNow };
}
