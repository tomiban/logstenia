import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import type { Intensity, Model } from '@/types';
import { toIntensity } from '@/lib/intensity';
import { BackLink } from '@/components/BackLink';
import { getProgram, createModel, deleteModel, updateModel } from './plans';
import { usePlansVersion } from '@/hooks/usePlans';
import { uniqueId } from './ids';
import { splitModels } from './planModels';
import { chainFor, describeLock } from './progression';
import { useProgression } from '@/hooks/useProgression';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuSub, ContextMenuSubTrigger, ContextMenuSubContent } from '@/components/ui/context-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { TagsMenu } from '@/components/ui/tags-menu';
import { MoreHorizontal } from 'lucide-react';
import { createSettingsRepository } from '@/repositories';
import { tagPastel } from '@/lib/tags';
import { useTags } from '@/hooks/useTags';

const settingsRepository = createSettingsRepository();

function RoutineTags({ routineId }: { routineId: string }) {
  const { tags } = useTags('routine', routineId);
  if (tags.length === 0) return null;

  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {tags.map((tag) => {
        const color = tagPastel(tag);
        return (
          <span
            key={tag}
            className="border border-border px-1.5 py-0.5 text-[10px] leading-none label-status"
            style={{ backgroundColor: color.bg, color: color.text }}
          >
            {tag}
          </span>
        );
      })}
    </div>
  );
}

/** The fields a model edit form round-trips; kept narrow so the payload cannot drift from `Model`. */
interface ModelEditForm {
  name: string;
  intensity: Intensity;
  totalTimeMin: number;
  benchmark: boolean;
}

