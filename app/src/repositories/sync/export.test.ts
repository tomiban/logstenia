import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { getDB } from '@/db/open';
import { createSettingsRepository, exportableSettings } from '@/repositories';

const STORES = ['sessions', 'progress', 'goals', 'settings', 'marks', 'tags', 'outbox'];

beforeEach(async () => {
  const db = await getDB();
  for (const store of STORES) await db.clear(store);
});

afterEach(async () => {
  const db = await getDB();
  for (const store of STORES) await db.clear(store);
});

describe('JSON backup export (§1, §2)', () => {
  it('excludes local-only settings rows so a restored backup cannot carry another device state', async () => {
    const settings = createSettingsRepository();
    await settings.put({ key: 'theme', value: 'dark' });
    await settings.put({ key: 'sync.cursor', value: 812 });
    await settings.put({ key: 'sync.deviceId', value: 'dev_abc' });
    await settings.put({ key: 'sync.lastSync', value: '2026-10-23T10:00:00.000Z' });
    await settings.put({ key: 'borrador:runner', value: { step: 1 } });

    expect(exportableSettings(await settings.list()).map((row) => row.key)).toEqual(['theme']);
  });
});
