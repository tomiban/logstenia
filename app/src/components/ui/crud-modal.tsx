import { useState } from 'react';
import { Button } from './button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from './dialog';

export type CrudMode = 'create' | 'edit';

export interface CrudModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: CrudMode;
  createTitle: string;
  editTitle: string;
  children: React.ReactNode;
  onSubmit: () => void | Promise<void>;
  submitLabel?: string;
  cancelLabel?: string;
  className?: string;
}

export function CrudModal({
  open,
  onOpenChange,
  mode,
  createTitle,
  editTitle,
  children,
  onSubmit,
  submitLabel,
  cancelLabel = 'Cancelar',
  className,
}: CrudModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const title = mode === 'create' ? createTitle : editTitle;
  const label = submitLabel ?? (mode === 'create' ? 'Crear' : 'Guardar');

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await onSubmit();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={className}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {children}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
            {cancelLabel}
          </Button>
          <Button variant="accent" onClick={handleSubmit} disabled={submitting}>
            {label}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export interface UseCrudModalResult<T> {
  open: boolean;
  mode: CrudMode;
  item: T | null;
  openCreate: () => void;
  openEdit: (item: T) => void;
  close: () => void;
}

export function useCrudModal<T>(): UseCrudModalResult<T> {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<CrudMode>('create');
  const [item, setItem] = useState<T | null>(null);

  const openCreate = () => {
    setMode('create');
    setItem(null);
    setOpen(true);
  };

  const openEdit = (it: T) => {
    setMode('edit');
    setItem(it);
    setOpen(true);
  };

  const close = () => setOpen(false);

  return { open, mode, item, openCreate, openEdit, close };
}
