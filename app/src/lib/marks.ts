import { db, type MarkRecord } from '../db';

export const ANCLAS: { ejercicio: string; unidad: 'sec' | 'reps'; objetivo: number }[] = [
  { ejercicio: 'Tuck front lever', unidad: 'sec', objetivo: 10 },
  { ejercicio: 'Tuck planche', unidad: 'sec', objetivo: 10 },
  { ejercicio: 'Isometrico pino en pared', unidad: 'sec', objetivo: 20 },
  { ejercicio: 'Dominadas pronas', unidad: 'reps', objetivo: 10 },
  { ejercicio: 'Fondos en paralelas', unidad: 'reps', objetivo: 10 },
  { ejercicio: 'Flexiones', unidad: 'reps', objetivo: 15 },
  // Fuerza - nivel 1 (para pasar a nivel 2)
  { ejercicio: 'Dominadas pronas', unidad: 'reps', objetivo: 10 },
  { ejercicio: 'Fondos en paralelas', unidad: 'reps', objetivo: 10 },
  { ejercicio: 'Australian pull ups', unidad: 'reps', objetivo: 15 },
  { ejercicio: 'Flexiones en pica', unidad: 'reps', objetivo: 8 },
  { ejercicio: 'Leg raises colgado', unidad: 'reps', objetivo: 8 },
  // Fuerza - nivel 2 (para pasar a nivel 3)
  { ejercicio: 'Dominadas explosivas', unidad: 'reps', objetivo: 10 },
  { ejercicio: 'Fondos explosivos', unidad: 'reps', objetivo: 10 },
  { ejercicio: 'Isometrico pino en pared', unidad: 'sec', objetivo: 30 },
  { ejercicio: 'Leg raises (1 mano)', unidad: 'reps', objetivo: 5 },
  { ejercicio: 'Flexiones lean planche', unidad: 'reps', objetivo: 8 },
];

export async function getMarks(mesoInicio: string): Promise<MarkRecord[]> {
  return db.marks.where('mesoInicio').equals(mesoInicio).toArray();
}

export async function saveMark(m: Omit<MarkRecord, 'id'>): Promise<void> {
  await db.marks.add(m as MarkRecord);
}

export async function hasMark(ejercicio: string, mesoInicio: string, date: string): Promise<boolean> {
  const all = await db.marks.where('mesoInicio').equals(mesoInicio).toArray();
  return all.some((m) => m.exercise === ejercicio && m.date === date);
}
