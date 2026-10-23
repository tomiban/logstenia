/**
 * Pure client-merge decisions (`design-plans/backend-sync.md` §6).
 *
 * No I/O, no repository imports: both functions take plain rows and return what the
 * engine has to do with Dexie, so they are unit-tested without a database.
 *
 * The last-write-wins compare always runs first. A tombstone is a case *of* that compare,
 * never a shortcut before it: a `deletedAt` check up front would let an older tombstone
 * overwrite a newer local edit.
 */
import type {
  MutationDecision,
  PullChange,
  PullDecision,
  PulledChange,
  SyncRowMeta,
} from './types';

/**
 * Decides what to do with one change pulled from the server.
 *
 * - local row unknown → `insert` (a tombstone-only change inserts a tombstone without
 *   payload; the caller adds identity + payload as it stores the row)
 * - incoming strictly newer → `update` (a tombstone here means "mark deleted", keeping
 *   the local payload; a live row means "replace the payload")
 * - otherwise → `skip`, including a tie: the server applies a mutation on a tie (§5
 *   `>=`), so the pushing client already won there, and the pull must keep the local row
 *   instead of rewriting it on every re-applied page (§7 crash-safe pull).
 */
export function applyPull<TLocal extends SyncRowMeta, TPayload>(
  localRow: TLocal | null | undefined,
  incoming: PullChange<TPayload>,
): PullDecision {
  if (!localRow) return 'insert';

  return isIncomingNewer(localRow, incoming) ? 'update' : 'skip';
}

/**
 * Decides what to do with a local mutation.
 *
 * The local write always happens first (§6): local storage is the source of truth, and
 * who wins against the server copy is settled later by `POST /sync` (§5). Both arguments
 * are accepted so callers can decide without branching, and neither can change the
 * outcome.
 */
export function applyMutation(
  _localRow: SyncRowMeta | null | undefined,
  _outgoing: SyncRowMeta,
): MutationDecision {
  return 'write';
}

/**
 * Compares ISO timestamps by instant, not by string, so differing offsets or fractional
 * seconds cannot invert the order. Unparseable timestamps never win: an ambiguous change
 * must not overwrite a row the local device already holds.
 */
function isIncomingNewer(local: SyncRowMeta, incoming: SyncRowMeta): boolean {
  const localTime = Date.parse(local.updatedAt);
  const incomingTime = Date.parse(incoming.updatedAt);

  if (Number.isNaN(localTime) || Number.isNaN(incomingTime)) return false;

  return incomingTime > localTime;
}

/** Dexie primary-key field carrying the change identity: `settings` keeps `key`. */
export type IdentityField = 'id' | 'key';

/**
 * Resolves the row Dexie has to store for one pulled change, applying the same §6 rules
 * as `applyPull` to the payload:
 *
 * - `insert` stores the incoming payload, or a tombstone-only row when the change carries
 *   no payload (so the deletion survives even when the row is unknown locally)
 * - `update` with a tombstone keeps the local payload and only marks the row deleted
 * - `update` with a live row replaces the payload
 * - `skip` stores nothing
 *
 * Returns `null` when nothing has to be written. The caller supplies the identity field,
 * so this stays free of repository or entity knowledge.
 */
export function resolvePullRow(
  localRow: SyncRowMeta | null | undefined,
  incoming: PulledChange,
  identityField: IdentityField = 'id',
): Record<string, unknown> | null {
  const decision = applyPull(localRow, incoming);
  if (decision === 'skip') return null;

  const identity = { [identityField]: incoming.id };
  const deletedAt = incoming.deletedAt ?? null;

  if (decision === 'insert') {
    return { ...payloadOf(incoming.row), ...identity, updatedAt: incoming.updatedAt, deletedAt };
  }

  if (deletedAt != null) {
    return { ...(localRow ? asRow(localRow) : {}), updatedAt: incoming.updatedAt, deletedAt };
  }

  return { ...payloadOf(incoming.row), ...identity, updatedAt: incoming.updatedAt, deletedAt: null };
}

function payloadOf(payload: unknown): Record<string, unknown> {
  return typeof payload === 'object' && payload !== null ? asRow(payload) : {};
}

function asRow(value: object): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const [field, entry] of Object.entries(value)) {
    row[field] = entry;
  }
  return row;
}
