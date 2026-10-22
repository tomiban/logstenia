import { useCallback } from 'react';

/** Best-effort vibration. Returns a function accepting a pattern. */
export function useVibration(): (pattern: number | number[]) => void {
  return useCallback((pattern: number | number[]) => {
    try {
      (navigator as any).vibrate?.(pattern);
    } catch {
      // ignore
    }
  }, []);
}
