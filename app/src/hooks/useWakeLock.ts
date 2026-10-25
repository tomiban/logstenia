import { useEffect, useRef, useState } from 'react';

/**
 * Keeps the screen awake while `active` is true.
 * `supported` says whether the browser has the API; `held` whether the lock is
 * actually held, so a denied request is visible instead of silently dropped.
 */
export function useWakeLock(active = true): { supported: boolean; held: boolean } {
  const [supported] = useState(() => typeof navigator !== 'undefined' && 'wakeLock' in navigator);
  const [held, setHeld] = useState(false);
  const lockRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (!active || !supported) return;
    let cancelled = false;
    (async () => {
      try {
        const lock = await navigator.wakeLock.request('screen');
        if (cancelled) {
          await lock.release();
          return;
        }
        lockRef.current = lock;
        setHeld(true);
      } catch {
        setHeld(false);
      }
    })();
    return () => {
      cancelled = true;
      const lock = lockRef.current;
      lockRef.current = null;
      setHeld(false);
      void lock?.release().catch(() => setHeld(false));
    };
  }, [active, supported]);

  return { supported, held };
}
