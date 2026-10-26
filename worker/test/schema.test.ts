/**
 * Envelope contract for `POST /api/sync` (`odd/tasks/sync-validation.md` S1-S5).
 *
 * These pin the parser instead of the route: they name the discriminated result the handler
 * consumes, so a schema change that moves an error code fails here first, without a database.
 */
import { describe, expect, it } from 'vitest';
import { parsePushBody, SYNC_ENTITY_NAMES } from '../src/sync/schema';

function mutation(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    entity: 'sessions',
    id: 'session-1',
    updatedAt: '2026-10-25T10:00:00.000Z',
    deletedAt: null,
    row: { id: 'session-1' },
    ...overrides,
  };
}

function body(
  mutations: unknown[],
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return { deviceId: 'dev_1', mutations, ...overrides };
}

describe('parsePushBody', () => {
  it('parses a valid body', () => {
    const result = parsePushBody(body([mutation()]));

    expect(result).toEqual({
      ok: true,
      body: {
        deviceId: 'dev_1',
        mutations: [
          {
            entity: 'sessions',
            id: 'session-1',
            updatedAt: '2026-10-25T10:00:00.000Z',
            deletedAt: null,
            row: { id: 'session-1' },
          },
        ],
      },
    });
  });

  it('rejects a body without a deviceId', () => {
    expect(parsePushBody({ mutations: [mutation()] })).toEqual({
      ok: false,
      error: 'invalid_body',
    });
    expect(parsePushBody(body([mutation()], { deviceId: '' }))).toEqual({
      ok: false,
      error: 'invalid_body',
    });
  });

  it('rejects a mutation without an id', () => {
    expect(parsePushBody(body([mutation({ id: undefined })]))).toEqual({
      ok: false,
      error: 'invalid_body',
    });
    expect(parsePushBody(body([mutation({ id: '' })]))).toEqual({
      ok: false,
      error: 'invalid_body',
    });
  });

  it('rejects an updatedAt that Date.parse cannot read', () => {
    expect(parsePushBody(body([mutation({ updatedAt: 'not-a-date' })]))).toEqual({
      ok: false,
      error: 'invalid_body',
    });
    expect(parsePushBody(body([mutation({ updatedAt: 42 })]))).toEqual({
      ok: false,
      error: 'invalid_body',
    });
  });

  it('accepts a parseable updatedAt that is not ISO 8601', () => {
    const result = parsePushBody(body([mutation({ updatedAt: '2026-10-25 10:00:00' })]));

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.body.mutations[0]?.updatedAt).toBe('2026-10-25 10:00:00');
  });

  it('reports an unknown entity as invalid_entity', () => {
    expect(parsePushBody(body([mutation({ entity: 'not-a-table' })]))).toEqual({
      ok: false,
      error: 'invalid_entity',
    });
  });

  it('keeps invalid_entity distinguishable from a structural failure', () => {
    expect(
      parsePushBody(body([mutation({ entity: 'not-a-table' }), mutation({ id: undefined })])),
    ).toEqual({ ok: false, error: 'invalid_entity' });
    expect(
      parsePushBody(body([mutation({ id: undefined }), mutation({ entity: 'not-a-table' })])),
    ).toEqual({ ok: false, error: 'invalid_body' });
  });

  it('drops an extra owner field so it never reaches the mutation', () => {
    const result = parsePushBody(body([mutation({ owner: 'bruno@ejemplo.com' })], { owner: 'x' }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const parsed = result.body.mutations[0];
    expect(parsed).toEqual({
      entity: 'sessions',
      id: 'session-1',
      updatedAt: '2026-10-25T10:00:00.000Z',
      deletedAt: null,
      row: { id: 'session-1' },
    });
    expect(Object.keys(parsed ?? {})).not.toContain('owner');
    expect(Object.keys(result.body)).toEqual(['deviceId', 'mutations']);
  });

  it('normalizes an absent row and deletedAt to null', () => {
    const result = parsePushBody(body([{ entity: 'tags', id: 'tag-1', updatedAt: '2026-10-25T10:00:00.000Z' }]));

    expect(result).toEqual({
      ok: true,
      body: {
        deviceId: 'dev_1',
        mutations: [
          {
            entity: 'tags',
            id: 'tag-1',
            updatedAt: '2026-10-25T10:00:00.000Z',
            deletedAt: null,
            row: null,
          },
        ],
      },
    });
  });

  it('accepts exactly the seven synced entities', () => {
    expect([...SYNC_ENTITY_NAMES]).toEqual([
      'sessions',
      'progress',
      'goals',
      'settings',
      'marks',
      'tags',
      'plans',
    ]);

    const result = parsePushBody(body(SYNC_ENTITY_NAMES.map((entity) => mutation({ entity }))));

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.body.mutations).toHaveLength(7);
  });

  it('rejects a non-string deletedAt', () => {
    expect(parsePushBody(body([mutation({ deletedAt: 5 })]))).toEqual({
      ok: false,
      error: 'invalid_body',
    });
  });

  it('rejects a mutations field that is not an array', () => {
    expect(parsePushBody({ deviceId: 'dev_1', mutations: 'x' })).toEqual({
      ok: false,
      error: 'invalid_body',
    });
  });

  it('rejects a row that is not an object, null or absent', () => {
    for (const row of [0, false, '', []]) {
      expect(parsePushBody(body([mutation({ row })]))).toEqual({
        ok: false,
        error: 'invalid_body',
      });
    }
  });

  it('passes a row object through untouched and normalizes null to null', () => {
    const row = { id: 'session-1', tags: ['a'] };

    const result = parsePushBody(body([mutation({ row }), mutation({ id: 'session-2', row: null })]));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.body.mutations[0]?.row).toBe(row);
    expect(result.body.mutations[1]?.row).toBeNull();
  });

  it('rejects values that are not an object with mutations', () => {
    expect(parsePushBody(null)).toEqual({ ok: false, error: 'invalid_body' });
    expect(parsePushBody([])).toEqual({ ok: false, error: 'invalid_body' });
    expect(parsePushBody({ deviceId: 'dev_1' })).toEqual({ ok: false, error: 'invalid_body' });
  });
});
