import { DexieGoalRepository } from './dexie/goalRepository';
import { DexieMarkRepository } from './dexie/markRepository';
import { DexieProgressRepository } from './dexie/progressRepository';
import { DexieSessionRepository } from './dexie/sessionRepository';
import { DexieSettingsRepository } from './dexie/settingsRepository';
import { DexieTagRepository } from './dexie/tagRepository';
import type {
  IGoalRepository,
  IMarkRepository,
  IProgressRepository,
  ISessionRepository,
  ISettingsRepository,
  ITagRepository,
} from './types';

export function createSessionRepository(): ISessionRepository {
  return new DexieSessionRepository();
}

export function createSettingsRepository(): ISettingsRepository {
  return new DexieSettingsRepository();
}

export function createMarkRepository(): IMarkRepository {
  return new DexieMarkRepository();
}

export function createTagRepository(): ITagRepository {
  return new DexieTagRepository();
}

export function createGoalRepository(): IGoalRepository {
  return new DexieGoalRepository();
}

export function createProgressRepository(): IProgressRepository {
  return new DexieProgressRepository();
}
