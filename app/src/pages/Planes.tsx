import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCategories } from '../lib/usePlans';
import { createCategory, updateCategory, deleteCategory } from '../lib/plans';
import { uniqueId } from '../lib/ids';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MoreHorizontal } from 'lucide-react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function Planes() {
  const cats = useCategories();
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');

  const [editing, setEditing] = useState<{ id: string; name: string; desc: string } | null>(null);
  const [deleting, setDeleting] = useState<{ id: string; name: string } | null>(null);

  const saveNew = async () => {
    if (!newName.trim()) return;
    const existing = new Set(cats.map((c) => c.id));
    const id = uniqueId(newName, existing);
    await createCategory({ id, name: newName.trim(), description: newDesc.trim(), programs: [] });
    setNewName('');
    setNewDesc('');
    setCreateOpen(false);
  };

  const saveEdit = async () => {
    if (!editing || !editing.name.trim()) return;
    await updateCategory(editing.id, { name: editing.name.trim(), description: editing.desc.trim() });
    setEditing(null);
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    await deleteCategory(deleting.id);
    setDeleting(null);
  };

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight font-heading">Planes</h1>
          <p className="label-caps text-[var(--muted)]">progresiones por categoría</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>Nueva categoría</Button>
      </header>

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
            <Button onClick={saveNew}>Crear</Button>
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
            <Button onClick={saveEdit}>Guardar</Button>
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
            <AlertDialogAction onClick={confirmDelete}>Borrar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cats.map((c) => (
          <Card key={c.id} className="p-4 h-full">
            <div className="flex items-start justify-between gap-2">
              <Link to={`/skill/${c.id}`} className="block min-w-0 flex-1">
                <h2 className="font-semibold">{c.name}</h2>
                <p className="text-xs text-[var(--muted)] mt-1">{c.description}</p>
                <div className="mt-2 flex gap-2">
                  <Badge variant="default">{c.programs.length} progresiones</Badge>
                </div>
              </Link>
              <DropdownMenu>
                <DropdownMenuTrigger className="inline-flex h-7 w-7 items-center justify-center text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--muted-surface)]">
                  <MoreHorizontal className="h-4 w-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setEditing({ id: c.id, name: c.name, desc: c.description })}>Editar</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-[var(--alert)]" onClick={() => setDeleting({ id: c.id, name: c.name })}>Borrar</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
