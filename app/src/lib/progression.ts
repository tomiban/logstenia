import { db } from '../db';

export const PROGRESSION_CHAINS: Record<string, string[]> = {
  planche: ['planche-tuck', 'planche-tuckadv', 'planche-straddle', 'planche-full'],
  'front lever': ['front-semi', 'front-full'],
  hefesto: ['hefesto-principiantes', 'backlever-hefesto'],
  fuerza: ['fuerza-principiantes', 'fuerza-intermedios', 'fuerza-avanzados'],
};

export interface Anchor { ejercicio: string; unidad: 'sec' | 'reps'; objetivo: number; }

const CHAIN_ANCHORS: Record<string, Anchor[]> = {
  planche: [{ ejercicio: 'Tuck planche', unidad: 'sec', objetivo: 10 }],
  'front lever': [{ ejercicio: 'Tuck front lever', unidad: 'sec', objetivo: 10 }],
  handstand: [{ ejercicio: 'Isometrico pino en pared', unidad: 'sec', objetivo: 20 }],
  hefesto: [{ ejercicio: 'Isometrico pino en pared', unidad: 'sec', objetivo: 20 }],
  fuerza: [],
};

// Fuerza anchors depend on the step index
function fuerzaAnchors(idx: number): Anchor[] {
  if (idx <= 0) return [];
  if (idx === 1) return [
    { ejercicio: 'Dominadas pronas', unidad: 'reps', objetivo: 10 },
    { ejercicio: 'Fondos en paralelas', unidad: 'reps', objetivo: 10 },
    { ejercicio: 'Australian pull ups', unidad: 'reps', objetivo: 15 },
    { ejercicio: 'Flexiones en pica', unidad: 'reps', objetivo: 8 },
    { ejercicio: 'Leg raises colgado', unidad: 'reps', objetivo: 8 },
  ];
  if (idx === 2) return [
    { ejercicio: 'Dominadas explosivas', unidad: 'reps', objetivo: 10 },
    { ejercicio: 'Fondos explosivos', unidad: 'reps', objetivo: 10 },
    { ejercicio: 'Isometrico pino en pared', unidad: 'sec', objetivo: 30 },
    { ejercicio: 'Leg raises (1 mano)', unidad: 'reps', objetivo: 5 },
    { ejercicio: 'Flexiones lean planche', unidad: 'reps', objetivo: 8 },
  ];
  return [];
}

function chainKey(programId: string): string | null {
  for (const [k, chain] of Object.entries(PROGRESSION_CHAINS)) {
    if (chain.includes(programId)) return k;
  }
  return null;
}

export function chainFor(programId: string): string[] | null {
  const key = chainKey(programId);
  return key ? PROGRESSION_CHAINS[key] : null;
}

export function isBenchmark(modelId: string, modelName?: string): boolean {
  return modelId.endsWith('-benchmark') || modelId.endsWith('pro1') || (modelName || '').toUpperCase() === 'PRO1';
}

export async function getProgressionIndex(programId: string): Promise<number> {
  const key = `progression:${programId}`;
  const rec = await db.settings.get(key);
  if (rec) return Number(rec.value) || 0;
  const chain = chainFor(programId);
  if (!chain) return 0;
  return chain.indexOf(programId);
}

export async function setProgressionIndex(programId: string, index: number): Promise<void> {
  await db.settings.put({ key: `progression:${programId}`, value: index });
}

export async function advanceProgression(programId: string): Promise<{ advanced: boolean; next?: string }> {
  const chain = chainFor(programId);
  if (!chain) return { advanced: false };
  const idx = await getProgressionIndex(programId);
  const cur = chain.indexOf(programId);
  const base = Math.max(idx, cur);
  if (base >= chain.length - 1) return { advanced: false };
  const next = chain[base + 1];
  for (const pid of chain) {
    await setProgressionIndex(pid, base + 1);
  }
  return { advanced: true, next };
}

// A program in a progression chain (beyond the first step) is locked until the
// previous step's anchor mark meets its objective (marks routine).
export async function anchorsFor(programId: string): Promise<Anchor[]> {
  const chain = chainFor(programId);
  if (!chain) return [];
  const idx = chain.indexOf(programId);
  if (idx <= 0) return [];
  const key = chainKey(programId)!;
  if (key === 'fuerza') return fuerzaAnchors(idx);
  return CHAIN_ANCHORS[key] || [];
}

export async function isUnlocked(programId: string): Promise<boolean> {
  const anchors = await anchorsFor(programId);
  if (anchors.length === 0) return true;
  const marks = await db.marks.toArray();
  return anchors.every((a) => {
    const best = marks.filter((m) => m.exercise === a.ejercicio).reduce((acc, m) => Math.max(acc, m.value), 0);
    return best >= a.objetivo;
  });
}

export async function unlockedReason(programId: string): Promise<string | null> {
  const unlocked = await isUnlocked(programId);
  if (unlocked) return null;
  const anchors = await anchorsFor(programId);
  const marks = await db.marks.toArray();
  const missing = anchors
    .filter((a) => {
      const best = marks.filter((m) => m.exercise === a.ejercicio).reduce((acc, m) => Math.max(acc, m.value), 0);
      return best < a.objetivo;
    })
    .map((a) => `${a.ejercicio} ≥ ${a.objetivo} ${a.unidad}`)
    .join(', ');
  return `Bloqueado: registrá marcas de ${missing} en la rutina de marcas.`;
}
