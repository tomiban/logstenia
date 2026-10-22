import { useEffect, useState } from 'react';

// Shared, single interval so multiple consumers don't create their own `Date` instances.
let current = new Date();
const listeners = new Set<(d: Date) => void>();
let timer: ReturnType<typeof setInterval> | null = null;

function start() {
  if (timer) return;
  timer = setInterval(() => {
    current = new Date();
    listeners.forEach((l) => l(current));
  }, 60_000);
}

/** Reactive "now", updated once per minute, shared across all consumers. */
export function useNow(): Date {
  const [now, setNow] = useState(current);
  useEffect(() => {
    listeners.add(setNow);
    start();
    return () => {
      listeners.delete(setNow);
    };
  }, []);
  return now;
}
