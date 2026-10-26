import { describe, expect, it } from 'vitest';
import {
  clockWarning,
  describeSync,
  deviceLabel,
  formatPendingCount,
  formatRelativeSync,
  formatSessionLine,
} from './syncStatus';

describe('formatPendingCount', () => {
  it('says nothing is pending when the outbox is empty', () => {
    expect(formatPendingCount(0)).toBe('sin cambios pendientes');
  });

  it('uses the singular for one pending change', () => {
    expect(formatPendingCount(1)).toBe('1 cambio pendiente');
  });

  it('uses the plural for several pending changes', () => {
    expect(formatPendingCount(3)).toBe('3 cambios pendientes');
  });
});

describe('formatRelativeSync', () => {
  const now = new Date('2026-10-23T18:00:00.000Z');

  it('reports never having synced', () => {
    expect(formatRelativeSync(null, now)).toBe('nunca');
  });

  it('reports a sync that just happened in seconds', () => {
    expect(formatRelativeSync('2026-10-23T17:59:30.000Z', now)).toBe('hace unos segundos');
  });

  it('reports minutes', () => {
    expect(formatRelativeSync('2026-10-23T17:57:00.000Z', now)).toBe('hace 3 min');
  });

  it('reports hours', () => {
    expect(formatRelativeSync('2026-10-23T16:00:00.000Z', now)).toBe('hace 2 h');
  });

  it('reports one day in the singular', () => {
    expect(formatRelativeSync('2026-10-22T18:00:00.000Z', now)).toBe('hace 1 día');
  });

  it('reports several days', () => {
    expect(formatRelativeSync('2026-10-21T18:00:00.000Z', now)).toBe('hace 2 días');
  });

  it('treats an unreadable timestamp as never synced', () => {
    expect(formatRelativeSync('no-es-una-fecha', now)).toBe('nunca');
  });
});

describe('clockWarning', () => {
  it('stays silent at or below two minutes of skew and without a server reading', () => {
    expect(clockWarning(null)).toBeNull();
    expect(clockWarning(120_000)).toBeNull();
    expect(clockWarning(-120_000)).toBeNull();
  });

  it('warns that the device clock is behind the server', () => {
    expect(clockWarning(-180_000)).toBe(
      'El reloj de este dispositivo está 3 min atrasado respecto del servidor.',
    );
  });

  it('warns that the device clock is ahead of the server', () => {
    expect(clockWarning(420_000)).toBe(
      'El reloj de este dispositivo está 7 min adelantado respecto del servidor.',
    );
  });
});

describe('deviceLabel', () => {
  it('names the device family of the browsers it runs on', () => {
    expect(deviceLabel('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36')).toBe('Android');
    expect(deviceLabel('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)')).toBe('iPhone');
    expect(deviceLabel('Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)')).toBe('iPad');
    expect(deviceLabel('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)')).toBe('Mac');
    expect(deviceLabel('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe('Windows');
    expect(deviceLabel('Mozilla/5.0 (X11; Linux x86_64)')).toBe('Linux');
  });

  it('falls back to this device when the user agent says nothing useful', () => {
    expect(deviceLabel('')).toBe('este dispositivo');
  });
});

describe('formatSessionLine', () => {
  it('names the signed-in email', () => {
    expect(formatSessionLine('ana@example.com')).toBe('Sesión: ana@example.com');
  });

  it('renders no line at all while the email is unknown or empty', () => {
    expect(formatSessionLine(null)).toBeNull();
    expect(formatSessionLine('')).toBeNull();
  });
});

describe('describeSync', () => {
  const now = new Date('2026-10-23T18:00:00.000Z');
  const base = {
    lastSyncAt: null,
    pendingCount: 0,
    authRequired: false,
    clockSkewMs: null,
    device: 'Android',
    now,
  };

  it('reports never synced, nothing pending and the active session', () => {
    expect(describeSync(base)).toEqual({
      statusLine: 'Última sincronización: nunca · sin cambios pendientes · este dispositivo (Android)',
      sessionLine: 'Sesión: activa',
      sessionUserLine: null,
      sessionExpired: false,
      clockWarning: null,
    });
  });

  it('shows the session email once the server reported it', () => {
    expect(describeSync({ ...base, email: 'ana@example.com' }).sessionUserLine).toBe(
      'Sesión: ana@example.com',
    );
  });

  it('reports the last sync, the pending changes and the device', () => {
    const view = describeSync({
      ...base,
      lastSyncAt: '2026-10-23T16:00:00.000Z',
      pendingCount: 3,
    });

    expect(view.statusLine).toBe(
      'Última sincronización: hace 2 h · 3 cambios pendientes · este dispositivo (Android)',
    );
  });

  it('asks the user to sign in again when the session expired', () => {
    const view = describeSync({ ...base, authRequired: true });

    expect(view.sessionExpired).toBe(true);
    expect(view.sessionLine).toBe('Sesión vencida — tocá para volver a entrar');
  });

  it('surfaces the clock warning next to the status line', () => {
    const view = describeSync({ ...base, clockSkewMs: -180_000 });

    expect(view.clockWarning).toBe(
      'El reloj de este dispositivo está 3 min atrasado respecto del servidor.',
    );
  });
});
