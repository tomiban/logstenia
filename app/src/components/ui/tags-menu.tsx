import { useEffect, useState } from 'react';
import { addTag, removeTag, getTags, getSuggestedTags, allTags, tagPastel } from '../../lib/tags';
import type { TagTargetType } from '../../lib/tags';
import { Input } from './input';
import { Button } from './button';

export interface TagsMenuProps {
  targetType: TagTargetType;
  targetId: string;
}

export function TagsMenu({ targetType, targetId }: TagsMenuProps) {
  const [tags, setTags] = useState<string[]>([]);
  const [value, setValue] = useState('');
  const [suggested, setSuggested] = useState<string[]>([]);
  const [allTagsList, setAllTagsList] = useState<string[]>([]);

  const reload = async () => setTags(await getTags(targetType, targetId));
  useEffect(() => { getSuggestedTags().then(setSuggested).catch(() => {}); allTags().then(setAllTagsList).catch(() => {}); }, []);
  useEffect(() => { reload(); }, [targetType, targetId]);

  const onAdd = async (t?: string) => {
    const tag = (t ?? value).trim();
    if (!tag) return;
    await addTag(targetType, targetId, tag);
    setValue('');
    await reload();
  };
  const onRemove = async (t: string) => {
    await removeTag(targetType, targetId, t);
    await reload();
  };

  const availableSuggested = suggested.filter((t) => !tags.includes(t));
  const q = value.trim().toLowerCase();
  const matches = allTagsList.filter((t) => !tags.includes(t) && (q === '' || t.includes(q)));

  return (
    <div className="w-56 space-y-2" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
      <p className="label-caps text-[var(--muted)] px-1">Etiquetas</p>
      <div className="flex gap-1">
        <Input className="h-7 text-xs" placeholder="nueva etiqueta" value={value} onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onAdd(); } }} />
        <Button size="sm" className="h-7 px-2" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onAdd(); }}>+</Button>
      </div>

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {tags.map((t) => {
            const c = tagPastel(t);
            return (
              <span key={t} className="inline-flex items-center gap-1 border border-[var(--border)] px-1.5 py-0.5 label-status" style={{ backgroundColor: c.bg, color: c.text }}>
                {t}
                <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRemove(t); }} className="ml-0.5 opacity-60 hover:opacity-100" aria-label={`quitar ${t}`}>×</button>
              </span>
            );
          })}
        </div>
      )}

      {(matches.length > 0 || availableSuggested.length > 0) && (
        <div className="border-t border-[var(--border)] pt-2">
          <p className="label-caps text-[var(--muted)] px-1 mb-1">Sugerencias</p>
          <div className="max-h-40 overflow-auto space-y-0.5">
            {(value.trim() === '' ? availableSuggested : matches).slice(0, 12).map((t) => (
              <button
                key={t}
                type="button"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onAdd(t); }}
                className="block w-full text-left px-2 py-1 text-xs text-[var(--foreground)] hover:bg-[var(--muted-surface)]"
              >
                + {t}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
