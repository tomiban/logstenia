/**
 * Push integrity against concurrent writers (spec S1, S2 in `odd/tasks/sync-lww-integrity.md`).
 *
 * The lookup of the stored `updated_at` and the write used to be two batches, so a newer row
 * could land between them and the older push would still overwrite it, taking the higher `rev`
 * with it. Every device of the owner then converges to the wrong value, with no error anywhere.
 */
import { describe, expect, it } from 'vitest';
import { pushMutations } from '../src/sync/service';
import type { Mutation } from '../src/sync/schema';
import { applySchema, SqliteD1 } from './helpers/sqliteD1';
import { migrations } from './helpers/syncApi';

const OWNER = 'ana@ejemplo.com';
const T_OLD = '2026-10-20T18:00:00.000Z';
const T_NEW = '2026-10-20T18:05:00.000Z';

function themeMutation(updatedAt: string, value: string): Mutation {
  return { entity: 'settings', id: 'theme', updatedAt, deletedAt: null, row: { value } };
}

function storedTheme(db: SqliteD1): string | undefined {
  const rows = db.select(
    "SELECT payload FROM rows WHERE owner = ? AND entity = 'settings' AND id = 'theme'",
    [OWNER],
  ) as { payload: string }[];
  const [row] = rows;
  return row ? (JSON.parse(row.payload) as { value: string }).value : undefined;
}

/**
 * A `D1Database` that lets another push commit right before this one writes `rows`, which is
 * precisely the window the single-transaction push closes. It fires on the first batch carrying
 * an `INSERT INTO rows`, so it works whether the write is its own batch or shares one.
 */
function withInterleavedPush(inner: SqliteD1, onWrite: () => Promise<void>): D1Database {
  let injected = false;
  return {
    prepare: (sql: string) => inner.prepare(sql),
    batch: async (statements: { sql: string }[]) => {
      if (!injected && statements.some((statement) => statement.sql.includes('INSERT INTO rows'))) {
        injected = true;
        await onWrite();
      }
      return inner.batch(statements as never);
    },
  } as unknown as D1Database;
}

describe('push integrity (spec S1)', () => {
  it('does not let an older push overwrite a row that committed first', async () => {
    const db = new SqliteD1();
    applySchema(db, migrations());

    // The newer write lands after the older push looked the row up but before it writes.
    const racing = withInterleavedPush(db, async () => {
      const newer = await pushMutations(db as unknown as D1Database, OWNER, [
        themeMutation(T_NEW, 'dark'),
      ]);
      expect(newer.applied).toEqual(['settings/theme']);
    });

    const stale = await pushMutations(racing, OWNER, [themeMutation(T_OLD, 'light')]);

    expect(stale.rejected).toEqual([{ ref: 'settings/theme', reason: 'stale_server_newer' }]);
    expect(stale.applied).toEqual([]);
    expect(storedTheme(db)).toBe('dark');
  });

  it('still applies a newer push over an older stored row', async () => {
    const db = new SqliteD1();
    applySchema(db, migrations());

    const older = await pushMutations(db as unknown as D1Database, OWNER, [
      themeMutation(T_OLD, 'light'),
    ]);
    expect(older.applied).toEqual(['settings/theme']);

    const newer = await pushMutations(db as unknown as D1Database, OWNER, [
      themeMutation(T_NEW, 'dark'),
    ]);
    expect(newer.applied).toEqual(['settings/theme']);
    expect(newer.rejected).toEqual([]);
    expect(storedTheme(db)).toBe('dark');
  });
});
