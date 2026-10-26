import type { BlockType } from '@/types';

/** Spanish names for the three block shapes. `biseries` and `superseries` are already Spanish. */
export const BLOCK_TYPE_LABEL: Record<BlockType, string> = {
  single: 'Simple',
  biseries: 'Biserie',
  superseries: 'Superserie',
};

/** Rest length as the user reads it: `120` → `2 min`, `90` → `1 min 30 s`, `45` → `45 s`. */
export function restLabel(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0 s';
  const total = Math.round(seconds);
  if (total < 60) return `${total} s`;
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return rest === 0 ? `${minutes} min` : `${minutes} min ${rest} s`;
}
