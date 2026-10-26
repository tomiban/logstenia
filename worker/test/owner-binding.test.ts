/**
 * Owner binding at the HTTP edge (`odd/tasks/multi-user.md` S2, S5).
 *
 * These pin the owner to the verified identity on every path that could leak it: the server
 * never learns the owner from the client, and a mutation is only ever compared against the
 * caller's own row. Without the second rule, one person pushing an older mutation for an
 * `(entity, id)` someone else owns is rejected as `stale_server_newer`, which is both
 * cross-owner interference and an existence/timestamp oracle.
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
  type PullBody,
  type PushMutation,
  tokenFor,
} from './helpers/syncApi';

const OWNER_A = 'ana@ejemplo.com';
const OWNER_B = 'bruno@ejemplo.com';

describe('owner binding', () => {
  let db: SqliteD1;

  beforeEach(async () => {
    installAccessPlatform(await jwksFor(await keyPairPromise));
    db = new SqliteD1();
    applySchema(db, migrations());
  });

  it('does not reject an older mutation against another owner\'s row', async () => {
    expect((await push(db, OWNER_A, [mutation('x', 'A', '2026-10-25T12:00:00.000Z')])).status).toBe(
      200,
    );

    const response = await push(db, OWNER_B, [mutation('x', 'B', '2026-10-25T10:00:00.000Z')]);
    const body = (await response.json()) as { applied: string[]; rejected: unknown[] };

    expect(response.status).toBe(200);
    expect(body.applied).toEqual(['sessions/x']);
    expect(body.rejected).toEqual([]);
  });

  it('ignores `x-dev-owner` when the dev bypass is not active', async () => {
    await push(db, OWNER_A, [mutation('s-a', 'A')]);

    const response = await app.request(
      '/api/sync',
      {
        method: 'GET',
        headers: {
          'cf-access-jwt-assertion': await tokenFor(OWNER_A),
          'x-dev-owner': OWNER_B,
        },
      },
      envFor(db),
    );
    const body = (await response.json()) as PullBody;

    expect(response.status).toBe(200);
    expect(body.user).toBe(OWNER_A);
    expect(body.changes.map((change) => change.id)).toEqual(['s-a']);
  });

  it('rejects `x-dev-owner` without a token', async () => {
    const response = await app.request(
      'http://localhost/api/sync',
      { method: 'GET', headers: { 'x-dev-owner': OWNER_B } },
      envFor(db),
    );

    expect(response.status).toBe(401);
  });

  it('never takes the row owner from the mutation body', async () => {
    const withOwnerClaim: PushMutation & { owner: string } = {
      ...mutation('s-a', 'A'),
      owner: OWNER_B,
    };

    const response = await push(db, OWNER_A, [withOwnerClaim]);

    expect(response.status).toBe(200);
    expect((await pull(db, OWNER_B)).changes).toEqual([]);
    expect((await pull(db, OWNER_A)).changes.map((change) => change.id)).toEqual(['s-a']);
  });
});
