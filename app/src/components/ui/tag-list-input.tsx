import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { allTags, getSuggestedTags, tagPastel } from '../../lib/tags';
import { cn } from '@/lib/utils';
import { Input } from './input';
import { Popover, PopoverContent, PopoverTrigger } from './popover';

export interface TagListInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  className?: string;
}

export function TagListInput({ value, onChange, className }: TagListInputProps) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [suggested, setSuggested] = useState<string[]>([]);
  const [allTagsList, setAllTagsList] = useState<string[]>([]);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    Promise.all([getSuggestedTags(), allTags()])
      .then(([suggestedTags, tags]) => {
        setSuggested(suggestedTags);
        setAllTagsList(tags);
      })
      .catch((error: unknown) => {
        console.error('Failed to load tag suggestions', error);
        setLoadError(true);
      });
  }, []);

  const onToggle = (tag: string) => {
    const normalizedTag = tag.trim().toLowerCase();
    if (!normalizedTag) return;
    if (value.includes(normalizedTag)) {
      onChange(value.filter((item) => item !== normalizedTag));
    } else {
      onChange([...value, normalizedTag]);
    }
    setInput('');
  };

  const onRemove = (tag: string) => {
    onChange(value.filter((item) => item !== tag));
  };

  const query = input.trim().toLowerCase();
  const pool = [...new Set([...suggested, ...allTagsList])];
  const filtered = pool.filter((tag) => query === '' || tag.includes(query));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div
        className={cn(
          'flex min-h-[2rem] w-full flex-wrap items-center gap-1.5 border border-border bg-card p-2',
          className,
        )}
      >
        {value.map((tag) => {
          const color = tagPastel(tag);
          return (
            <span
              key={tag}
              className="inline-flex items-center gap-1 border border-border px-1.5 py-0.5 label-status"
              style={{ backgroundColor: color.bg, color: color.text }}
            >
              {tag}
              <button
                type="button"
                onClick={() => onRemove(tag)}
                className="ml-0.5 opacity-60 hover:opacity-100"
                aria-label={`quitar ${tag}`}
              >
                ×
              </button>
            </span>
          );
        })}
        <PopoverTrigger className="min-h-7 flex-1 cursor-pointer px-1 text-left text-xs text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring">
          {value.length === 0 ? 'Sin etiquetas (agregar)' : '+ Etiqueta'}
        </PopoverTrigger>
      </div>
      <PopoverContent className="w-(--anchor-width) p-2">
        <Input
          aria-label="Buscar o crear etiqueta"
          className="h-7 text-xs"
          placeholder="Buscar o crear etiqueta"
          value={input}
          autoFocus
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              onToggle(input);
            }
          }}
        />

        {loadError ? (
          <p role="alert" className="mt-2 text-xs text-destructive">
            No se pudieron cargar las etiquetas guardadas.
          </p>
        ) : (
          <div className="mt-2 max-h-40 space-y-0.5 overflow-auto">
            {filtered.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => onToggle(tag)}
                className="flex w-full items-center gap-2 px-2 py-1 text-left text-xs hover:bg-secondary"
              >
                <Check
                  className={cn('size-3', value.includes(tag) ? 'opacity-100' : 'opacity-0')}
                />
                {tag}
              </button>
            ))}
            {input.trim() !== '' && !pool.includes(query) && (
              <button
                type="button"
                onClick={() => onToggle(input)}
                className="flex w-full items-center gap-2 px-2 py-1 text-left text-xs hover:bg-secondary"
              >
                <Check className="size-3 opacity-0" />
                Crear “{input.trim()}”
              </button>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
