import type { Intensity } from '@/types';

/** The select hands back a string; anything outside the three levels falls back to the first. */
export function toIntensity(raw: string | null | undefined): Intensity {
  return raw === '2' ? 2 : raw === '3' ? 3 : 1;
}
