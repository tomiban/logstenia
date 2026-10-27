import type { Level } from '@/types';

export const LEVELS: Level[] = ['beginner', 'intermediate', 'advanced'];

export const LEVEL_LABEL: Record<string, string> = {
  beginner: 'principiante',
  intermediate: 'intermedio',
  advanced: 'avanzado',
};

const LEVEL_TAGS = new Set(Object.values(LEVEL_LABEL));

/**
 * Level a save persists: always the one chosen in the form, never derived from the tags.
 * Anything outside the documented levels falls back to `beginner`.
 */
export function levelForSave(formLevel: string): Level {
  return LEVELS.includes(formLevel as Level) ? (formLevel as Level) : 'beginner';
}

/**
 * Tag list a save persists: the label of the explicit level first, then the user's tags.
 * Level labels written in the tags are replaced by the current one, so the mirror never
 * carries a second, contradicting level.
 */
export function tagsForSave(tags: string[], level: string): string[] {
  const label = LEVEL_LABEL[levelForSave(level)];
  return [...new Set([label, ...tags.filter((tag) => !LEVEL_TAGS.has(tag))])];
}
