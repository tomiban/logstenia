/**
 * Test adapter that runs real SQLite through `node:sqlite` behind the `D1Database` surface.
 *
 * `FakeD1` in `test/sync.test.ts` matches SQL by prefix, so it can assert which statements a
 * handler issued but cannot execute DDL, composite primary keys or a table rebuild. The
 * multi-user migration and the owner isolation are exactly that kind of behaviour, so they are
 * tested here against a real engine: SQLite is what D1 runs, and Node ships it without a
 * dependency. Production code is unchanged; only the binding is substituted.
 */
import { DatabaseSync } from 'node:sqlite';

type SqlValue = string | number | null | Uint8Array;

export interface MigrationFile {
  name: string;
  sql: string;
}

export class SqliteStatement {
  private params: SqlValue[] = [];

  constructor(
    private readonly db: SqliteD1,
    readonly sql: string,
  ) {}

  bind(...params: SqlValue[]): SqliteStatement {
    const bound = new SqliteStatement(this.db, this.sql);
    bound.params = params;
    return bound;
  }

  async all<T>(): Promise<{ results: T[] }> {
    return { results: this.db.select(this.sql, this.params) as T[] };
  }

  async first<T>(): Promise<T | null> {
    const { results } = await this.all<T>();
    return results[0] ?? null;
  }

  async run(): Promise<{ results: unknown[] }> {
    return this.all();
  }
}

/** `D1Database`-shaped binding backed by an in-memory SQLite database. */
export class SqliteD1 {
  readonly raw: DatabaseSync;

  constructor() {
    this.raw = new DatabaseSync(':memory:');
  }

  prepare(sql: string): SqliteStatement {
    return new SqliteStatement(this, sql.trim());
  }

  /** Applies any multi-statement script, as `wrangler d1 migrations apply` does. */
  exec(sql: string): void {
    this.raw.exec(sql);
  }

  async batch(statements: SqliteStatement[]): Promise<{ results: unknown[] }[]> {
    const results: { results: unknown[] }[] = [];
    for (const statement of statements) results.push(await statement.all());
    return results;
  }

  select(sql: string, params: SqlValue[]): unknown[] {
    return this.raw.prepare(sql).all(...params) as unknown[];
  }

  close(): void {
    this.raw.close();
  }
}

/** Runs `sql` in one transaction, the way D1 wraps each migration file. */
export function applyMigration(db: SqliteD1, sql: string): void {
  db.exec('BEGIN');
  try {
    db.exec(sql);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

/**
 * Applies the production schema in order, so a test starts where a deployed database starts.
 * Migration files are read from disk instead of restated: DDL copied into a test proves
 * nothing about the file that actually runs.
 */
export function applySchema(db: SqliteD1, migrations: readonly MigrationFile[]): void {
  for (const migration of migrations) applyMigration(db, migration.sql);
}
