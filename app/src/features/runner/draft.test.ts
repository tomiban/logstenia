import { describe, expect, it } from 'vitest';
import { draftFrom, newSetValue, type SetValue } from './useRunner';
import type { RestDestination } from './useRunner';

const values: Record<string, SetValue[]> = {
  '0#0': [{ id: 'a', value: '12' }, { id: 'b', value: '' }],
};

describe('draftFrom', () => {
  it('reads the current draft shape without marking it as migrated', () => {
    const { draft, migrated } = draftFrom({
      i: 2,
      values,
      restUntil: 1_700_000_000_000,
      restSeconds: 90,
      restLabel: 'Descanso de serie',
      restDestination: { index: 3 },
    });

    expect(migrated).toBe(false);
    expect(draft.i).toBe(2);
    expect(draft.values).toEqual(values);
    expect(draft.restSeconds).toBe(90);
    expect(draft.restDestination).toEqual({ index: 3 });
  });

  it('maps a draft saved before the rename instead of ignoring it', () => {
    const legacy = {
      i: 1,
      vals: values,
      descansoHasta: 1_700_000_000_000,
      descansoSegundos: 120,
      descansoEtiqueta: 'Descanso al finalizar el ejercicio',
      descansoDestino: { finished: true } as RestDestination,
    };

    const { draft, migrated } = draftFrom(legacy);

    expect(migrated).toBe(true);
    expect(draft.i).toBe(1);
    expect(draft.values).toEqual(values);
    expect(draft.restUntil).toBe(1_700_000_000_000);
    expect(draft.restSeconds).toBe(120);
    expect(draft.restLabel).toBe('Descanso al finalizar el ejercicio');
    expect(draft.restDestination).toEqual({ finished: true });
  });

  it('returns an empty draft when the stored value carries nothing', () => {
    const { draft, migrated } = draftFrom({});

    expect(migrated).toBe(false);
    expect(draft.values).toBeUndefined();
    expect(draft.restUntil).toBeUndefined();
  });
});

describe('newSetValue', () => {
  it('gives every set a distinct identity', () => {
    const first = newSetValue();
    const second = newSetValue('10');

    expect(first.id).not.toBe(second.id);
    expect(second.value).toBe('10');
  });
});
