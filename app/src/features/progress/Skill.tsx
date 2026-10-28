import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import type { Level, Program } from '@/types';
import { pluralForm } from '@/lib/format';
import { BackLink } from '@/components/BackLink';
import { useCategories } from '@/hooks/usePlans';
import { allPrograms, createProgram, updateProgram, deleteProgram, updateCategory } from '@/features/plans/plans';
import { progressionChainsForCategory, type ProgressionReport } from '@/features/plans/progression';
import { useProgression } from '@/hooks/useProgression';
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
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { LEVELS, LEVEL_LABEL, levelForSave, tagsForSave } from './level';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface ProgForm {
  name: string;
  level: Level;
  description: string;
  objectives: string[];
  rules: string[];
  frequency: string;
  restBetweenSessions: string;
  optional: boolean;
  tags: string[];
}

/**
 * The unlock condition in one line. `describeLock` lists every missing anchor, which turns a card
 * into a wall of text; here the previous program and the number of pending marks are enough to know
 * what to do next, and the criteria stay on the program screen.
 */
function lockSummary(report: ProgressionReport): string {
  const missing = report.requirements.filter((anchor) => !anchor.met).length;
  const marks = `${missing} ${pluralForm(missing, 'marca', 'marcas')}`;
  if (report.previous) {
    return missing > 0
      ? `Bloqueado: completá ${report.previous.name} o superá ${marks}.`
      : `Bloqueado: completá ${report.previous.name}.`;
  }
  return missing > 0 ? `Bloqueado: superá ${marks}.` : 'Bloqueado.';
}

