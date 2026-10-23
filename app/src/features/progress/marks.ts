import { createMarkRepository } from '@/repositories';
import type { MarkRecord } from '@/repositories';
import plansData from '@/data/plans.json';

const markRepository = createMarkRepository();

export const ANCLAS: { ejercicio: string; match?: string; ejercicioId?: string; unidad: 'sec' | 'reps'; objetivo: number }[] = [
  { ejercicio: 'Tuck planche', ejercicioId: 'tuck-planche', unidad: 'sec', objetivo: 10 },
  { ejercicio: 'Tuck adv front lever', ejercicioId: 'tuck-adv-front-lever', match: 'Hold Tuck Adv. FL', unidad: 'sec', objetivo: 10 },
  { ejercicio: 'Handstand pared', ejercicioId: 'handstand-pared', match: 'Hold de pino en pared', unidad: 'sec', objetivo: 30 },
  { ejercicio: 'Dominadas pronas', unidad: 'reps', objetivo: 10 },
];

// Build a name -> id lookup from plans.json (first occurrence wins).
const EXERCISE_ID_BY_NAME = new Map<string, string>();
for (const c of (plansData as any).categories) {
  for (const p of c.programs) {
    for (const m of p.models) {
      for (const b of m.blocks) {
        for (const e of b.exercises) {
          if (e.id && !EXERCISE_ID_BY_NAME.has(e.name)) {
            EXERCISE_ID_BY_NAME.set(e.name, e.id);
          }
        }
      }
    }
  }
}

export function exerciseIdFor(name: string): string | undefined {
  return EXERCISE_ID_BY_NAME.get(name);
}

export async function getMarks(mesoInicio: string): Promise<MarkRecord[]> {
  return markRepository.listWhere('mesoInicio', mesoInicio);
}

export async function getMarksByExercise(exerciseId: string, mesoInicio?: string): Promise<MarkRecord[]> {
  const all = await markRepository.list();
  return all.filter((m: MarkRecord) => {
    const id = m.exerciseId ?? exerciseIdFor(m.exercise);
    if (id !== exerciseId) return false;
    if (mesoInicio && m.mesoInicio !== mesoInicio) return false;
    return true;
  });
}

export async function saveMark(
  m: Omit<MarkRecord, 'id' | 'updatedAt' | 'deletedAt'>,
): Promise<void> {
  await markRepository.add({
    ...m,
    exerciseId: m.exerciseId ?? exerciseIdFor(m.exercise),
  });
}

export async function hasMark(exercise: string, mesoInicio: string, date: string): Promise<boolean> {
  const id = exerciseIdFor(exercise);
  const all = await markRepository.listWhere('mesoInicio', mesoInicio);
  return all.some((m: MarkRecord) => {
    const mid = m.exerciseId ?? exerciseIdFor(m.exercise);
    return (id ? mid === id : m.exercise === exercise) && m.date === date;
  });
}

// One-time migration: fill exerciseId on marks that lack it.
export async function migrateMarksToIds(): Promise<void> {
  await markRepository.migrateExerciseIds(exerciseIdFor);
}