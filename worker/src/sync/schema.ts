/**
 * Envelope schema for `POST /api/sync` (`odd/tasks/sync-validation.md` S1-S7).
 *
 * The payload stays opaque: no field of `row` is inspected or rewritten, so a live row carrying
 * `row: null` still passes (`multi-user.md` S10). Only its container is checked, because a client
 * bug that pushes a scalar or an array as a row would be replicated verbatim and then materialise
 * on every client as an empty record.
 *
 * `zod/mini` is the same core with the method-based API replaced by per-function imports, so the
 * Worker ships 4 KB gzip of zod instead of 24 KB while the contract stays identical.
 */
import {
  array,
  check,
  minLength,
  nullable,
  object,
  optional,
  pipe,
  string,
  transform,
  unknown,
} from 'zod/mini';
import type { output } from 'zod/mini';

/**
 * Tables the client may sync. Anything else is refused before it reaches the database: an
 * unknown entity would occupy the change log forever and be dropped by every client, so it is
 * a validation error rather than a row.
 */
export const SYNC_ENTITY_NAMES = [
  'sessions',
  'progress',
  'goals',
  'settings',
  'marks',
  'tags',
] as const;

const SYNC_ENTITY_ALLOWLIST: ReadonlySet<string> = new Set(SYNC_ENTITY_NAMES);

/** Tag carried by the allowlist issue so `parsePushBody` can keep `invalid_entity` distinct. */
const INVALID_ENTITY_REASON = 'invalid_entity';

/*
 * `Date.parse` and not a datetime rule: the looser check is the deployed contract, and tightening
 * it would reject timestamps current clients already push (`sync-validation.md` S4).
 */
const parseableTimestamp = string().check(
  check(({ value, issues }) => {
    if (Number.isNaN(Date.parse(value))) {
      issues.push({ code: 'custom', message: 'expected a parseable date', input: value });
    }
  }),
);

/*
 * A `row` is a JSON object or nothing: `null` and an absent key both mean "no payload", while a
 * scalar or an array is a client bug that must fail before it is replicated. The value itself is
 * never transformed, so the envelope stays opaque (S5).
 */
const opaqueRow = unknown().check(
  check(({ value, issues }) => {
    if (value === null) return;
    if (typeof value !== 'object' || Array.isArray(value)) {
      issues.push({ code: 'custom', message: 'expected a plain object', input: value });
    }
  }),
);

export const mutationSchema = pipe(
  object({
    entity: string().check(minLength(1)),
    id: string().check(minLength(1)),
    updatedAt: parseableTimestamp,
    deletedAt: optional(nullable(string())),
    row: optional(opaqueRow),
  }).check(({ value, issues }) => {
    if (!SYNC_ENTITY_ALLOWLIST.has(value.entity)) {
      issues.push({
        code: 'custom',
        message: 'unknown entity',
        input: value.entity,
        params: { reason: INVALID_ENTITY_REASON },
      });
    }
  }),
  transform((mutation) => ({
    entity: mutation.entity,
    id: mutation.id,
    updatedAt: mutation.updatedAt,
    deletedAt: mutation.deletedAt ?? null,
    row: mutation.row ?? null,
  })),
);

/* Unknown keys are stripped by default, so a client-supplied `owner` never reaches the row. */
export const pushBodySchema = object({
  deviceId: string().check(minLength(1)),
  mutations: array(mutationSchema),
});

export type Mutation = output<typeof mutationSchema>;
export type PushBody = output<typeof pushBodySchema>;

export type ParsedPushBody =
  | { ok: true; body: PushBody }
  | { ok: false; error: 'invalid_body' | 'invalid_entity' };

export function parsePushBody(value: unknown): ParsedPushBody {
  const result = pushBodySchema.safeParse(value);
  if (result.success) return { ok: true, body: result.data };

  /*
   * Issues are reported in parse order, so the first one is the mutation the previous
   * hand-written loop would have failed on: structural issues win over the allowlist issue of
   * the same or a later mutation, and an allowlisted-entity failure keeps its own code.
   */
  const [first] = result.error.issues;
  const invalidEntity = first?.code === 'custom' && first.params?.reason === INVALID_ENTITY_REASON;
  return { ok: false, error: invalidEntity ? 'invalid_entity' : 'invalid_body' };
}
