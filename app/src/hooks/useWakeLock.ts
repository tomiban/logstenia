import { useEffect, useRef, useState } from 'react';

/** Keeps the screen awake while `active` is true (best-effort, no-op if unsupported). */
export function useWakeLock(active = true): { supported: boolean } {
  const [supported] = useState(() => typeof navigator !== 'undefined' && 'wakeLock' in navigator);
  const lockRef = useRef<any>(null);

  useEffect(() => {
    if (!active || !supported) return;
    let cancelled = false;
    (async () => {
      try {
        const lock = await (navigator as any).wakeLock.request('screen');
        if (cancelled) {
          lock.release?.();
          return;
        }
        lockRef.current = lock;
      } catch {
        // ignore: not supported or not allowed
      }
    })();
    return () => {
      cancelled = true;
      lockRef.current?.release?.();
      lockRef.current = null;
    };
  }, [active, supported]);

  return { supported };
}
