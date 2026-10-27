import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCategories } from '@/hooks/usePlans';
import { createCategory, updateCategory, deleteCategory } from './plans';
import { uniqueId } from './ids';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem, ContextMenuSeparator } from '@/components/ui/context-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { pluralForm } from '@/lib/format';

export default function Planes() {
  const cats = useCategories();
  const programCount = cats.reduce((count, category) => count + category.programs.length, 0);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');

  const [editing, setEditing] = useState<{ id: string; name: string; desc: string } | null>(null);
  const [deleting, setDeleting] = useState<{ id: string; name: string } | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const saveNew = async () => {
    if (!newName.trim()) return;
    const existing = new Set(cats.map((c) => c.id));
    const id = uniqueId(newName, existing);
    try {
      await createCategory({ id, name: newName.trim(), description: newDesc.trim(), programs: [] });
      setSaveError(null);
      setNewName('');
      setNewDesc('');
      setCreateOpen(false);
    } catch {
      setSaveError('No se pudo crear la categoría.');
    }
  };

  const saveEdit = async () => {
    if (!editing || !editing.name.trim()) return;
    try {
      await updateCategory(editing.id, { name: editing.name.trim(), description: editing.desc.trim() });
      setSaveError(null);
      setEditing(null);
    } catch {
      setSaveError('No se pudo guardar la categoría.');
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await deleteCategory(deleting.id);
      setSaveError(null);
      setDeleting(null);
    } catch {
      setSaveError('No se pudo borrar la categoría.');
    }
  };

  return (
    <div className="space-y-4">
      <header className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-heading">Planes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            <span className="metric text-foreground">{cats.length}</span>{' '}
            {pluralForm(cats.length, 'categoría', 'categorías')} ·{' '}
            <span className="metric text-foreground">{programCount}</span>{' '}
            {pluralForm(programCount, 'programa', 'programas')}
          </p>
        </div>
        <Button variant="accent" size="lg" onClick={() => setCreateOpen(true)}>
          Nueva categoría
        </Button>
      </header>

      {saveError && (
        <p role="alert" className="border border-ink bg-secondary px-3 py-2 text-sm text-foreground">
          {saveError}
        </p>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva categoría</DialogTitle>
            <DialogDescription>Creá una nueva categoría de planes.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Nombre</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nombre" />
            </div>
            <div className="space-y-1.5">
              <Label>Descripción</Label>
              <Input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Descripción" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button variant="accent" onClick={saveNew}>Crear</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar categoría</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Nombre</Label>
                <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Descripción</Label>
                <Input value={editing.desc} onChange={(e) => setEditing({ ...editing, desc: e.target.value })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button variant="accent" onClick={saveEdit}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Borrar categoría?</AlertDialogTitle>
            <AlertDialogDescription>
              Se borrarán sus programas y rutinas. Sesiones y marcas quedan huérfanas pero consultables.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmDelete}>Borrar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {cats.length === 0 && (
        <div className="border border-border bg-card p-4 space-y-3">
          <p className="text-sm text-muted-foreground">
            Todavía no hay categorías. Creá la primera para ordenar los programas que vas a entrenar.
          </p>
          <Button variant="outline" size="lg" onClick={() => setCreateOpen(true)}>
            Nueva categoría
          </Button>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cats.map((c) => (
          <ContextMenu key={c.id}>
            <ContextMenuTrigger className="block h-full">
              <Card className="p-4 h-full transition-colors hover:ring-ink">
                <div className="flex items-start justify-between gap-2">
                  <Link to={`/skill/${c.id}`} className="block min-w-0 flex-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                    <h2 className="font-semibold">{c.name}</h2>
                    <p className="text-xs text-muted-foreground mt-1">{c.description}</p>
                    <div className="mt-2 flex gap-2">
                      <Badge variant="outline" className="label-status">
                        {c.programs.length} {pluralForm(c.programs.length, 'programa', 'programas')}
                      </Badge>
                    </div>
                  </Link>
                  <DropdownMenu>
                    <DropdownMenuTrigger className="inline-flex h-11 w-11 items-center justify-center border border-border text-muted-foreground hover:text-ink hover:bg-secondary hover:border-ink" aria-label="Acciones">
                      <MoreHorizontal className="h-4 w-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setEditing({ id: c.id, name: c.name, desc: c.description })}>Editar</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive" onClick={() => setDeleting({ id: c.id, name: c.name })}>Borrar</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </Card>
            </ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuItem onClick={() => setEditing({ id: c.id, name: c.name, desc: c.description })}>Editar</ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem className="text-destructive" onClick={() => setDeleting({ id: c.id, name: c.name })}>Borrar</ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        ))}
      </div>
    </div>
  );
}
