import { useEffect, useRef, useState } from 'react';
import { tagPastel } from '../../lib/tags';
import { useTags } from '../../hooks/useTags';
import type { TagTargetType } from '../../lib/tags';
import { Button } from './button';
import { cn } from '@/lib/utils';

export interface TagsInputProps {
  targetType: TagTargetType;
  targetId: string;
  className?: string;
  allowAdd?: boolean;
}

export function TagsInput({ targetType, targetId, className, allowAdd = true }: TagsInputProps) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const { tags, suggested, allTagsList, add, remove } = useTags(targetType, targetId);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const onAdd = async (tag = value) => {
    const trimmed = tag.trim().replace(/,$/, '');
    if (!trimmed || tags.some((existing) => existing.toLowerCase() === trimmed.toLowerCase())) {
      setValue('');
      return;
    }
    await add(trimmed);
    setValue('');
  };

  const query = value.trim().toLowerCase();
  const availableTags = Array.from(
    new Map(
      [...allTagsList, ...suggested]
        .filter((tag) => !tags.some((applied) => applied.toLowerCase() === tag.toLowerCase()))
        .filter((tag) => query === '' || tag.toLowerCase().includes(query))
        .map((tag) => [tag.toLowerCase(), tag]),
    ).values(),
  ).slice(0, 8);
  const canCreate = query !== '' && !availableTags.some((tag) => tag.toLowerCase() === query);

  return (
    <div
      ref={rootRef}
      className={cn('relative min-w-0', className)}
      onClick={(event) => { event.preventDefault(); event.stopPropagation(); }}
    >
      <div className="flex min-h-9 flex-wrap items-center gap-1.5 border border-input bg-card px-2 py-1 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/20">
        {tags.map((tag) => {
          const color = tagPastel(tag);
          return (
            <span
              key={tag}
              className="inline-flex h-6 items-center gap-1 border border-border px-1.5 label-status"
              style={{ backgroundColor: color.bg, color: color.text }}
            >
              {tag}
              {allowAdd && (
                <button
                  type="button"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    void remove(tag);
                  }}
                  className="opacity-60 hover:opacity-100"
                  aria-label={`Quitar etiqueta ${tag}`}
                >
                  ×
                </button>
              )}
            </span>
          );
        })}

        {allowAdd && (
          <input
            value={value}
            onFocus={() => setOpen(true)}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ',') {
                event.preventDefault();
                void onAdd();
              } else if (event.key === 'Backspace' && value === '' && tags.length > 0) {
                void remove(tags[tags.length - 1]);
              } else if (event.key === 'Escape') {
                setOpen(false);
              }
            }}
            className="h-7 min-w-28 flex-1 border-0 bg-transparent px-1 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-0"
            placeholder={tags.length ? 'Agregar etiqueta…' : 'Escribir una etiqueta…'}
            aria-label="Agregar etiqueta"
            aria-expanded={open}
            autoComplete="off"
          />
        )}
      </div>

      {open && allowAdd && (availableTags.length > 0 || canCreate) && (
        <div className="absolute left-0 top-full z-50 mt-1 w-full border border-border bg-card p-2 shadow-none">
          {availableTags.length > 0 && (
            <>
              <p className="label-status mb-1.5 text-muted-foreground">Sugerencias</p>
              <div className="flex flex-wrap gap-1">
                {availableTags.map((tag) => {
                  const color = tagPastel(tag);
                  return (
                    <Button
                      key={tag}
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 min-h-6 border border-border px-1.5 py-0 text-[10px] label-status hover:opacity-80"
                      style={{ backgroundColor: color.bg, color: color.text }}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => { void onAdd(tag); }}
                    >
                      {tag}
                    </Button>
                  );
                })}
              </div>
            </>
          )}
          {canCreate && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-1 h-7 min-h-7 w-full justify-start px-2 text-sm"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => { void onAdd(); }}
            >
              Agregar “{value.trim()}”
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
