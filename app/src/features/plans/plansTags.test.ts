import { beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import type { Block, Exercise, Model, PlanData } from '@/types';
import { getDB } from '@/db/open';
import { createTagRepository } from '@/repositories';
import { getTags } from '@/lib/tags';
import { initPlans, saveData } from './plans';

const MODEL_ID = 'tags-r1';
const tagRepository = createTagRepository();

function ejercicio(overrides: Partial<Exercise> = {}): Exercise {
  return { name: 'Ejercicio', ...overrides };
}

function bloque(exercises: Exercise[]): Block {
  return { type: 'single', sets: 3, restBetweenSetsSec: 60, exercises };
}

function modelo(blocks: Block[], tags?: string[]): Model {
  return { id: MODEL_ID, name: 'Rutina de etiquetas', intensity: 1, totalTimeMin: 20, blocks, tags };
}

function catalogo(blocks: Block[], modelTags?: string[]): PlanData {
  return {
    categories: [
      {
        id: 'tags',
        name: 'Etiquetas',
        description: '',
        programs: [
          {
            id: 'tags-casa',
            categoryId: 'tags',
            name: 'Etiquetas en casa',
            level: 'beginner',
            description: '',
            objectives: [],
            goals: [],
            frequency: '',
            restBetweenSessions: '',
            rules: [],
            models: [modelo(blocks, modelTags)],
          },
        ],
      },
    ],
  };
}

async function filasDeEtiquetas() {
  return tagRepository.list();
}

describe('siembra del espejo de etiquetas al cargar el catálogo', () => {
  beforeEach(async () => {
    const db = await getDB();
    await db.clear('plans');
    await db.clear('tags');
  });

  it('marca isometricos con la misma regla que usa el runner', async () => {
    await saveData(
      catalogo([
        bloque([
          ejercicio({ id: 'plancha', name: 'Plancha', timeSec: 30 }),
          ejercicio({ id: 'dominadas', name: 'Dominadas', reps: '8' }),
          ejercicio({ id: 'hold-fl', name: 'Hold FL', reps: '5', tags: ['isometricos'] }),
          ejercicio({ id: 'sentadilla', name: 'Sentadilla', timeSec: 40, reps: '10' }),
        ]),
      ]),
    );

    await initPlans();

    expect(await getTags('exercise', 'plancha')).toEqual(['isometricos']);
    expect(await getTags('exercise', 'dominadas')).toEqual([]);
    expect(await getTags('exercise', 'hold-fl')).toEqual(['isometricos']);
    expect(await getTags('exercise', 'sentadilla')).toEqual([]);
  });

  it('escribe una sola fila por ejercicio isométrico, sin tocar el resto', async () => {
    await saveData(
      catalogo([
        bloque([
          ejercicio({ id: 'plancha', name: 'Plancha', timeSec: 30 }),
          ejercicio({ id: 'dominadas', name: 'Dominadas', reps: '8' }),
        ]),
        bloque([ejercicio({ id: 'l-sit', name: 'L-sit', timeSec: 20 })]),
      ]),
    );

    await initPlans();

    const filas = await filasDeEtiquetas();
    expect(filas.map((f) => `${f.targetType}:${f.targetId}:${f.tag}`).sort()).toEqual([
      'exercise:l-sit:isometricos',
      'exercise:plancha:isometricos',
    ]);
  });

  it('es idempotente: recargar el catálogo no duplica filas ni reescribe las existentes', async () => {
    await saveData(catalogo([bloque([ejercicio({ id: 'plancha', name: 'Plancha', timeSec: 30 })])]));
    await initPlans();
    const primera = await filasDeEtiquetas();

    await initPlans();

    expect(await filasDeEtiquetas()).toEqual(primera);
  });

  it('conserva la etiqueta declarada en el modelo', async () => {
    await saveData(catalogo([bloque([ejercicio({ id: 'dominadas', reps: '8' })])], ['fuerza']));

    await initPlans();

    expect(await getTags('routine', MODEL_ID)).toEqual(['fuerza']);
  });
});
