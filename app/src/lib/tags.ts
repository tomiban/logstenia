import { createSettingsRepository, createTagRepository } from '@/repositories';
import type { InsertRow, TagRecord } from '@/repositories';

export type TagTargetType = 'exercise' | 'routine' | 'program';
export const TAGS_CHANGED_EVENT = 'logstenia:tags-changed';

const tagRepository = createTagRepository();
const settingsRepository = createSettingsRepository();

function notifyTagsChanged(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(TAGS_CHANGED_EVENT));
  }
}

export async function getTags(targetType: TagTargetType, targetId: string): Promise<string[]> {
  const rows = await tagRepository.listWhere('[targetType+targetId]', [targetType, targetId]);
  return [...new Set(rows.map((r) => r.tag))];
}

export async function addTag(targetType: TagTargetType, targetId: string, tag: string): Promise<void> {
  const t = tag.trim().toLowerCase();
  if (!t) return;
  const rows = await tagRepository.listWhere('[targetType+targetId]', [targetType, targetId]);
  if (rows.some((r) => r.tag === t)) return;
  await tagRepository.add({ targetType, targetId, tag: t });
  notifyTagsChanged();
}

/**
 * Idempotent bulk seed of the tags a plan declares: writes only the pairs that have no live
 * row, in one transaction, so a catalogue of hundreds of exercises costs one write instead of
 * one per exercise. Silent by design — it runs before the first render, so no screen is
 * listening yet.
 */
export async function seedTags(
  targetType: TagTargetType,
  entries: Iterable<readonly [string, readonly string[]]>,
): Promise<void> {
  const stored = await tagRepository.list();
  const present = new Set(
    stored.filter((row) => row.targetType === targetType).map((row) => `${row.targetId}\u0000${row.tag}`),
  );

  const missing: InsertRow<TagRecord>[] = [];
  for (const [targetId, tags] of entries) {
    for (const tag of tags) {
      const t = tag.trim().toLowerCase();
      if (!t || present.has(`${targetId}\u0000${t}`)) continue;
      present.add(`${targetId}\u0000${t}`);
      missing.push({ targetType, targetId, tag: t });
    }
  }

  if (missing.length > 0) await tagRepository.bulkPut(missing);
}

export async function removeTag(targetType: TagTargetType, targetId: string, tag: string): Promise<void> {
  const rows = await tagRepository.listWhere('[targetType+targetId]', [targetType, targetId]);
  let removed = false;
  for (const r of rows) {
    if (r.tag !== tag || r.id == null) continue;
    await tagRepository.softDelete(r.id);
    removed = true;
  }
  if (removed) notifyTagsChanged();
}

export const DEFAULT_SUGGESTED_TAGS: string[] = ['empuje', 'tirón', 'movilidad', 'flexibilidad', 'calentamiento'];

export async function getSuggestedTags(): Promise<string[]> {
  const r = await settingsRepository.get('tags.suggested');
  const stored = (r?.value as string[]) || [];
  return [...new Set([...DEFAULT_SUGGESTED_TAGS, ...stored])].sort();
}

export async function addSuggestedTag(tag: string): Promise<void> {
  const t = tag.trim().toLowerCase();
  if (!t) return;
  const cur = await getSuggestedTags();
  if (cur.includes(t)) return;
  const r = await settingsRepository.get('tags.suggested');
  const stored = (r?.value as string[]) || [];
  await settingsRepository.put({ key: 'tags.suggested', value: [...stored, t] });
}

export async function allTags(): Promise<string[]> {
  const rows = await tagRepository.list();
  return [...new Set(rows.map((r) => r.tag))].sort();
}

export async function targetsByTag(tag: string, targetType?: TagTargetType): Promise<string[]> {
  const rows = await tagRepository.listWhere('tag', tag);
  return rows.filter((r) => (targetType ? r.targetType === targetType : true)).map((r) => r.targetId);
}


export const TAG_PASTELS: { bg: string; text: string }[] = [
  { bg: '#fef3c7', text: '#78350f' },
  { bg: '#dbeafe', text: '#1e3a8a' },
  { bg: '#dcfce7', text: '#14532d' },
  { bg: '#fce7f3', text: '#831843' },
  { bg: '#ede9fe', text: '#4c1d95' },
  { bg: '#ffedd5', text: '#7c2d12' },
  { bg: '#cffafe', text: '#155e75' },
  { bg: '#f3e8ff', text: '#581c87' },
];

export function tagPastel(tag: string): { bg: string; text: string } {
  let h = 0;
  for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) >>> 0;
  return TAG_PASTELS[h % TAG_PASTELS.length];
}
