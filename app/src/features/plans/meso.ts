import { db } from '@/db';
import { toLocalISODate } from '@/lib/date';

export const MESO = { carga: 3, total: 4 } as const;

export async function getMesoInicio(): Promise<string> {
  const r = await db.settings.get('meso.inicio');
  return (r?.value as string) || '';
}

export async function setMesoInicio(v: string): Promise<void> {
  await db.settings.put({ key: 'meso.inicio', value: v });
}

export async function getWarmup(): Promise<boolean> {
  const r = await db.settings.get('warmup');
  return r?.value === true || r?.value === '1';
}

export async function setWarmup(v: boolean): Promise<void> {
  await db.settings.put({ key: 'warmup', value: v });
}

export function addDias(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function lunesDe(d: Date): Date {
  return addDias(d, -((d.getDay() + 6) % 7));
}

export function entreDias(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

export function iso(d: Date): string {
  return toLocalISODate(d);
}
