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

export function formatShort(d: Date = new Date()): string {
  return d.toLocaleDateString('es-AR', { weekday: 'short', day: '2-digit', month: 'short' });
}

export function formatLong(d: Date = new Date()): string {
  return d.toLocaleDateString('es-AR', { weekday: 'long', day: '2-digit', month: 'long' });
}
