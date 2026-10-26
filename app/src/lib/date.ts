// Centralized date helpers and a shared "now" to avoid scattered `new Date()` instances.

/** ISO date (UTC) `YYYY-MM-DD`. */
export function toISODate(d: Date | string | number = new Date()): string {
  const date = d instanceof Date ? d : new Date(d);
  return date.toISOString().slice(0, 10);
}

/** Full ISO timestamp. */
export function toISOTimestamp(d: Date | string | number = new Date()): string {
  const date = d instanceof Date ? d : new Date(d);
  return date.toISOString();
}

/** Local calendar date `YYYY-MM-DD` (respects the user's timezone). */
export function toLocalISODate(d: Date | string | number = new Date()): string {
  const date = d instanceof Date ? d : new Date(d);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

/**
 * A stored `YYYY-MM-DD` day as `dd/mm` for the UI. Anything that is not a stored ISO day is
 * returned untouched, so a caller never has to guard a legacy or empty value.
 */
export function formatDayMonth(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return iso;
  return `${match[3]}/${match[2]}`;
}

export function formatShort(d: Date = new Date()): string {
  return d.toLocaleDateString('es-AR', { weekday: 'short', day: '2-digit', month: 'short' });
}

export function formatLong(d: Date = new Date()): string {
  return d.toLocaleDateString('es-AR', { weekday: 'long', day: '2-digit', month: 'long' });
}
