import { describe, expect, it } from 'vitest';
import type { Category, Model } from '@/types';
import type { SessionRecord } from '@/db';
import { destinoDeHoy, bloquesDe, dosisDeBloque } from './hoy';

const modelo = (id: string, name: string): Model => ({
  id,
  name,
  intensity: 2,
  totalTimeMin: 40,
  blocks: [
    {
      type: 'single',
      sets: 3,
      restBetweenSetsSec: 120,
      exercises: [{ id: `${id}-e1`, name: 'Dominadas', reps: '4-6' }],
    },
    {
      type: 'biseries',
      sets: 2,
      restBetweenSetsSec: 90,
      exercises: [
        { id: `${id}-e2`, name: 'Fondos', reps: '6-10' },
        { id: `${id}-e3`, name: 'Remo', timeSec: 20 },
      ],
    },
  ],
});

const programa = (id: string, modelos: Model[]): Category => ({
  id: `cat-${id}`,
  name: 'Categoría',
  description: '',
  programs: [
    {
      id,
      categoryId: `cat-${id}`,
      name: `Programa ${id}`,
      level: 'intermediate',
      description: '',
      objectives: [],
      goals: [],
      frequency: '',
      restBetweenSessions: '',
      rules: [],
      models: modelos,
    },
  ],
});

const sesion = (planId: string, modelId: string, date: string, completed = true): SessionRecord => ({
  id: `${planId}-${modelId}-${date}`,
  date,
  planId,
  modelId,
  durationSec: 1800,
  completed,
  updatedAt: `${date}T10:00:00.000Z`,
});

const catalogo = [programa('a', [modelo('a1', 'Modelo A1'), modelo('a2', 'Modelo A2'), modelo('a3', 'Modelo A3')])];

describe('destinoDeHoy', () => {
  it('sin sesiones y sin planes empezados no inventa un destino', () => {
    expect(destinoDeHoy(catalogo, [], '2026-10-28')).toBeNull();
    expect(destinoDeHoy(catalogo, [], '2026-10-28', [])).toBeNull();
  });

  it('un plan empezado sin sesiones ya tiene destino: su primera rutina', () => {
    const destino = destinoDeHoy(catalogo, [], '2026-10-28', ['a']);
    expect(destino?.prog.id).toBe('a');
    expect(destino?.model.id).toBe('a1');
    expect(destino?.nuevo).toBe(true);
  });

  it('el historial manda sobre los planes empezados', () => {
    const sesiones = [sesion('a', 'a2', '2026-10-27')];
    const destino = destinoDeHoy(catalogo, sesiones, '2026-10-28', ['a']);
    expect(destino?.model.id).toBe('a3');
    expect(destino?.nuevo).toBe(false);
  });

  it('saltea un plan empezado que ya no existe o no tiene rutinas', () => {
    const conVacio = [
      ...catalogo,
      { ...programa('c', []), id: 'cat-c', programs: [{ ...programa('c', []).programs[0], id: 'c' }] },
    ];
    const destino = destinoDeHoy(conVacio, [], '2026-10-28', ['fantasma', 'c', 'a']);
    expect(destino?.prog.id).toBe('a');
    expect(destino?.nuevo).toBe(true);
  });

  it('sigue al programa entrenado más recientemente con el modelo siguiente', () => {
    const sesiones = [sesion('a', 'a1', '2026-10-26'), sesion('a', 'a2', '2026-10-27')];
    const destino = destinoDeHoy(catalogo, sesiones, '2026-10-28');
    expect(destino?.prog.id).toBe('a');
    expect(destino?.model.id).toBe('a3');
    expect(destino?.hoyCompletada).toBe(false);
  });

  it('al terminar el programa vuelve al primer modelo', () => {
    const sesiones = [sesion('a', 'a3', '2026-10-27')];
    expect(destinoDeHoy(catalogo, sesiones, '2026-10-28')?.model.id).toBe('a1');
  });

  it('si ya entrenó hoy, hoy sigue siendo ese modelo', () => {
    const sesiones = [sesion('a', 'a1', '2026-10-27'), sesion('a', 'a2', '2026-10-28')];
    const destino = destinoDeHoy(catalogo, sesiones, '2026-10-28');
    expect(destino?.model.id).toBe('a2');
    expect(destino?.hoyCompletada).toBe(true);
  });

  it('gana el programa de la última sesión completada', () => {
    const dos = [
      ...catalogo,
      programa('b', [modelo('b1', 'Modelo B1'), modelo('b2', 'Modelo B2')]),
    ];
    const sesiones = [sesion('a', 'a2', '2026-10-20'), sesion('b', 'b1', '2026-10-27')];
    const destino = destinoDeHoy(dos, sesiones, '2026-10-28');
    expect(destino?.prog.id).toBe('b');
    expect(destino?.model.id).toBe('b2');
  });

  it('una sesión abandonada no adelanta el programa', () => {
    const sesiones = [sesion('a', 'a1', '2026-10-26'), sesion('a', 'a2', '2026-10-27', false)];
    expect(destinoDeHoy(catalogo, sesiones, '2026-10-28')?.model.id).toBe('a2');
  });

  it('ignora sesiones de un programa que ya no está en el catálogo', () => {
    const sesiones = [sesion('fantasma', 'x1', '2026-10-27')];
    expect(destinoDeHoy(catalogo, sesiones, '2026-10-28')).toBeNull();
  });
});

describe('bloques y dosis', () => {
  const m = modelo('a1', 'Modelo A1');

  it('cuenta los bloques del modelo', () => {
    expect(bloquesDe(m)).toHaveLength(2);
  });

  it('nombra el bloque con sus ejercicios, sin numeración del PDF', () => {
    expect(bloquesDe(m)[1].nombre).toBe('Fondos ＋ Remo');
  });

  it('declara la dosis con series, objetivo y descanso', () => {
    expect(dosisDeBloque(m.blocks[0])).toBe('3 series · 4-6 reps · descanso 120s');
    expect(dosisDeBloque(m.blocks[1])).toBe('2 series · 6-10 reps ＋ 20 seg · descanso 90s');
  });
});
