/**
 * JSON backup content (`design-plans/backend-sync.md` §1, §2).
 *
 * `sync.*` and `borrador:*` settings belong to one device. Restoring a backup that carries
 * them on another device would copy the old cursor and make the pull skip rows, so they
 * never leave the device through any of the three outbound paths: outbox, pull-apply and
 * this export.
 */
import { isLocalOnlySettingKey } from './outbox';

/** The `settings` slice of a backup: local-only rows are dropped. */
export function exportableSettings<T extends { key: string }>(rows: readonly T[]): T[] {
  return rows.filter((row) => !isLocalOnlySettingKey(row.key));
}
