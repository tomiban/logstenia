import { useEffect, useState } from 'react';
import { addTag, removeTag, getTags, getSuggestedTags, allTags, tagPastel } from '../../lib/tags';
import type { TagTargetType } from '../../lib/tags';
import { Input } from './input';
import {
  ContextMenuCheckboxItem,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
} from './context-menu';

export interface TagsMenuProps {
  targetType: TagTargetType;
  targetId: string;
}

const norm = (t: string) => t.trim().toLowerCase();

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

  const applied = new Set(tags.map(norm));
  const q = value.trim().toLowerCase();
  const candidates = allTagsList
    .filter((t) => !applied.has(norm(t)))
    .filter((t) => q === '' || norm(t).includes(q));
  const deduped = Array.from(new Map(candidates.map((t) => [norm(t), t])).values());
  const availableSuggested = suggested
    .filter((t) => !applied.has(norm(t)))
    .filter((t) => q === '' || norm(t).includes(q));

  const showCreate = value.trim() !== '' && !allTagsList.some((t) => norm(t) === q);
  const visibleTags = value.trim() === '' ? availableSuggested : deduped;
  const addOrRemove = (tag: string, checked: boolean) => {
    if (checked) {
      void onAdd(tag);
    } else {
      void onRemove(tag);
    }
  };

  return (
    <div className="w-64 p-1.5">
      <Input
        aria-label="Buscar o crear etiqueta"
        className="h-8 text-sm"
        placeholder="Buscar o crear etiqueta"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Enter') {
            e.preventDefault();
            void onAdd();
          }
        }}
      />
      {showCreate && (
        <ContextMenuItem
          className="mt-1"
          onClick={(e) => {
            e.preventDefault();
            void onAdd(value.trim());
          }}
        >
          Crear &ldquo;{value.trim()}&rdquo;
        </ContextMenuItem>
      )}

      {tags.length > 0 && (
        <>
          <ContextMenuSeparator />
          <ContextMenuLabel className="py-0.5 text-[10px] label-caps">Aplicadas</ContextMenuLabel>
          {tags.map((tag) => (
            <ContextMenuCheckboxItem
              key={tag}
              checked
              className="h-6 min-h-6 gap-1 px-1.5 py-0 text-xs label-status focus-visible:ring-1 focus-visible:ring-foreground"
              style={{ backgroundColor: tagPastel(tag).bg, color: tagPastel(tag).text }}
              onCheckedChange={(checked) => addOrRemove(tag, checked)}
            >
              {tag}
            </ContextMenuCheckboxItem>
          ))}
        </>
      )}

      {visibleTags.length > 0 && (
        <>
          {tags.length > 0 && <ContextMenuSeparator />}
          <ContextMenuLabel className="py-0.5 text-[10px] label-caps">{tags.length > 0 ? 'Disponibles' : 'Sugeridas'}</ContextMenuLabel>
          {visibleTags.slice(0, 24).map((tag) => (
            <ContextMenuCheckboxItem
              key={tag}
              checked={false}
              className="h-6 min-h-6 gap-1 px-1.5 py-0 text-xs label-status focus-visible:ring-1 focus-visible:ring-foreground"
              style={{ backgroundColor: tagPastel(tag).bg, color: tagPastel(tag).text }}
              onCheckedChange={(checked) => addOrRemove(tag, checked)}
            >
              {tag}
            </ContextMenuCheckboxItem>
          ))}
        </>
      )}
    </div>
  );
}
