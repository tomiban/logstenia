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
import type { MutationDecision, PullChange, PullDecision, SyncRowMeta } from './types';

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
