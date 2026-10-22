// Session duration helpers.

/**
 * Seconds elapsed between two timestamps, never negative.
 * `from` is the session start; 0 means "not started".
 */
export function elapsedSeconds(from: number, now: number): number {
  if (!from) return 0;
  return Math.max(0, Math.round((now - from) / 1000));
}
