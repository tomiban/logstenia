/**
 * Migration `0002_owner.sql` against real SQLite (`design-plans/multi-user.md` §2, §6).
 *
 * The rebuild touches every stored row, so these tests read the migration files from disk and
 * assert the observable outcome: preserved revisions, the new primary key, the index the pull
 * query needs, and the adoption step the deploy runs afterwards.
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { applySchema, type MigrationFile, SqliteD1 } from './helpers/sqliteD1';

const MIGRATIONS_DIR = path.join(import.meta.dirname, '..', 'migrations');

function migrations(): MigrationFile[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith('.sql'))
    .sort()
    .map((name) => ({ name, sql: readFileSync(path.join(MIGRATIONS_DIR, name), 'utf8') }));
}

function migratedDb(): SqliteD1 {
  const db = new SqliteD1();
  applySchema(db, migrations());
  return db;
}

/** Starts from the v1 schema, seeds a deployed database, then applies 0002. */
function dbWithLegacyRows(db: SqliteD1): SqliteD1 {
  const files = migrations();
  applySchema(db, files.slice(0, -1));
  seedLegacyRows(db);
  applySchema(db, files.slice(-1));
  return db;
}

function seedLegacyRows(db: SqliteD1): void {
  const insert = db.raw.prepare(
    'INSERT INTO rows (entity, id, rev, updated_at, deleted_at, payload) VALUES (?, ?, ?, ?, ?, ?)',
  );
  insert.run('sessions', 'session-1', 1, '2026-10-20T18:00:00.000Z', null, '{"id":"session-1"}');
  insert.run('tags', 'tag-1', 2, '2026-10-20T18:01:00.000Z', null, '{"id":"tag-1"}');
  insert.run(
    'marks',
    'mark-deleted',
    3,
    '2026-10-20T18:02:00.000Z',
    '2026-10-21T09:00:00.000Z',
    'null',
  );
  db.raw.prepare("UPDATE meta SET value = 3 WHERE key = 'rev'").run();
}

function versions(dir: string): string[] {
  return readdirSync(dir).filter((name) => name.endsWith('.sql')).sort();
}

describe('migration 0002_owner', () => {
  let db: SqliteD1 | null = null;

  afterEach(() => {
    db?.close();
    db = null;
  });

  it('parks every existing row under the legacy marker with its original revision', () => {
    db = new SqliteD1();
    const files = migrations();
    expect(files.map((file) => file.name)).toEqual([
      '0001_init.sql',
      '0002_owner.sql',
    ]);

    applySchema(db, files.slice(0, 1));
    seedLegacyRows(db);
    applySchema(db, files.slice(1));

    const rows = db.raw
      .prepare('SELECT owner, entity, id, rev, deleted_at FROM rows ORDER BY rev')
      .all() as { owner: string; entity: string; id: string; rev: number; deleted_at: string | null }[];

    expect(rows).toHaveLength(3);
    expect(rows.every((row) => row.owner === 'legacy@local')).toBe(true);
    expect(rows.map((row) => row.rev)).toEqual([1, 2, 3]);
    expect(rows.map((row) => row.entity)).toEqual(['sessions', 'tags', 'marks']);
    expect(rows[2]?.deleted_at).toBe('2026-10-21T09:00:00.000Z');
    expect(db.raw.prepare("SELECT value FROM meta WHERE key = 'rev'").get()).toEqual({ value: 3 });
  });

  it('keeps the payload bytes untouched', () => {
    db = dbWithLegacyRows(new SqliteD1());
    const payload = db.raw
      .prepare("SELECT payload FROM rows WHERE entity = 'sessions' AND id = 'session-1'")
      .get() as { payload: string };
    expect(payload.payload).toBe('{"id":"session-1"}');
  });

  it('scopes the primary key by owner so two people can own the same entity id', () => {
    db = migratedDb();
    const insert = db.raw.prepare(
      'INSERT INTO rows (owner, entity, id, rev, updated_at, deleted_at, payload) VALUES (?, ?, ?, ?, ?, ?, ?)',
    );

    insert.run('a@local', 'sessions', 'same-id', 1, '2026-10-20T18:00:00.000Z', null, '{}');
    insert.run('b@local', 'sessions', 'same-id', 2, '2026-10-20T18:00:00.000Z', null, '{}');

    expect(() =>
      insert.run('a@local', 'sessions', 'same-id', 3, '2026-10-20T19:00:00.000Z', null, '{}'),
    ).toThrow(/UNIQUE constraint failed/i);
  });

  it('serves the pull query from the owner index', () => {
    db = migratedDb();
    const plan = db.raw
      .prepare(
        'EXPLAIN QUERY PLAN SELECT entity, id, rev, updated_at, deleted_at, payload FROM rows WHERE owner = ? AND rev > ? ORDER BY rev LIMIT ?',
      )
      .all('a@local', 0, 201) as { detail: string }[];

    expect(plan.some((step) => step.detail.includes('rows_owner_rev'))).toBe(true);
  });

  it('adopts the legacy rows into one real owner and reports the counts per owner', () => {
    db = dbWithLegacyRows(new SqliteD1());

    db.raw.prepare("UPDATE rows SET owner = ? WHERE owner = 'legacy@local'").run('duena@ejemplo.com');
    const counts = db.raw
      .prepare('SELECT owner, COUNT(*) AS total FROM rows GROUP BY owner')
      .all() as { owner: string; total: number }[];

    expect(counts).toEqual([{ owner: 'duena@ejemplo.com', total: 3 }]);
  });

  it('is the last schema migration, so the deploy applies one rebuild', () => {
    expect(versions(MIGRATIONS_DIR).at(-1)).toBe('0002_owner.sql');
  });
});
