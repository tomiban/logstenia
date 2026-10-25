/**
 * Owner isolation across HTTP (`design-plans/multi-user.md` §3, §6).
 *
 * These run against the real Hono app and real SQLite, because the point of the feature is
 * what the SQL does with `owner`: a prefix-matching fake can confirm that a statement was
 * issued, not that one person cannot see another person's rows.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { app } from '../src/index';
import { applySchema, SqliteD1 } from './helpers/sqliteD1';
import { installAccessPlatform, jwksFor } from './helpers/access';
import {
  envFor,
  keyPairPromise,
  migrations,
  mutation,
  pull,
  push,
  tokenFor,
} from './helpers/syncApi';

const OWNER_A = 'ana@ejemplo.com';
const OWNER_B = 'bruno@ejemplo.com';

describe('owner isolation', () => {
  let db: SqliteD1;

  beforeEach(async () => {
    installAccessPlatform(await jwksFor(await keyPairPromise));
    db = new SqliteD1();
    applySchema(db, migrations());
  });

  it('does not return one person\'s rows to another', async () => {
    expect((await push(db, OWNER_A, [mutation('s-a', 'A')])).status).toBe(200);
    expect((await push(db, OWNER_B, [mutation('s-b', 'B')])).status).toBe(200);

    const pageA = await pull(db, OWNER_A);
    const pageB = await pull(db, OWNER_B);

    expect(pageA.changes.map((change) => change.id)).toEqual(['s-a']);
    expect(pageB.changes.map((change) => change.id)).toEqual(['s-b']);
  });

  it('lets two people own the same entity id without overwriting each other', async () => {
    await push(db, OWNER_A, [mutation('shared', 'A', '2026-10-25T10:00:00.000Z')]);
    await push(db, OWNER_B, [mutation('shared', 'B', '2026-10-25T11:00:00.000Z')]);

    const pageA = await pull(db, OWNER_A);
    const pageB = await pull(db, OWNER_B);

    expect(pageA.changes).toHaveLength(1);
    expect(pageA.changes[0]?.row).toEqual({ id: 'shared', mark: 'A' });
    expect(pageB.changes[0]?.row).toEqual({ id: 'shared', mark: 'B' });
  });

  it('keeps each cursor independent while both paginate from zero', async () => {
    await push(db, OWNER_A, [mutation('s-a', 'A')]);
    await push(db, OWNER_B, [mutation('s-b', 'B')]);

    const firstA = await pull(db, OWNER_A);
    const firstB = await pull(db, OWNER_B);
    const secondA = await pull(db, OWNER_A, firstA.rev);

    expect(secondA.changes).toEqual([]);
    expect(firstB.changes.map((change) => change.id)).toEqual(['s-b']);
  });

  it('treats case and padding variants of the same email as one owner', async () => {
    await push(db, 'Ana@Ejemplo.com ', [mutation('s-a', 'A')]);

    const page = await pull(db, '  ana@ejemplo.COM');

    expect(page.changes.map((change) => change.id)).toEqual(['s-a']);
  });

  it('rejects a token without an email claim instead of writing an unscoped row', async () => {
    const response = await app.request(
      '/api/sync',
      { method: 'GET', headers: { 'cf-access-jwt-assertion': await tokenFor(null) } },
      envFor(db),
    );

    expect(response.status).toBe(401);
    expect(db.raw.prepare('SELECT COUNT(*) AS total FROM rows').get()).toEqual({ total: 0 });
  });

  it('reports the caller email on the pull as `user`', async () => {
    const page = await pull(db, OWNER_A);

    expect(page.user).toBe(OWNER_A);
  });

  it('rejects a mutation for an entity outside the synced allowlist', async () => {
    const response = await push(db, OWNER_A, [
      { entity: 'not-a-table', id: 'x', updatedAt: '2026-10-25T10:00:00.000Z', row: {} },
    ]);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'invalid_entity' });
    expect(db.raw.prepare('SELECT COUNT(*) AS total FROM rows').get()).toEqual({ total: 0 });
  });

  it('accepts every entity the client actually syncs', async () => {
    const entities = ['sessions', 'progress', 'goals', 'settings', 'marks', 'tags'];
    const response = await push(
      db,
      OWNER_A,
      entities.map((entity, index) => ({
        entity,
        id: `${entity}-1`,
        updatedAt: `2026-10-25T10:0${index}:00.000Z`,
        row: { id: `${entity}-1` },
      })),
    );

    expect(response.status).toBe(200);
    expect((await pull(db, OWNER_A)).changes).toHaveLength(entities.length);
  });
});
