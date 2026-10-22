import { useEffect, useId, useRef, useState } from 'react';
import { Button } from './button';
import { Input } from './input';
import { cn } from '@/lib/utils';

export interface LineListInputProps {
  value: string[];
  onChange: (lines: string[]) => void;
  placeholder?: string;
  className?: string;
}

export function LineListInput({ value, onChange, placeholder, className }: LineListInputProps) {
  const [draft, setDraft] = useState('');
  const idPrefix = useId();
  const nextId = useRef(value.length);
  const [lineIds, setLineIds] = useState(() =>
    value.map((_, index) => `${idPrefix}-${index}`),
  );

  useEffect(() => {
    setLineIds((current) => {
      if (current.length === value.length) return current;
      if (current.length >= value.length) return current.slice(0, value.length);
      return [
        ...current,
        ...Array.from(
          { length: value.length - current.length },
          () => `${idPrefix}-${nextId.current++}`,
        ),
      ];
    });
  }, [idPrefix, value.length]);

  const updateAt = (i: number, v: string) => {
    const next = [...value];
    next[i] = v;
    onChange(next);
  };

  const removeAt = (i: number) => {
    setLineIds((current) => current.filter((_, index) => index !== i));
    onChange(value.filter((_, idx) => idx !== i));
  };

  const addLineId = () => {
    setLineIds((current) => [...current, `${idPrefix}-${nextId.current++}`]);
  };

  const addLine = () => {
    if (draft.trim() === '') {
      addLineId();
      onChange([...value, '']);
      return;
    }
    addLineId();
    onChange([...value, draft.trim()]);
    setDraft('');
  };

  return (
    <div className={cn('space-y-2', className)}>
      {value.map((line, i) => (
        <div key={lineIds[i] ?? `${idPrefix}-${i}`} className="flex gap-2">
          <Input
            value={line}
            placeholder={placeholder}
            onChange={(e) => updateAt(i, e.target.value)}
          />
          <Button type="button" variant="outline" size="sm" onClick={() => removeAt(i)}>
            ×
          </Button>
        </div>
      ))}
      <div className="flex gap-2">
        <Input
          value={draft}
          placeholder={placeholder ?? 'nueva línea'}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); addLine(); }
          }}
        />
        <Button type="button" variant="outline" size="sm" onClick={addLine}>
          + Línea
        </Button>
      </div>
    </div>
  );
}
