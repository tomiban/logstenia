import { db, type TagRecord } from '../db';

export type TagTargetType = 'exercise' | 'routine' | 'program';
export const TAGS_CHANGED_EVENT = 'logstenia:tags-changed';

function notifyTagsChanged(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(TAGS_CHANGED_EVENT));
  }
}

export async function getTags(targetType: TagTargetType, targetId: string): Promise<string[]> {
  const rows = await db.tags.where('[targetType+targetId]').equals([targetType, targetId]).toArray();
  return [...new Set(rows.map((r) => r.tag))];
}

export async function addTag(targetType: TagTargetType, targetId: string, tag: string): Promise<void> {
  const t = tag.trim().toLowerCase();
  if (!t) return;
  const exists = await db.tags.where('[targetType+targetId]').equals([targetType, targetId]).and((r) => r.tag === t).count();
  if (exists > 0) return;
  await db.tags.add({ targetType, targetId, tag: t } as TagRecord);
  notifyTagsChanged();
}

export async function removeTag(targetType: TagTargetType, targetId: string, tag: string): Promise<void> {
  const rows = await db.tags.where('[targetType+targetId]').equals([targetType, targetId]).and((r) => r.tag === tag).toArray();
  let removed = false;
  for (const r of rows) {
    if (r.id != null) {
      await db.tags.delete(r.id);
      removed = true;
    }
  }
  if (removed) notifyTagsChanged();
}

export const DEFAULT_SUGGESTED_TAGS: string[] = ['empuje', 'tirón', 'movilidad', 'flexibilidad', 'calentamiento'];

export async function getSuggestedTags(): Promise<string[]> {
  const r = await db.settings.get('tags.suggested');
  const stored = (r?.value as string[]) || [];
  return [...new Set([...DEFAULT_SUGGESTED_TAGS, ...stored])].sort();
}

export async function addSuggestedTag(tag: string): Promise<void> {
  const t = tag.trim().toLowerCase();
  if (!t) return;
  const cur = await getSuggestedTags();
  if (cur.includes(t)) return;
  const r = await db.settings.get('tags.suggested');
  const stored = (r?.value as string[]) || [];
  await db.settings.put({ key: 'tags.suggested', value: [...stored, t] });
}

export async function allTags(): Promise<string[]> {
  const rows = await db.tags.toArray();
  return [...new Set(rows.map((r) => r.tag))].sort();
}

export async function targetsByTag(tag: string, targetType?: TagTargetType): Promise<string[]> {
  let q = db.tags.where('tag').equals(tag);
  const rows = await q.toArray();
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
