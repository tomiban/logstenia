import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import 'fake-indexeddb/auto';
import type { Block, Model, PlanData } from '@/types';
import { getDB } from '@/db/open';
import { plansRepository, SEED_UPDATED_AT } from '@/data/plansRepository';
import { createBlock, getData, getModel, initPlans, saveData } from './plans';
import { migrateBlocksToIds } from './blocks';

const MODEL_ID = 'bloques-r1';

function bloque(overrides: Partial<Block> = {}): Block {
  return { type: 'single', sets: 3, restBetweenSetsSec: 60, exercises: [], ...overrides };
}

function modelo(blocks: Block[]): Model {
  return { id: MODEL_ID, name: 'Rutina de bloques', intensity: 1, totalTimeMin: 20, blocks };
}

function catalogo(blocks: Block[]): PlanData {
  return {
    categories: [
      {
        id: 'bloques',
        name: 'Bloques',
        description: '',
        programs: [
          {
            id: 'bloques-casa',
            categoryId: 'bloques',
            name: 'Bloques en casa',
            level: 'beginner',
            description: '',
            objectives: [],
            goals: [],
            frequency: '',
            restBetweenSessions: '',
            rules: [],
            models: [modelo(blocks)],
          },
        ],
      },
    ],
  };
}

function bloquesEnMemoria(): Block[] {
  return getModel(MODEL_ID)?.model.blocks ?? [];
}

async function idsPersistidos(): Promise<(string | undefined)[]> {
  const stored = await plansRepository.load();
  const blocks = (stored?.categories ?? [])
    .flatMap((c) => c.programs)
    .flatMap((p) => p.models)
    .flatMap((m) => m.blocks);
  return blocks.map((b) => b.id);
}

describe('migrateBlocksToIds', () => {
  beforeEach(async () => {
    const db = await getDB();
    await db.clear('plans');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('asigna un id a los bloques que no lo tienen y lo persiste una sola vez', async () => {
    await saveData(
      catalogo([
        bloque(),
        bloque({ sets: 2, restBetweenSetsSec: 45 }),
        bloque({ type: 'biseries', sets: 1, restBetweenSetsSec: 30 }),
      ]),
    );
    const save = vi.spyOn(plansRepository, 'save');

    await migrateBlocksToIds();

    expect(bloquesEnMemoria().map((b) => b.id)).toEqual([
      'block-single',
      'block-single-2',
      'block-biseries',
    ]);
    expect(save).toHaveBeenCalledTimes(1);
    expect(await idsPersistidos()).toEqual(['block-single', 'block-single-2', 'block-biseries']);
  });

  it('es idempotente: una segunda pasada no cambia ids ni vuelve a escribir', async () => {
    await saveData(catalogo([bloque(), bloque({ type: 'superseries' })]));
    await migrateBlocksToIds();
    const primera = bloquesEnMemoria().map((b) => b.id);
    const save = vi.spyOn(plansRepository, 'save');

    await migrateBlocksToIds();

    expect(bloquesEnMemoria().map((b) => b.id)).toEqual(primera);
    expect(save).not.toHaveBeenCalled();
    expect(await idsPersistidos()).toEqual(primera);
  });

  it('no toca los bloques que ya tienen id', async () => {
    await saveData(catalogo([bloque({ id: 'bloque-editado-a-mano' }), bloque({ sets: 2 })]));
    const save = vi.spyOn(plansRepository, 'save');

    await migrateBlocksToIds();

    expect(bloquesEnMemoria().map((b) => b.id)).toEqual(['bloque-editado-a-mano', 'block-single']);
    expect(await idsPersistidos()).toEqual(['bloque-editado-a-mano', 'block-single']);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('deja intactos los datos del bloque al asignar el id', async () => {
    await saveData(
      catalogo([
        bloque({ type: 'biseries', sets: 4, restBetweenSetsSec: 90, restBetweenExercisesSec: 30 }),
      ]),
    );

    await migrateBlocksToIds();

    expect(bloquesEnMemoria()[0]).toEqual({
      id: 'block-biseries',
      type: 'biseries',
      sets: 4,
      restBetweenSetsSec: 90,
      restBetweenExercisesSec: 30,
      exercises: [],
    });
  });

  it('initPlans deja un id a cada bloque antes del primer render', async () => {
    await saveData(catalogo([bloque(), bloque({ type: 'biseries' })]));

    await initPlans();

    expect(bloquesEnMemoria().map((b) => b.id)).toEqual(['block-single', 'block-biseries']);
    expect(await idsPersistidos()).toEqual(['block-single', 'block-biseries']);
  });

  it('en una instalación nueva siembra ya con ids y conserva el timestamp congelado del seed', async () => {
    await initPlans();

    const blocks = getData().categories
      .flatMap((c) => c.programs)
      .flatMap((p) => p.models)
      .flatMap((m) => m.blocks);
    expect(blocks.length).toBeGreaterThan(0);
    expect(blocks.every((b) => typeof b.id === 'string' && b.id.length > 0)).toBe(true);

    const db = await getDB();
    const rows = (await db.getAll('plans')) as { category?: unknown; updatedAt?: string }[];
    const stamps = rows.filter((row) => row.category != null).map((row) => row.updatedAt);
    expect(stamps.length).toBeGreaterThan(0);
    expect(stamps.every((stamp) => stamp === SEED_UPDATED_AT)).toBe(true);
  });
});

describe('createBlock', () => {
  beforeEach(async () => {
    const db = await getDB();
    await db.clear('plans');
  });

  it('asigna id al bloque nuevo y conserva su payload y su posición', async () => {
    await saveData(catalogo([bloque({ id: 'existente' })]));

    await createBlock(MODEL_ID, bloque({ sets: 2, restBetweenSetsSec: 45, restBetweenExercisesSec: 20 }));

    expect(bloquesEnMemoria().map((b) => b.type)).toEqual(['single', 'single']);
    expect(bloquesEnMemoria()[1]).toEqual({
      id: 'block-single',
      type: 'single',
      sets: 2,
      restBetweenSetsSec: 45,
      restBetweenExercisesSec: 20,
      exercises: [],
    });
    expect(await idsPersistidos()).toEqual(['existente', 'block-single']);
  });

  it('respeta el id que ya trae el bloque creado', async () => {
    await saveData(catalogo([]));

    await createBlock(MODEL_ID, bloque({ id: 'bloque-importado' }));

    expect(bloquesEnMemoria().map((b) => b.id)).toEqual(['bloque-importado']);
  });
});
