import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { BackLink } from '@/components/BackLink';
import { useCategories } from '@/hooks/usePlans';
import { createProgram, updateProgram, deleteProgram, updateCategory } from '@/features/plans/plans';
import { tagChainsForCategory } from '@/features/plans/progression';
import { useProgression } from '@/hooks/useProgression';
import { getProgram } from '@/features/plans/plans';
import { TagListInput } from '@/components/ui/tag-list-input';
import { LineListInput } from '@/components/ui/line-list-input';
import { useCrudModal, CrudModal } from '@/components/ui/crud-modal';
import { uniqueId } from '@/features/plans/ids';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuSub, ContextMenuSubTrigger, ContextMenuSubContent } from '@/components/ui/context-menu';
import { TagsMenu } from '@/components/ui/tags-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  objectives: string[];
  rules: string[];
  frequency: string;
  restBetweenSessions: string;
  optional: boolean;
  tags: string[];
}

export default function Skill() {
  const { id } = useParams();
  const cats = useCategories();
  const cat = cats.find((c) => c.id === id);
  const progression = useProgression();

  const [catEditOpen, setCatEditOpen] = useState(false);
  const [catForm, setCatForm] = useState({ name: '', desc: '' });

  const progModal = useCrudModal<any>();
  const [progForm, setProgForm] = useState<ProgForm>({
    name: '', level: 'beginner', description: '', objectives: [], rules: [],
    frequency: '', restBetweenSessions: '', optional: false, tags: [],
  });
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

  const openCreateProg = () => {
    setProgForm({
      name: '', level: 'beginner', description: '', objectives: [], rules: [],
      frequency: '', restBetweenSessions: '', optional: false, tags: [],
    });
    progModal.openCreate();
  };

  const openEditProg = (p: any) => {
    setProgForm({
      name: p.name,
      level: p.level,
      description: p.description,
      objectives: p.objectives || [],
      rules: p.rules || [],
      frequency: p.frequency,
      restBetweenSessions: p.restBetweenSessions,
      optional: !!p.optional,
      tags: p.tags || [],
    });
    progModal.openEdit(p);
  };

  const saveProg = async () => {
    const f = progForm;
    if (!f.name.trim()) return;
    const levelTag = f.tags.find((t) => ['principiante','intermedio','avanzado'].includes(t));
    const level = levelTag === 'intermedio' ? 'intermediate' : levelTag === 'avanzado' ? 'advanced' : 'beginner';
    const levelLabel = LEVEL_LABEL[level] ?? level;
    const tags = [...new Set([levelLabel, ...f.tags])];

    if (progModal.mode === 'create') {
      const existing = new Set(cat.programs.map((p) => p.id));
      const pid = uniqueId(f.name, existing);
      await createProgram(cat.id, {
        id: pid, categoryId: cat.id, name: f.name.trim(), level,
        description: f.description.trim(),
        objectives: f.objectives.filter((s) => s.trim() !== '').map((s) => s.trim()),
        goals: [], frequency: f.frequency.trim(), restBetweenSessions: f.restBetweenSessions.trim(),
        rules: f.rules.filter((s) => s.trim() !== '').map((s) => s.trim()),
        models: [], optional: f.optional, tags,
      } as any);
    } else if (progModal.item) {
      await updateProgram(progModal.item.id, {
        name: f.name.trim(),
        level,
        description: f.description.trim(),
        objectives: f.objectives.filter((s) => s.trim() !== '').map((s) => s.trim()),
        rules: f.rules.filter((s) => s.trim() !== '').map((s) => s.trim()),
        frequency: f.frequency.trim(),
        restBetweenSessions: f.restBetweenSessions.trim(),
        optional: f.optional,
        tags,
      });
    }
    progModal.close();
  };

  const confirmDeleteProg = async () => {
    if (!deletingProg) return;
    await deleteProgram(deletingProg.id);
    setDeletingProg(null);
  };

  return (
    <div className="space-y-6">
      <header>
        <BackLink to="/planes">Planes</BackLink>
        <div className="flex items-center justify-between gap-3 mt-2">
          <ContextMenu>
            <ContextMenuTrigger className="min-w-0 flex-1">
              <h1 className="text-3xl font-extrabold tracking-tight font-heading">{cat.name}</h1>
            </ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuItem onClick={openCatEdit}>Editar categoría</ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
          <Button variant="accent" size="sm" onClick={openCreateProg} >
            Nuevo programa
          </Button>
        </div>
        <p className="text-muted-foreground">{cat.description}</p>
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
            <Button variant="accent" onClick={saveCat}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CrudModal
        open={progModal.open}
        onOpenChange={(o) => { if (!o) progModal.close(); }}
        mode={progModal.mode}
        createTitle="Nuevo programa"
        editTitle="Editar programa"
        onSubmit={saveProg}
        className="max-w-2xl"
      >
        <div className="space-y-3">
          <div className="space-y-1.5"><Label>Nombre</Label><Input value={progForm.name} onChange={(e) => setProgForm({ ...progForm, name: e.target.value })} placeholder="Nombre del programa" /></div>
          <div className="space-y-1.5"><Label>Descripción</Label><Input value={progForm.description} onChange={(e) => setProgForm({ ...progForm, description: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Objetivos</Label><LineListInput value={progForm.objectives} onChange={(lines) => setProgForm({ ...progForm, objectives: lines })} placeholder="objetivo" /></div>
          <div className="space-y-1.5"><Label>Reglas</Label><LineListInput value={progForm.rules} onChange={(lines) => setProgForm({ ...progForm, rules: lines })} placeholder="regla" /></div>
          <div className="space-y-1.5"><Label>Frecuencia</Label><Input value={progForm.frequency} onChange={(e) => setProgForm({ ...progForm, frequency: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Descanso entre sesiones</Label><Input value={progForm.restBetweenSessions} onChange={(e) => setProgForm({ ...progForm, restBetweenSessions: e.target.value })} /></div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="h-4 w-4 accent-foreground" checked={progForm.optional} onChange={(e) => setProgForm({ ...progForm, optional: e.target.checked })} />
            Opcional
          </label>
          <div className="space-y-1.5">
            <Label>Etiquetas</Label>
            <TagListInput value={progForm.tags} onChange={(tags) => setProgForm({ ...progForm, tags })} />
            <p className="text-xs text-muted-foreground">Los programas que comparten una etiqueta forman una cadena ordenada por nivel.</p>
          </div>
        </div>
      </CrudModal>

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

      {cat.programs.length === 0 && <p className="text-sm text-muted-foreground">Sin progresiones curadas aún.</p>}

      {tagChainsForCategory(cat.id).length > 0 && (
        <section className="space-y-2">
          <h2 className="label-caps">Progresión (más fácil → más difícil)</h2>
          {tagChainsForCategory(cat.id).map(({ tag, chain }, ci) => (
            <div key={ci} className="space-y-1">
              <span className="label-caps text-muted-foreground">{tag}</span>
              <div className="flex flex-wrap items-center gap-2">
              {chain.map((pid, idx) => {
                const level = progression.reportFor(pid)?.levels.find((l) => l.id === pid) ?? null;
                return (
                <span key={pid} className="flex items-center gap-2">
                  <Link to={`/program/${pid}`} className="px-3 py-2 border border-ink bg-accent text-on-accent text-sm font-semibold hover:opacity-90">
                    {getProgram(pid)?.name ?? pid}
                    <span className="ml-2 label-caps">{LEVEL_LABEL[getProgram(pid)?.level ?? ''] ?? getProgram(pid)?.level}</span>
                    {level?.completed && <span className="ml-2 label-caps">completado</span>}
                  </Link>
                  {idx < chain.length - 1 && <span className="text-muted-foreground">→</span>}
                </span>
                );
              })}
            </div>
            </div>
          ))}
        </section>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cat.programs.map((p) => (
          <ContextMenu key={p.id}>
            <ContextMenuTrigger className="block h-full">
              <Card className="p-4 h-full transition-colors hover:border-ink">
                <div className="flex items-start justify-between gap-2">
                  <Link to={`/program/${p.id}`} className="block min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h2 className="font-semibold">{p.name}</h2>
                        <p className="text-xs text-muted-foreground mt-0.5">{LEVEL_LABEL[p.level] ?? p.level}</p>
                      </div>

                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Badge variant="default">{p.models.length} rutinas</Badge>
                      {tagChainsForCategory(cat.id).some(({ chain }) => chain.includes(p.id)) && (
                        <Badge variant="secondary" className="bg-accent text-on-accent border-ink">En cadena</Badge>
                      )}
                      {progression.reportFor(p.id)?.completed && (
                        <Badge className="border-ink bg-accent text-on-accent label-status">completado</Badge>
                      )}
                      {progression.reportFor(p.id)?.unlocked === false && (
                        <Badge variant="outline" className="label-status">bloqueado</Badge>
                      )}
                    </div>
                  </Link>
                  <DropdownMenu>
                    <DropdownMenuTrigger className="inline-flex h-7 w-7 items-center justify-center border border-border text-muted-foreground hover:text-ink hover:bg-secondary hover:border-ink" aria-label="Acciones">
                      <MoreHorizontal className="h-4 w-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEditProg(p)}>Editar</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive" onClick={() => setDeletingProg({ id: p.id, name: p.name })}>Borrar</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </Card>
            </ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuItem onClick={() => openEditProg(p)}>Editar</ContextMenuItem>
              <ContextMenuSub>
                <ContextMenuSubTrigger>Etiquetas</ContextMenuSubTrigger>
                <ContextMenuSubContent className="w-48 p-1.5">
                  <TagsMenu targetType="program" targetId={p.id} />
                </ContextMenuSubContent>
              </ContextMenuSub>
              <ContextMenuSeparator />
              <ContextMenuItem className="text-destructive" onClick={() => setDeletingProg({ id: p.id, name: p.name })}>Borrar</ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        ))}
      </div>
    </div>
  );
}
