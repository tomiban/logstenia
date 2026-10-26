/**
 * Domain layer for `/api/sync` (`odd/tasks/sync-layers.md` S3, S5).
 *
 * No `Context`, no status code, no body parsing: transport stays in the router, so these rules
 * can be exercised with a database and no HTTP. A domain failure that needs its own status leaves
 * as a `HTTPException` from `hono/http-exception`, which `app.onError` renders as JSON instead of
 * the platform's HTML 500 (S5). No rule here needs one today: every client-facing rejection is a
 * transport concern the router answers before the domain is reached.
 */
import type { Mutation } from './schema';
import {
  readPullPage,
  readRev,
  writePush,
  type RowRecord,
} from './queries';

export interface Change {
  entity: string;
  id: string;
  rev: number;
  updatedAt: string;
  deletedAt: string | null;
  row: unknown;
}

export interface Rejection {
  ref: string;
  reason: 'stale_server_newer';
}

export interface PullResult {
  rev: number;
  more: boolean;
  changes: Change[];
}

export interface PushResult {
  rev: number;
  applied: string[];
  rejected: Rejection[];
}

export async function pullChanges(
  db: D1Database,
  owner: string,
  since: number,
  limit: number,
): Promise<PullResult> {
  const { rev, rows } = await readPullPage(owner, db, since, limit + 1);
  return {
    rev,
    more: rows.length > limit,
    changes: rows.slice(0, limit).map(toChange),
  };
}

export async function pushMutations(
  db: D1Database,
  owner: string,
  mutations: readonly Mutation[],
): Promise<PushResult> {
  if (mutations.length === 0) return { rev: await readRev(db), applied: [], rejected: [] };

  const { rev, accepted } = await writePush(owner, db, mutations);
  const applied: string[] = [];
  const rejected: Rejection[] = [];

  mutations.forEach((mutation, index) => {
    const ref = `${mutation.entity}/${mutation.id}`;
    if (accepted[index]) applied.push(ref);
    else rejected.push({ ref, reason: 'stale_server_newer' });
  });

  return { rev, applied, rejected };
}

function toChange(row: RowRecord): Change {
  return {
    entity: row.entity,
    id: row.id,
    rev: row.rev,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    row: JSON.parse(row.payload) as unknown,
  };
}