export default function Skill() {
  const { id } = useParams();
  const cats = useCategories();
  const cat = cats.find((c) => c.id === id);
  const progression = useProgression();

  const [catEditOpen, setCatEditOpen] = useState(false);
  const [catForm, setCatForm] = useState({ name: '', desc: '' });

  const progModal = useCrudModal<Program>();
  const [progForm, setProgForm] = useState<ProgForm>({
    name: '', level: 'beginner', description: '', objectives: [], rules: [],
    frequency: '', restBetweenSessions: '', optional: false, tags: [],
  });
  const [deletingProg, setDeletingProg] = useState<{ id: string; name: string } | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  if (!cat) return <p className="label-caps">Categoría no encontrada.</p>;

  const chains = progressionChainsForCategory(cat.id);
  const programsById = new Map(allPrograms().map((p) => [p.id, p]));
  const reports = new Map(cat.programs.map((p) => [p.id, progression.reportFor(p.id)]));

  const openCatEdit = () => {
    setCatForm({ name: cat.name, desc: cat.description });
    setCatEditOpen(true);
  };
  const saveCat = async () => {
    try {
      await updateCategory(cat.id, { name: catForm.name.trim(), description: catForm.desc.trim() });
      setSaveError(null);
      setCatEditOpen(false);
    } catch {
      setSaveError('No se pudo guardar la categoría.');
    }
  };

  const openCreateProg = () => {
    setProgForm({
      name: '', level: 'beginner', description: '', objectives: [], rules: [],
      frequency: '', restBetweenSessions: '', optional: false, tags: [],
    });
    progModal.openCreate();
  };

  const openEditProg = (p: Program) => {
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
    const level = levelForSave(f.level);
    const tags = tagsForSave(f.tags, level);

    if (progModal.mode === 'create') {
      const existing = new Set(cat.programs.map((p) => p.id));
      const pid = uniqueId(f.name, existing);
      try {
        await createProgram(cat.id, {
          id: pid, categoryId: cat.id, name: f.name.trim(), level,
          description: f.description.trim(),
          objectives: f.objectives.filter((s) => s.trim() !== '').map((s) => s.trim()),
          goals: [], frequency: f.frequency.trim(), restBetweenSessions: f.restBetweenSessions.trim(),
          rules: f.rules.filter((s) => s.trim() !== '').map((s) => s.trim()),
          models: [], optional: f.optional, tags,
        });
        setSaveError(null);
        progModal.close();
      } catch {
        setSaveError('No se pudo crear el programa.');
      }
    } else if (progModal.item) {
      try {
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
        setSaveError(null);
        progModal.close();
      } catch {
        setSaveError('No se pudo guardar el programa.');
      }
    }
  };

  const confirmDeleteProg = async () => {
    if (!deletingProg) return;
    try {
      await deleteProgram(deletingProg.id);
      setSaveError(null);
      setDeletingProg(null);
    } catch {
      setSaveError('No se pudo borrar el programa.');
    }
  };

  return (
    <div className="space-y-4">
      <header>
        <BackLink to="/planes">Planes</BackLink>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <ContextMenu>
            <ContextMenuTrigger className="min-w-0">
              <h1 className="text-2xl font-bold tracking-tight font-heading">{cat.name}</h1>
            </ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuItem onClick={openCatEdit}>Editar categoría</ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
          <div className="flex shrink-0 items-center gap-2 self-start sm:self-auto">
            {cat.programs.length > 0 && (
              <Button variant="outline" size="lg" onClick={openCreateProg}>
                Nuevo programa
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button variant="outline" size="icon-lg" aria-label="Acciones de la categoría" />}
              >
                <MoreHorizontal aria-hidden="true" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={openCatEdit}>Editar categoría</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
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
          <div className="space-y-1.5">
            <Label>Nivel</Label>
            <Select value={progForm.level} onValueChange={(value) => setProgForm({ ...progForm, level: levelForSave(value ?? progForm.level) })}>
              <SelectTrigger aria-label="Nivel"><SelectValue /></SelectTrigger>
              <SelectContent>
                {LEVELS.map((level) => (
                  <SelectItem key={level} value={level}>{LEVEL_LABEL[level]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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
            <AlertDialogTitle>¿Borrar programa? {deletingProg?.name}</AlertDialogTitle>
            <AlertDialogDescription>
              Se borrarán las rutinas de {deletingProg?.name}. Sesiones y marcas quedan huérfanas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmDeleteProg}>Borrar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {cat.programs.length === 0 && (
        <section className="space-y-3 border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Sin programas curados aún.</p>
          <Button variant="outline" size="lg" onClick={openCreateProg}>
            Nuevo programa
          </Button>
        </section>
      )}

      {saveError && (
        <p role="alert" className="border border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {saveError}
        </p>
      )}

      {progression.error && (
        <p role="alert" className="border border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive">
          No se pudo leer el progreso: los niveles completados y bloqueados pueden verse reiniciados.
        </p>
      )}

      {(() => {
        const sueltos = cat.programs.filter((p) => !chains.slots.has(p.id));
        const tarjeta = (p: (typeof cat.programs)[number]) => {
          const report = reports.get(p.id) ?? null;
          const slot = chains.slots.get(p.id);
          return (
            <ContextMenu key={p.id}>
              <ContextMenuTrigger className="block">
                <Card className="relative p-4 transition-shadow hover:ring-ink focus-within:ring-ink">
                  <div className="flex items-start justify-between gap-2">
                    <Link to={`/program/${p.id}`} className="block min-w-0 flex-1 after:absolute after:inset-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                      <div className="flex items-baseline gap-2">
                        {slot && (
                          <span className="metric text-sm text-muted-foreground" aria-label={`nivel ${slot.position} de ${slot.total}`}>
                            {slot.position}
                          </span>
                        )}
                        <h2 className="font-heading text-lg font-bold tracking-tight">{p.name}</h2>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{LEVEL_LABEL[p.level] ?? p.level}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="label-status">{p.models.length} rutinas</Badge>
                        {report?.completed && (
                          <Badge variant="outline" className="label-status gap-1.5">
                            <span aria-hidden="true" className="size-2 bg-accent" />
                            completado
                          </Badge>
                        )}
                        {report?.unlocked === false && (
                          <Badge variant="outline" className="label-status">bloqueado</Badge>
                        )}
                      </div>
                      {report?.unlocked === false && (
                        <p className="mt-2 text-sm text-muted-foreground">{lockSummary(report)}</p>
                      )}
                    </Link>
                    <DropdownMenu>
                      <DropdownMenuTrigger className="relative z-10 inline-flex h-11 w-11 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:bg-secondary hover:text-ink focus-visible:ring-2 focus-visible:ring-ring" aria-label="Acciones">
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
          );
        };

        return (
          <>
            {chains.groups.map((chain, gi) => (
              <section key={chain.join('>')} className="space-y-2">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <h2 className="font-heading text-base font-bold tracking-tight">
                    {chains.groups.length > 1 ? `Cadena de progresión ${gi + 1}` : 'Cadena de progresión'}
                  </h2>
                  <p className="text-sm text-muted-foreground">De más fácil a más difícil.</p>
                </div>
                <div className="grid items-start gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {chain.map((pid) => {
                    const programa = programsById.get(pid);
                    return programa ? tarjeta(programa) : null;
                  })}
                </div>
              </section>
            ))}

            {sueltos.length > 0 && (
              <section className="space-y-2">
                <h2 className="font-heading text-base font-bold tracking-tight">
                  {chains.groups.length > 0 ? 'Programas fuera de la cadena' : 'Programas'}
                </h2>
                <div className="grid items-start gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {sueltos.map((p) => tarjeta(p))}
                </div>
              </section>
            )}
          </>
        );
      })()}
    </div>
  );
}
