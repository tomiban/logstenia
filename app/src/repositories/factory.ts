import { DexieSessionRepository } from './dexie/sessionRepository';
import { DexieSettingsRepository } from './dexie/settingsRepository';
import type { ISessionRepository, ISettingsRepository } from './types';

export function createSessionRepository(): ISessionRepository {
  return new DexieSessionRepository();
}

export function createSettingsRepository(): ISettingsRepository {
  return new DexieSettingsRepository();
}
