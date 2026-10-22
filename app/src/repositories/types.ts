import type { SessionSet, SessionRecord, SettingRecord } from '@/db';

export type { SessionSet, SessionRecord, SettingRecord };

export interface ISessionRepository {
  list(): Promise<SessionRecord[]>;
  add(session: SessionRecord): Promise<void>;
}

export interface ISettingsRepository {
  get(key: string): Promise<SettingRecord | undefined>;
  put(record: SettingRecord): Promise<void>;
  delete(key: string): Promise<void>;
}
