import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { addTag, removeTag, getTags, getSuggestedTags, allTags, tagPastel } from '../../lib/tags';
import type { TagTargetType } from '../../lib/tags';
import { Button } from './button';
import { Input } from './input';
import { cn } from '../../lib/utils';

export interface TagsInputProps {
  targetType: TagTargetType;
  targetId: string;
  className?: string;
  allowAdd?: boolean;
}

export function TagsInput({ targetType, targetId, className, allowAdd = true }: TagsInputProps) {
  const [tags, setTags] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [suggested, setSuggested] = useState<string[]>([]);
  const [allTagsList, setAllTagsList] = useState<string[]>([]);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const reload = async () => setTags(await getTags(targetType, targetId));
  useEffect(() => { getSuggestedTags().then(setSuggested).catch(() => {}); allTags().then(setAllTagsList).catch(() => {}); }, []);
  useEffect(() => { reload(); }, [targetType, targetId]);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    const width = 256;
    setPos({ top: r.bottom + 4, left: Math.max(8, r.right - width) });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t)) return;
      if (popoverRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

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

  return (
    <div ref={rootRef} className={cn('relative inline-flex flex-wrap items-center gap-1.5', className)} onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
      {tags.map((t) => {
        const c = tagPastel(t);
        return (
          <span
            key={t}
            className="inline-flex items-center gap-1 rounded-none border border-[var(--border)] px-1.5 py-0.5 label-status"
            style={{ backgroundColor: c.bg, color: c.text }}
          >
            {t}
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRemove(t); }}
              className="ml-0.5 opacity-60 hover:opacity-100"
              aria-label={`quitar ${t}`}
            >
              ×
            </button>
          </span>
        );
      })}

      {allowAdd && (
        <button
          ref={triggerRef}
          type="button"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((o) => !o); }}
          className="inline-flex h-5 w-5 items-center justify-center border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--ink)] hover:border-[var(--ink)] label-status"
          aria-label="Agregar etiqueta"
          aria-expanded={open}
        >
          ⋯
        </button>
      )}

      {open && allowAdd && pos && createPortal(
        <div
          ref={popoverRef}
          className="fixed z-50 w-64 border border-[var(--border)] bg-[var(--surface)] p-2"
          style={{ top: pos.top, left: pos.left }}
        >
          <div className="flex gap-2">
            <Input
              className="h-7 rounded-none"
              placeholder="nueva etiqueta"
              value={value}
              autoFocus
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); onAdd(); }
                if (e.key === 'Escape') setOpen(false);
              }}
            />
            <Button variant="outline" size="sm" className="h-7 rounded-none" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onAdd(); }}>+</Button>
          </div>
          {(() => {
            const q = value.trim().toLowerCase();
            const matches = allTagsList.filter((t) => !tags.includes(t) && (q === '' || t.includes(q)));
            if (matches.length === 0) return null;
            return (
              <div className="mt-2 flex flex-wrap gap-1">
                {matches.slice(0, 12).map((t) => (
                  <Button
                    key={t}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-6 rounded-none label-caps"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); onAdd(t); }}
                  >
                    + {t}
                  </Button>
                ))}
              </div>
            );
          })()}
          {availableSuggested.length > 0 && value.trim() === '' && (
            <div className="mt-2 flex flex-wrap gap-1">
              {availableSuggested.map((t) => (
                <Button
                  key={t}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-6 rounded-none label-caps"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); onAdd(t); }}
                >
                  + {t}
                </Button>
              ))}
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}
