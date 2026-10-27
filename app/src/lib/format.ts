/** UI copy helpers: the one place Spanish agreement is decided. */

/**
 * The word that follows a count: `pluralForm(1, 'programa', 'programas')` → `programa`.
 * Zero takes the plural, as Spanish does ("0 programas").
 */
export function pluralForm(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}
