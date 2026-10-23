/**
 * Sync copy for the Settings popover (`design-plans/backend-sync.md` §9).
 *
 * Pure formatting only: the copy, its variants and the two thresholds are pinned by unit
 * tests instead of by reading the component.
 */

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const SKEW_WARNING_MS = 2 * MINUTE_MS;

export const SESSION_EXPIRED_COPY = 'Sesión vencida — tocá para volver a entrar';

export interface SyncStatusInput {
  /** ISO timestamp of the last successful sync, or `null` when it never ran. */
  lastSyncAt: string | null;
  pendingCount: number;
  authRequired: boolean;
  /** Server clock minus local clock from the last pulled page. */
  clockSkewMs: number | null;
  device: string;
  now?: Date;
}

export interface SyncStatusView {
  /** `Última sincronización: hace 2 h · 3 cambios pendientes · este dispositivo (Android)`. */
  statusLine: string;
  sessionLine: string;
  sessionExpired: boolean;
  clockWarning: string | null;
}

export function describeSync(input: SyncStatusInput): SyncStatusView {
  const now = input.now ?? new Date();
  const relative = formatRelativeSync(input.lastSyncAt, now);

  return {
    statusLine: `Última sincronización: ${relative} · ${formatPendingCount(input.pendingCount)} · este dispositivo (${input.device})`,
    sessionLine: input.authRequired ? SESSION_EXPIRED_COPY : 'Sesión: activa',
    sessionExpired: input.authRequired,
    clockWarning: clockWarning(input.clockSkewMs),
  };
}

export function formatPendingCount(count: number): string {
  if (count <= 0) return 'sin cambios pendientes';
  return count === 1 ? '1 cambio pendiente' : `${count} cambios pendientes`;
}

export function formatRelativeSync(iso: string | null, now: Date = new Date()): string {
  if (iso === null) return 'nunca';

  const at = Date.parse(iso);
  if (Number.isNaN(at)) return 'nunca';

  const elapsed = now.getTime() - at;
  if (elapsed < MINUTE_MS) return 'hace unos segundos';
  if (elapsed < HOUR_MS) return `hace ${Math.floor(elapsed / MINUTE_MS)} min`;
  if (elapsed < DAY_MS) return `hace ${Math.floor(elapsed / HOUR_MS)} h`;

  const days = Math.floor(elapsed / DAY_MS);
  return days === 1 ? 'hace 1 día' : `hace ${days} días`;
}

export function clockWarning(skewMs: number | null): string | null {
  if (skewMs === null) return null;

  const magnitude = Math.abs(skewMs);
  if (magnitude <= SKEW_WARNING_MS) return null;

  const minutes = Math.round(magnitude / MINUTE_MS);
  const direction = skewMs < 0 ? 'atrasado' : 'adelantado';
  return `El reloj de este dispositivo está ${minutes} min ${direction} respecto del servidor.`;
}

export function deviceLabel(userAgent: string): string {
  if (/iPad/.test(userAgent)) return 'iPad';
  if (/iPhone/.test(userAgent)) return 'iPhone';
  if (/Android/.test(userAgent)) return 'Android';
  if (/Macintosh|Mac OS X/.test(userAgent)) return 'Mac';
  if (/Windows/.test(userAgent)) return 'Windows';
  if (/Linux/.test(userAgent)) return 'Linux';
  return 'este dispositivo';
}
