import { db } from '@/db';
import type { ISettingsRepository, SettingRecord } from '../types';

export class DexieSettingsRepository implements ISettingsRepository {
  async get(key: string): Promise<SettingRecord | undefined> {
    return (await db.settings.get(key)) as SettingRecord | undefined;
  }
  async put(record: SettingRecord): Promise<void> {
    await db.settings.put(record);
  }
  async delete(key: string): Promise<void> {
    await db.settings.delete(key);
  }
}
