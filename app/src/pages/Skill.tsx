import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useCategories } from '../lib/usePlans';
import { createProgram, updateProgram, deleteProgram, updateCategory } from '../lib/plans';
import { uniqueId } from '../lib/ids';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MoreHorizontal } from 'lucide-react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const LEVEL_LABEL: Record<string, string> = {
  beginner: 'principiante',
  intermediate: 'intermedio',
  advanced: 'avanzado',
};

interface ProgForm {
  name: string;
  level: string;
  description: string;
  objectives: string;
  rules: string;
  frequency: string;
  restBetweenSessions: string;
  optional: boolean;
}

export default function Skill() {
  const { id } = useParams();
  const cats = useCategories();
  const cat = cats.find((c) => c.id === id);

  const [catEditOpen, setCatEditOpen] = useState(false);
  const [catForm, setCatForm] = useState({ name: '', desc: '' });

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '' });

  const [editingProg, setEditingProg] = useState<{ id: string; form: ProgForm } | null>(null);
  const [deletingProg, setDeletingProg] = useState<{ id: string; name: string } | null>(null);

  if (!cat) return <p className="label-caps">Categoría no encontrada.</p>;

  const openCatEdit = () => {
    setCatForm({ name: cat.name, desc: cat.description });
    setCatEditOpen(true);
  };
  const saveCat = async () => {
    await updateCategory(cat.id, { name: catForm.name.trim(), description: catForm.desc.trim() });
    setCatEditOpen(false);
  };

  const saveNewProg = async () => {
    if (!createForm.name.trim()) return;
    const existing = new Set(cat.programs.map((p) => p.id));
    const pid = uniqueId(createForm.name, existing);
    await createProgram(cat.id, {
      id: pid, categoryId: cat.id, name: createForm.name.trim(), level: 'beginner',
      description: '', objectives: [], goals: [], frequency: '', restBetweenSessions: '',
      rules: [], models: [], optional: false, tags: [],
    } as any);
    setCreateForm({ name: '' });
    setCreateOpen(false);
  };

  const openEditProg = (p: any) => {
    setEditingProg({
      id: p.id,
      form: {
        name: p.name,
        level: p.level,
        description: p.description,
        objectives: (p.objectives || []).join('\n'),
        rules: (p.rules || []).join('\n'),
        frequency: p.frequency,
        restBetweenSessions: p.restBetweenSessions,
        optional: !!p.optional,
      },
    });
  };

  const saveEditProg = async () => {
    if (!editingProg) return;
    const f = editingProg.form;
    await updateProgram(editingProg.id, {
      name: f.name.trim(),
      level: f.level as any,
      description: f.description.trim(),
      objectives: f.objectives.split('\n').map((s) => s.trim()).filter(Boolean),
      rules: f.rules.split('\n').map((s) => s.trim()).filter(Boolean),
      frequency: f.frequency.trim(),
      restBetweenSessions: f.restBetweenSessions.trim(),
      optional: f.optional,
    });
    setEditingProg(null);
  };

  const confirmDeleteProg = async () => {
    if (!deletingProg) return;
    await deleteProgram(deletingProg.id);
    setDeletingProg(null);
  };

  return (
    <div className="space-y-6">
      <header>
        <Link to="/planes" className="label-caps text-[var(--muted)] hover:text-[var(--ink)]">← Planes</Link>
        <div className="flex items-center justify-between gap-3 mt-2">
          <h1 className="text-3xl font-extrabold tracking-tight font-heading">{cat.name}</h1>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={openCatEdit}>Editar categoría</Button>
            <Button size="sm" onClick={() => setCreateOpen(true)}>Nueva programa</Button>
          </div>
        </div>
        <p className="text-[var(--muted)]">{cat.description}</p>
      </header>

      <Dialog open={catEditOpen} onOpenChange={setCatEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar categoría</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Nombre</Label><Input value={catForm.name} onChange={(e) => setCatForm({ ...catForm, name: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Descripción</Label><Input value={catForm.desc} onChange={(e) => setCatForm({ ...catForm, desc: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCatEditOpen(false)}>Cancelar</Button>
            <Button onClick={saveCat}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nueva programa</DialogTitle></DialogHeader>
          <div className="space-y-1.5">
            <Label>Nombre</Label>
            <Input value={createForm.name} onChange={(e) => setCreateForm({ name: e.target.value })} placeholder="Nombre del programa" />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={saveNewProg}>Crear</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingProg} onOpenChange={(o) => !o && setEditingProg(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Editar programa</DialogTitle></DialogHeader>
          {editingProg && (
            <div className="space-y-3">
              <div className="space-y-1.5"><Label>Nombre</Label><Input value={editingProg.form.name} onChange={(e) => setEditingProg({ ...editingProg!, form: { ...editingProg!.form, name: e.target.value } })} /></div>
              <div className="space-y-1.5">
                <Label>Nivel</Label>
                <Select value={editingProg.form.level} onValueChange={(v) => setEditingProg({ ...editingProg!, form: { ...editingProg!.form, level: (v ?? "") as string } })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="beginner">principiante</SelectItem>
                    <SelectItem value="intermediate">intermedio</SelectItem>
                    <SelectItem value="advanced">avanzado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Descripción</Label><Input value={editingProg.form.description} onChange={(e) => setEditingProg({ ...editingProg!, form: { ...editingProg!.form, description: e.target.value } })} /></div>
              <div className="space-y-1.5"><Label>Objetivos (uno por línea)</Label><Textarea value={editingProg.form.objectives} onChange={(e) => setEditingProg({ ...editingProg!, form: { ...editingProg!.form, objectives: e.target.value } })} rows={3} /></div>
              <div className="space-y-1.5"><Label>Reglas (uno por línea)</Label><Textarea value={editingProg.form.rules} onChange={(e) => setEditingProg({ ...editingProg!, form: { ...editingProg!.form, rules: e.target.value } })} rows={3} /></div>
              <div className="space-y-1.5"><Label>Frecuencia</Label><Input value={editingProg.form.frequency} onChange={(e) => setEditingProg({ ...editingProg!, form: { ...editingProg!.form, frequency: e.target.value } })} /></div>
              <div className="space-y-1.5"><Label>Descanso entre sesiones</Label><Input value={editingProg.form.restBetweenSessions} onChange={(e) => setEditingProg({ ...editingProg!, form: { ...editingProg!.form, restBetweenSessions: e.target.value } })} /></div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={editingProg.form.optional} onChange={(e) => setEditingProg({ ...editingProg!, form: { ...editingProg!.form, optional: e.target.checked } })} />
                Opcional
              </label>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditingProg(null)}>Cancelar</Button>
            <Button onClick={saveEditProg}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingProg} onOpenChange={(o) => !o && setDeletingProg(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Borrar programa?</AlertDialogTitle>
            <AlertDialogDescription>Se borrarán sus rutinas. Sesiones y marcas quedan huérfanas.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteProg}>Borrar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {cat.programs.length === 0 && <p className="text-sm text-[var(--muted)]">Sin progresiones curadas aún.</p>}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cat.programs.map((p) => (
          <Card key={p.id} className="p-4 h-full">
            <div className="flex items-start justify-between gap-2">
              <Link to={`/program/${p.id}`} className="block min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="font-semibold">{p.name}</h2>
                    <p className="text-xs text-[var(--muted)] mt-0.5">{LEVEL_LABEL[p.level] ?? p.level}</p>
                  </div>
                  {p.optional && <Badge variant="secondary">Opcional</Badge>}
                </div>
                <div className="mt-2 flex gap-2">
                  <Badge variant="default">{p.models.length} rutinas</Badge>
                </div>
              </Link>
              <DropdownMenu>
                <DropdownMenuTrigger className="inline-flex h-7 w-7 items-center justify-center text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--muted-surface)]"><MoreHorizontal className="h-4 w-4" /></DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => openEditProg(p)}>Editar</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-[var(--alert)]" onClick={() => setDeletingProg({ id: p.id, name: p.name })}>Borrar</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
