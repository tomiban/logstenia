import { useState, useEffect } from 'react';
import { Input } from './input';
import { Button } from './button';

export function Editable({ value, onSave, className = '' }: { value: string; onSave: (v: string) => void | Promise<void>; className?: string }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value);
  useEffect(() => setVal(value), [value]);
  if (editing) {
    return (
      <span className={`inline-flex items-center gap-1 ${className}`}>
        <Input value={val} onChange={(e) => setVal(e.target.value)} className="h-7 w-56" />
        <Button size="sm" onClick={async () => { await onSave(val); setEditing(false); }}>OK</Button>
        <Button size="sm" variant="ghost" onClick={() => { setVal(value); setEditing(false); }}>✕</Button>
      </span>
    );
  }
  return (
    <span className={`cursor-pointer hover:underline ${className}`} onClick={() => setEditing(true)} title="Click para editar">{value}</span>
  );
}
