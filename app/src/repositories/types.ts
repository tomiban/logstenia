import type {
  GoalRecord,
  MarkRecord,
  ProgressRecord,
  SessionRecord,
  SessionSet,
  SettingRecord,
  TagRecord,
} from '@/db';

export type {
  GoalRecord,
  MarkRecord,
  ProgressRecord,
  SessionRecord,
  SessionSet,
  SettingRecord,
  TagRecord,
};

/**
 * Shared query surface every entity repository exposes (design §8). Feature code
 * talks to repositories only, so the sync engine has a single write path later.
 */
export interface IRepository<T> {
  list(): Promise<T[]>;
  get(key: string | number): Promise<T | undefined>;
  listWhere(index: string, value: unknown): Promise<T[]>;
  put(row: T): Promise<void>;
  add(row: T): Promise<void>;
  bulkPut(rows: T[]): Promise<void>;
  /**
   * Tombstone delete (design §2, §6). Schema v1003 has no `deletedAt` field yet, so
   * this still performs the previous hard delete; the v1004 schema (T3) turns it
   * into a lápida write without changing call sites.
   */
  softDelete(key: string | number): Promise<void>;
}

export type ISessionRepository = IRepository<SessionRecord>;

export interface ISettingsRepository extends IRepository<SettingRecord> {
  /** Hard delete for local-only keys (e.g. runner drafts) that must never sync. */
  delete(key: string): Promise<void>;
}

export interface IMarkRepository extends IRepository<MarkRecord> {
  /** Fill `exerciseId` on legacy marks; one transaction, idempotent. */
  migrateExerciseIds(resolve: (exercise: string) => string | undefined): Promise<void>;
}

export type ITagRepository = IRepository<TagRecord>;
export type IGoalRepository = IRepository<GoalRecord>;
export type IProgressRepository = IRepository<ProgressRecord>;
