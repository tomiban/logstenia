import { useCallback, useEffect, useState } from 'react';

/** State persisted in localStorage under `key`. SSR-safe. */
export function usePersistedState<T>(key: string, initial: T): [T, (v: T | ((p: T) => T)) => void] {
  const [state, setState] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw != null ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch {
      // ignore quota/serialization errors
    }
  }, [key, state]);

  const set = useCallback((v: T | ((p: T) => T)) => {
    setState((prev) => (typeof v === 'function' ? (v as (p: T) => T)(prev) : v));
  }, []);

  return [state, set];
}