export default function Program() {
  const { id } = useParams();
  usePlansVersion();
  const p = getProgram(id || '');

  const [started, setStarted] = useState(false);
  const progression = useProgression();
  const report = progression.reportFor(p?.id ?? '');
  const unlocked = report?.unlocked ?? true;
  const lockReason = report && !report.unlocked ? describeLock(report) : null;

  // program edit

  // model create/edit/delete
  const [modelCreateOpen, setModelCreateOpen] = useState(false);
  const [newModelName, setNewModelName] = useState('');
  const [modelEdit, setModelEdit] = useState<{ id: string; form: ModelEditForm } | null>(null);
  const [modelDelete, setModelDelete] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!p) return;
    (async () => {
      try {
        const r = await settingsRepository.get('startedPlans');
        const arr = (r?.value as string[]) || [];
        setStarted(arr.includes(p.id));
      } catch {
        setSaveError('No se pudo leer si este plan ya está empezado.');
      }
    })();
  }, [p]);

  if (!p) return <p className="label-caps">Programa no encontrado.</p>;

  const { routines, special } = splitModels(p.models);

  const chain = chainFor(p.id) ?? [];
  const chainIndex = chain.indexOf(p.id);
  const previous = chainIndex > 0 ? getProgram(chain[chainIndex - 1]) : null;
  const next = report?.next ?? null;
  const nextIsBeacon = started && !!next?.unlocked;
  const exerciseCount = (model: Model) =>
    model.blocks.reduce((count, block) => count + block.exercises.length, 0);
  const detailPanels = [p.objectives.length > 0, p.rules.length > 0].filter(Boolean).length;

  const saveNewModel = async () => {
    if (!newModelName.trim()) return;
    const existing = new Set(p.models.map((m: Model) => m.id));
    const id = uniqueId(newModelName, existing);
    try {
      await createModel(p.id, { id, name: newModelName.trim(), intensity: 1, totalTimeMin: 0, blocks: [], tags: [] });
      setSaveError(null);
      setNewModelName('');
      setModelCreateOpen(false);
    } catch {
      setSaveError('No se pudo crear la rutina.');
    }
  };

  const openModelEdit = (m: Model) => {
    setModelEdit({
      id: m.id,
      form: { name: m.name, intensity: m.intensity, totalTimeMin: m.totalTimeMin, benchmark: !!m.benchmark },
    });
  };
  const saveModelEdit = async () => {
    if (!modelEdit) return;
    try {
      await updateModel(modelEdit.id, {
        name: modelEdit.form.name.trim(),
        intensity: modelEdit.form.intensity,
        totalTimeMin: Number(modelEdit.form.totalTimeMin),
        benchmark: modelEdit.form.benchmark,
      });
      setSaveError(null);
      setModelEdit(null);
    } catch {
      setSaveError('No se pudo guardar la rutina.');
    }
  };
  const confirmDeleteModel = async () => {
    if (!modelDelete) return;
    try {
      await deleteModel(modelDelete);
      setSaveError(null);
      setModelDelete(null);
    } catch {
      setSaveError('No se pudo borrar la rutina.');
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <BackLink to="/">Volver</BackLink>
      </div>

      <header className="border-b border-border pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">{p.name}</h1>
              {report?.completed && (
                <Badge variant="outline" className="label-status">completado</Badge>
              )}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{p.description}</p>
          </div>
          <Button variant="outline" size="lg" onClick={() => setModelCreateOpen(true)}>
            Nueva rutina
          </Button>
        </div>
      </header>

      {report?.position != null && (
        <section className="border border-border bg-card p-3 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <dl className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <div className="flex items-baseline gap-1.5">
                <dt className="label-caps text-muted-foreground">Fase</dt>
                <dd className="flex items-baseline gap-1">
                  <span className="metric text-base text-foreground">{report.position}</span>
                  <span className="label-caps text-muted-foreground">de {report.total}</span>
                </dd>
              </div>
              {next && (
                <div className="flex min-w-0 items-baseline gap-1.5">
                  <dt className="label-caps text-muted-foreground">Siguiente</dt>
                  <dd className="min-w-0 text-sm text-foreground">{next.name}</dd>
                </div>
              )}
            </dl>
            {next && (
              <Badge
                variant="outline"
                className={next.unlocked ? 'label-status' : 'label-status text-muted-foreground'}
              >
                {next.unlocked ? 'desbloqueado' : 'bloqueado'}
              </Badge>
            )}
          </div>

          {next && !next.unlocked && (
            <p className="text-sm text-muted-foreground">
              Se abre cuando completes todas las rutinas de este nivel o superes sus marcas.
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {next?.unlocked && (
              <Link to={`/program/${next.id}`} className="inline-block">
                <Button variant={nextIsBeacon ? 'accent' : 'outline'} size="lg">Ir al siguiente nivel</Button>
              </Link>
            )}
            {previous && (
              <Link to={`/program/${previous.id}`} className="inline-block">
                <Button variant="ghost" size="lg">← Más fácil</Button>
              </Link>
            )}
          </div>
        </section>
      )}
      <Dialog open={modelCreateOpen} onOpenChange={setModelCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nueva rutina</DialogTitle></DialogHeader>
          <div className="space-y-1.5">
            <Label>Nombre</Label>
            <Input value={newModelName} onChange={(e) => setNewModelName(e.target.value)} placeholder="Nombre de la rutina" />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setModelCreateOpen(false)}>Cancelar</Button>
            <Button onClick={saveNewModel}>Crear</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!modelEdit} onOpenChange={(o) => !o && setModelEdit(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar rutina</DialogTitle></DialogHeader>
          {modelEdit && (
            <div className="space-y-3">
              <div className="space-y-1.5"><Label>Nombre</Label><Input value={modelEdit.form.name} onChange={(e) => setModelEdit({ ...modelEdit!, form: { ...modelEdit!.form, name: e.target.value } })} /></div>
              <div className="space-y-1.5">
                <Label>Intensidad</Label>
                <Select value={String(modelEdit.form.intensity)} onValueChange={(v) => setModelEdit({ ...modelEdit!, form: { ...modelEdit!.form, intensity: toIntensity(v) } })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1</SelectItem>
                    <SelectItem value="2">2</SelectItem>
                    <SelectItem value="3">3</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Tiempo total (min)</Label><Input type="number" value={modelEdit.form.totalTimeMin} onChange={(e) => setModelEdit({ ...modelEdit!, form: { ...modelEdit!.form, totalTimeMin: Number(e.target.value) } })} /></div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="h-4 w-4 accent-foreground" checked={modelEdit.form.benchmark} onChange={(e) => setModelEdit({ ...modelEdit!, form: { ...modelEdit!.form, benchmark: e.target.checked } })} />
                Toma de marcas
              </label>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setModelEdit(null)}>Cancelar</Button>
            <Button onClick={saveModelEdit}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!modelDelete} onOpenChange={(o) => !o && setModelDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Borrar rutina?</AlertDialogTitle>
            <AlertDialogDescription>Sesiones y marcas quedan huérfanas.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmDeleteModel}>Borrar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {!started && (
        <div className="border border-ink bg-card p-3 flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm text-muted-foreground">¿Empezar este plan? Se registra con 0% de progreso en Inicio.</span>
          <Button variant="accent" size="lg" disabled={!unlocked} onClick={async () => {
            try {
              const r = await settingsRepository.get('startedPlans');
              const arr = (r?.value as string[]) || [];
              if (!arr.includes(p.id)) {
                await settingsRepository.put({ key: 'startedPlans', value: [...arr, p.id] });
              }
              setSaveError(null);
              setStarted(true);
            } catch {
              setSaveError('No se pudo empezar el plan.');
            }
          }}>{unlocked ? 'Empezar plan' : 'Bloqueado'}</Button>
        </div>
      )}

      {saveError && (
        <p role="alert" className="border border-ink bg-secondary px-3 py-2 text-sm text-foreground">
          {saveError}
        </p>
      )}

      {!unlocked && lockReason && (
        <div className="border border-ink bg-secondary p-3">
          <p className="text-sm text-foreground">{lockReason}</p>
        </div>
      )}

      {progression.error && (
        <p role="alert" className="border border-ink bg-secondary px-3 py-2 text-sm text-foreground">
          No se pudo leer el progreso: el nivel actual y los desbloqueos pueden verse reiniciados.
        </p>
      )}

      <div className="grid divide-y divide-border border border-border bg-card sm:grid-cols-2 sm:divide-x sm:divide-y-0">
        <div className="p-3">
          <span className="label-caps text-muted-foreground">Frecuencia</span>
          <p className="metric text-base text-foreground mt-1">{p.frequency}</p>
        </div>
        <div className="p-3">
          <span className="label-caps text-muted-foreground">Descanso entre sesiones</span>
          <p className="metric text-base text-foreground mt-1">{p.restBetweenSessions}</p>
        </div>
      </div>

      {(p.objectives.length > 0 || p.rules.length > 0 || (report?.anchors.length ?? 0) > 0) && (
        <div className="border border-border bg-card">
          {detailPanels > 0 && (
            <div className={detailPanels === 2
              ? 'grid divide-y divide-border sm:grid-cols-2 sm:divide-x sm:divide-y-0'
              : 'grid'}>
              {p.objectives.length > 0 && (
                <div className="p-3 space-y-1.5">
                  <span className="label-caps text-muted-foreground">Objetivos</span>
                  <ul className="space-y-1">
                    {p.objectives.map((o) => (
                      <li key={o} className="text-sm text-foreground">· {o}</li>
                    ))}
                  </ul>
                </div>
              )}
              {p.rules.length > 0 && (
                <div className="p-3 space-y-1.5">
                  <span className="label-caps text-muted-foreground">Reglas</span>
                  <ul className="space-y-1">
                    {p.rules.map((r) => (
                      <li key={r} className="text-sm text-foreground">· {r}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          {(report?.anchors.length ?? 0) > 0 && (
            <div className="border-t border-border p-3 space-y-2">
              <p className="text-sm text-muted-foreground">¿Te sentís preparado para avanzar de nivel? Tomá tus marcas: con estas se abre el nivel siguiente.</p>
              <ul className="space-y-1">
                {report!.anchors.map((a) => (
                  <li key={`${a.ejercicio}-${a.objetivo}`} className="flex items-center gap-2 text-sm">
                    <span className={a.met ? 'text-ink' : 'text-muted-foreground'}>{a.met ? '✓' : '○'}</span>
                    <span className="metric text-foreground">{a.objetivo}</span>
                    <span className="text-muted-foreground">{a.unidad === 'sec' ? 'seg' : 'reps'}</span>
                    <span className="text-foreground">{a.ejercicio}</span>
                    {a.mejor > 0 && (
                      <span className="label-caps text-muted-foreground">(mejor: {a.mejor})</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {special.length > 0 && (
        <section>
          <div className="border-b border-border pb-2 mb-4 flex items-center justify-between">
            <span className="label-caps text-foreground">Marcas</span>
            <span className="metric text-sm text-muted-foreground">{special.length}</span>
          </div>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {special.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 border border-border bg-card px-3 py-2">
                <div className="min-w-0">
                  <span className="block text-sm font-medium leading-tight text-foreground">{m.name}</span>
                  <span className="label-status mt-1 inline-block text-muted-foreground">toma de marcas</span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Link to={`/routine/${m.id}`}>
                    <Button variant="outline" size="lg">Registrar marca</Button>
                  </Link>
                  <DropdownMenu>
                    <DropdownMenuTrigger className="inline-flex h-11 w-11 shrink-0 items-center justify-center border border-border text-muted-foreground hover:text-ink hover:bg-secondary hover:border-ink" aria-label="Acciones">
                      <MoreHorizontal className="h-4 w-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openModelEdit(m)}>Editar</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive" onClick={() => setModelDelete(m.id)}>Borrar</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <div className="border-b border-border pb-2 mb-4 flex items-center justify-between">
          <span className="label-caps text-foreground">Rutinas</span>
          <span className="metric text-sm text-muted-foreground">{routines.length}</span>
        </div>
        {routines.length === 0 && (
          <div className="border border-border bg-card p-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              Este programa todavía no tiene rutinas. Creá la primera para poder entrenarlo.
            </p>
            <Button variant="outline" size="lg" onClick={() => setModelCreateOpen(true)}>Nueva rutina</Button>
          </div>
        )}
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {routines.map((m) => (
            <ContextMenu key={m.id}>
              <ContextMenuTrigger className="block h-full">
                <Card className="flex h-full flex-col gap-2 px-3 py-3 transition-colors hover:ring-ink">
                  <div className="flex items-start justify-between gap-2">
                    <Link to={`/routine/${m.id}`} className="block min-w-0 flex-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                      <h3 className="text-sm font-medium leading-tight text-foreground">{m.name}</h3>
                      <div className="mt-2 grid grid-cols-3 gap-2">
                        <div>
                          <span className="label-caps text-muted-foreground">Minutos</span>
                          <p className="metric text-base text-foreground">{m.totalTimeMin > 0 ? m.totalTimeMin : '—'}</p>
                        </div>
                        <div>
                          <span className="label-caps text-muted-foreground">Intensidad</span>
                          <p className="metric text-base text-foreground">{m.intensity}</p>
                        </div>
                        <div>
                          <span className="label-caps text-muted-foreground">Ejercicios</span>
                          <p className="metric text-base text-foreground">{exerciseCount(m) > 0 ? exerciseCount(m) : '—'}</p>
                        </div>
                      </div>
                      <RoutineTags routineId={m.id} />
                    </Link>
                    <DropdownMenu>
                      <DropdownMenuTrigger className="inline-flex h-11 w-11 shrink-0 items-center justify-center border border-border text-muted-foreground hover:text-ink hover:bg-secondary hover:border-ink" aria-label="Acciones">
                        <MoreHorizontal className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openModelEdit(m)}>Editar</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive" onClick={() => setModelDelete(m.id)}>Borrar</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </Card>
              </ContextMenuTrigger>
              <ContextMenuContent>
                <ContextMenuItem onClick={() => openModelEdit(m)}>Editar</ContextMenuItem>
                <ContextMenuSub>
                  <ContextMenuSubTrigger>Etiquetas</ContextMenuSubTrigger>
                  <ContextMenuSubContent className="w-64 p-2">
                    <TagsMenu targetType="routine" targetId={m.id} />
                  </ContextMenuSubContent>
                </ContextMenuSub>
                <ContextMenuSeparator />
                <ContextMenuItem className="text-destructive" onClick={() => setModelDelete(m.id)}>Borrar</ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          ))}
        </div>
      </section>
    </div>
  );
}
