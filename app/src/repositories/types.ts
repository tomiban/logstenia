import type { SyncFields,
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
  /**
   * Write-side signatures accept rows without the v1004 sync fields: the repository
   * chokepoint stamps `id` (UUID), `updatedAt` and `deletedAt` on every write, and
   * preserves values the caller already set (backups, server rows).
   */
  put(row: Omit<T, 'updatedAt' | 'deletedAt'> & Partial<Pick<SyncFields, 'updatedAt' | 'deletedAt'>>): Promise<void>;
  add(row: Omit<T, 'id' | 'updatedAt' | 'deletedAt'> & { id?: string }): Promise<void>;
  /** Same write-side shape as `put`, in one transaction, for seeds and imports. */
  bulkPut(rows: InsertRow<T>[]): Promise<void>;
  /**
   * Tombstone delete (design §2, §6). Since schema v1004 this writes `deletedAt` +
   * a bumped `updatedAt` instead of removing the row; tombstoned rows stay out of
   * every read path.
   */
  softDelete(key: string | number): Promise<void>;
}

/**
 * A row handed to a write method: the sync identity (`id`, `updatedAt`, `deletedAt`) is
 * optional because the repository chokepoint stamps whatever the caller left out.
 */
export type InsertRow<T> = Omit<T, 'id' | 'updatedAt' | 'deletedAt'> &
  Partial<{ id: string; updatedAt: string; deletedAt: string | null }>;

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
