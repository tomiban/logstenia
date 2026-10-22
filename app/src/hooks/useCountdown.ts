import { useEffect, useRef, useState } from 'react';

/**
 * Counts down to `target` (epoch ms). Returns remaining seconds and fires `onExpire` once when it reaches 0.
 * `onExpire` is kept up to date via ref, so callers can pass an inline function.
 */
export function useCountdown(target: number | null, onExpire: () => void): number {
  const [remaining, setRemaining] = useState(0);
  const cbRef = useRef(onExpire);
  cbRef.current = onExpire;

  useEffect(() => {
    if (target == null) {
      setRemaining(0);
      return;
    }
    let fired = false;
    const tick = () => {
      const r = Math.max(0, Math.round((target - Date.now()) / 1000));
      setRemaining(r);
      if (r <= 0 && !fired) {
        fired = true;
        cbRef.current();
      }
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [target]);

  return remaining;
}
