/**
 * HTTP scaffolding shared by the owner suites.
 *
 * The owner tests run against the real Hono app and real SQLite, because the point of the
 * feature is what the SQL does with `owner`: a prefix-matching fake can confirm that a
 * statement was issued, not that one person cannot see another person's rows.
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { expect } from 'vitest';
import { app } from '../../src/index';
import { type MigrationFile, SqliteD1 } from './sqliteD1';
import { AUD, makeKeyPair, signToken, TEAM } from './access';

const MIGRATIONS_DIR = path.join(import.meta.dirname, '..', '..', 'migrations');

/** One key pair per test process: every token and the served JWKS must agree with it. */
export const keyPairPromise = makeKeyPair();

export interface PullBody {
  rev: number;
  more: boolean;
  changes: { entity: string; id: string; row: unknown }[];
  user?: string;
}

export interface PushMutation {
  entity: string;
  id: string;
  updatedAt: string;
  row: unknown;
}

export function migrations(): MigrationFile[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith('.sql'))
    .sort()
    .map((name) => ({ name, sql: readFileSync(path.join(MIGRATIONS_DIR, name), 'utf8') }));
}

export function envFor(db: SqliteD1): {
  DB: D1Database;
  CF_ACCESS_TEAM: string;
  CF_ACCESS_AUD: string;
} {
  return { DB: db as unknown as D1Database, CF_ACCESS_TEAM: TEAM, CF_ACCESS_AUD: AUD };
}

export async function tokenFor(email: string | null): Promise<string> {
  return signToken((await keyPairPromise).privateKey, { email });
}

export async function pull(db: SqliteD1, email: string, since = 0): Promise<PullBody> {
  const response = await app.request(
    `/api/sync?since=${since}`,
    { method: 'GET', headers: { 'cf-access-jwt-assertion': await tokenFor(email) } },
    envFor(db),
  );
  expect(response.status).toBe(200);
  return (await response.json()) as PullBody;
}

export async function push(
  db: SqliteD1,
  email: string,
  mutations: PushMutation[],
): Promise<Response> {
  return app.request(
    '/api/sync',
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'cf-access-jwt-assertion': await tokenFor(email),
      },
      body: JSON.stringify({
        deviceId: 'dev_1',
        mutations: mutations.map((mutation) => ({ ...mutation, deletedAt: null })),
      }),
    },
    envFor(db),
  );
}

export function mutation(id: string, mark: string, updatedAt = '2026-10-25T10:00:00.000Z') {
  return { entity: 'sessions', id, updatedAt, row: { id, mark } };
}
