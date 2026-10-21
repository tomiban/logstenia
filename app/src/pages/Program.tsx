import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getProgram, updateProgram, createModel, deleteModel, updateModel, deleteProgram } from '../lib/plans';
import { usePlansVersion } from '../lib/usePlans';
import { uniqueId } from '../lib/ids';
import { chainFor, getProgressionIndex, isUnlocked, unlockedReason, anchorsFor } from '../lib/progression';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MoreHorizontal } from 'lucide-react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent } from '@/components/ui/dropdown-menu';
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
import { TagsMenu } from '../components/ui/tags-menu';
import { db } from '../db';

export default function Program() {
  const { id } = useParams();
  usePlansVersion();
  const p = getProgram(id || '');

  const [progIdx, setProgIdx] = useState<number | null>(null);
  const [unlocked, setUnlocked] = useState(true);
  const [lockReason, setLockReason] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const [marks, setMarks] = useState<any[]>([]);
  const [challengeAnchors, setChallengeAnchors] = useState<any[]>([]);

  // program edit
  const [progEditOpen, setProgEditOpen] = useState(false);
  const [progForm, setProgForm] = useState<any>(null);

  // model create/edit/delete
  const [modelCreateOpen, setModelCreateOpen] = useState(false);
  const [newModelName, setNewModelName] = useState('');
  const [modelEdit, setModelEdit] = useState<{ id: string; form: any } | null>(null);
  const [modelDelete, setModelDelete] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    if (!p) return;
    const chain = chainFor(p.id);
    if (chain) getProgressionIndex(p.id).then(setProgIdx);
    isUnlocked(p.id).then(setUnlocked);
    unlockedReason(p.id).then(setLockReason);
    (async () => {
      const r = await db.settings.get('startedPlans');
      const arr = (r?.value as string[]) || [];
      setStarted(arr.includes(p.id));
      setMarks(await db.marks.toArray());
      setChallengeAnchors(await anchorsFor(p.id));
    })();
  }, [p]);

  if (!p) return <p className="label-caps">Programa no encontrado.</p>;

  const normalModels = p.models.filter((m) => !m.benchmark);
  const specialModels = p.models.filter((m) => m.benchmark);

  const openProgEdit = () => {
    setProgForm({
      name: p.name, level: p.level, description: p.description,
      objectives: (p.objectives || []).join('\n'),
      rules: (p.rules || []).join('\n'),
      frequency: p.frequency, restBetweenSessions: p.restBetweenSessions,
      optional: !!p.optional,
    });
    setProgEditOpen(true);
  };
  const saveProg = async () => {
    if (!progForm) return;
    await updateProgram(p.id, {
      name: progForm.name.trim(),
      level: progForm.level,
      description: progForm.description.trim(),
      objectives: progForm.objectives.split('\n').map((s: string) => s.trim()).filter(Boolean),
      rules: progForm.rules.split('\n').map((s: string) => s.trim()).filter(Boolean),
      frequency: progForm.frequency.trim(),
      restBetweenSessions: progForm.restBetweenSessions.trim(),
      optional: progForm.optional,
    });
    setProgEditOpen(false);
    setProgForm(null);
  };

  const saveNewModel = async () => {
    if (!newModelName.trim()) return;
    const existing = new Set(p.models.map((m: any) => m.id));
    const id = uniqueId(newModelName, existing);
    await createModel(p.id, { id, name: newModelName.trim(), intensity: 1, totalTimeMin: 0, blocks: [], tags: [] } as any);
    setNewModelName('');
    setModelCreateOpen(false);
  };

  const openModelEdit = (m: any) => {
    setModelEdit({
      id: m.id,
      form: { name: m.name, intensity: m.intensity, totalTimeMin: m.totalTimeMin, benchmark: !!m.benchmark },
    });
  };
  const saveModelEdit = async () => {
    if (!modelEdit) return;
    await updateModel(modelEdit.id, {
      name: modelEdit.form.name.trim(),
      intensity: Number(modelEdit.form.intensity) as any,
      totalTimeMin: Number(modelEdit.form.totalTimeMin),
      benchmark: modelEdit.form.benchmark,
    });
    setModelEdit(null);
  };
  const confirmDeleteModel = async () => {
    if (!modelDelete) return;
    await deleteModel(modelDelete.id);
    setModelDelete(null);
  };

  const removeProgram = async () => {
    if (!window.confirm('¿Borrar este programa y sus rutinas?')) return;
    await deleteProgram(p.id);
    window.location.href = `/skill/${p.categoryId}`;
  };

  return (
    <div className="space-y-6">
      <div>
        <Link to="/" className="label-caps text-[var(--muted)] hover:text-[var(--ink)]">← Volver</Link>
      </div>

      <header className="border-b border-[var(--border)] pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-heading text-3xl font-bold tracking-tight text-[var(--foreground)]">{p.name}</h1>
            <p className="mt-1 text-sm text-[var(--muted)]">{p.description}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {p.optional && <Badge variant="secondary" className="label-status">Opcional</Badge>}
            <Button size="sm" variant="ghost" onClick={openProgEdit}>Editar programa</Button>
            <Button size="sm" variant="ghost" onClick={removeProgram}>Borrar programa</Button>
            <Button size="sm" onClick={() => setModelCreateOpen(true)}>Nueva rutina</Button>
          </div>
        </div>
        {chainFor(p.id) && progIdx !== null && (
          <p className="label-caps mt-3 text-[var(--muted)]">
            Fase <span className="metric text-base text-[var(--foreground)]">{progIdx + 1}</span> de {chainFor(p.id)!.length}
            {progIdx < chainFor(p.id)!.length - 1 && (
              <> · Siguiente: <span className="text-[var(--foreground)]">{getProgram(chainFor(p.id)![progIdx + 1])?.name}</span></>
            )}
          </p>
        )}
      </header>

      <Dialog open={progEditOpen} onOpenChange={setProgEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Editar programa</DialogTitle></DialogHeader>
          {progForm && (
            <div className="space-y-3">
              <div className="space-y-1.5"><Label>Nombre</Label><Input value={progForm.name} onChange={(e) => setProgForm({ ...progForm, name: e.target.value })} /></div>
              <div className="space-y-1.5">
                <Label>Nivel</Label>
                <Select value={progForm.level} onValueChange={(v) => setProgForm({ ...progForm, level: (v ?? "") as string })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="beginner">principiante</SelectItem>
                    <SelectItem value="intermediate">intermedio</SelectItem>
                    <SelectItem value="advanced">avanzado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Descripción</Label><Input value={progForm.description} onChange={(e) => setProgForm({ ...progForm, description: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Objetivos (uno por línea)</Label><Textarea value={progForm.objectives} onChange={(e) => setProgForm({ ...progForm, objectives: e.target.value })} rows={3} /></div>
              <div className="space-y-1.5"><Label>Reglas (uno por línea)</Label><Textarea value={progForm.rules} onChange={(e) => setProgForm({ ...progForm, rules: e.target.value })} rows={3} /></div>
              <div className="space-y-1.5"><Label>Frecuencia</Label><Input value={progForm.frequency} onChange={(e) => setProgForm({ ...progForm, frequency: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Descanso entre sesiones</Label><Input value={progForm.restBetweenSessions} onChange={(e) => setProgForm({ ...progForm, restBetweenSessions: e.target.value })} /></div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={progForm.optional} onChange={(e) => setProgForm({ ...progForm, optional: e.target.checked })} />
                Opcional
              </label>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setProgEditOpen(false); setProgForm(null); }}>Cancelar</Button>
            <Button onClick={saveProg}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                <Select value={String(modelEdit.form.intensity)} onValueChange={(v) => setModelEdit({ ...modelEdit!, form: { ...modelEdit!.form, intensity: (v ?? "") as string } })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1</SelectItem>
                    <SelectItem value="2">2</SelectItem>
                    <SelectItem value="3">3</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Tiempo total (min)</Label><Input type="number" value={modelEdit.form.totalTimeMin} onChange={(e) => setModelEdit({ ...modelEdit!, form: { ...modelEdit!.form, totalTimeMin: e.target.value } })} /></div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={modelEdit.form.benchmark} onChange={(e) => setModelEdit({ ...modelEdit!, form: { ...modelEdit!.form, benchmark: e.target.checked } })} />
                Benchmark
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
            <AlertDialogAction onClick={confirmDeleteModel}>Borrar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {!started && (
        <div className="border border-[var(--ink)] bg-[var(--voltage-lime)] p-3 flex items-center justify-between gap-3">
          <span className="label-caps text-[var(--ink)]">¿Empezar este plan? Se registrará con 0% de progreso en Inicio.</span>
          <Button variant="default" size="sm" disabled={!unlocked} onClick={async () => {
            const r = await db.settings.get('startedPlans');
            const arr = (r?.value as string[]) || [];
            if (!arr.includes(p.id)) {
              await db.settings.put({ key: 'startedPlans', value: [...arr, p.id] });
            }
            setStarted(true);
          }}>{unlocked ? 'Empezar plan' : 'Bloqueado'}</Button>
        </div>
      )}

      {!unlocked && (
        <div className="border border-[var(--ink)] bg-[var(--muted-surface)] p-3">
          <p className="label-caps text-[var(--foreground)]">{lockReason}</p>
        </div>
      )}

      <div className="grid gap-px border border-[var(--border)] bg-[var(--border)] sm:grid-cols-2">
        <div className="bg-[var(--surface)] p-3">
          <span className="label-caps text-[var(--muted)]">Frecuencia</span>
          <p className="metric text-base text-[var(--foreground)] mt-1">{p.frequency}</p>
        </div>
        <div className="bg-[var(--surface)] p-3">
          <span className="label-caps text-[var(--muted)]">Descanso entre sesiones</span>
          <p className="metric text-base text-[var(--foreground)] mt-1">{p.restBetweenSessions}</p>
        </div>
      </div>

      {(p.objectives.length > 0 || p.rules.length > 0 || specialModels.length > 0) && (
        <div className="border border-[var(--border)] bg-[var(--border)]">
          <div className="grid sm:grid-cols-2 gap-px">
            {p.objectives.length > 0 && (
              <div className="bg-[var(--surface)] p-3 space-y-1.5">
                <span className="label-caps text-[var(--muted)]">Objetivos</span>
                <ul className="space-y-1">
                  {p.objectives.map((o, i) => (
                    <li key={i} className="text-sm text-[var(--foreground)]">· {o}</li>
                  ))}
                </ul>
              </div>
            )}
            {p.rules.length > 0 && (
              <div className="bg-[var(--surface)] p-3 space-y-1.5">
                <span className="label-caps text-[var(--muted)]">Reglas</span>
                <ul className="space-y-1">
                  {p.rules.map((r, i) => (
                    <li key={i} className="text-sm text-[var(--foreground)]">· {r}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          {specialModels.length > 0 && (
            <div className="bg-[var(--surface)] p-3 space-y-2 border-t border-[var(--border)]">
              <p className="text-sm text-[var(--muted)]">¿Te sentís preparado para avanzar de nivel? Tomá tus marcas.</p>
              {challengeAnchors.length > 0 && (
                <ul className="space-y-1">
                  {challengeAnchors.map((a, i) => {
                    const best = marks.filter((m: any) => m.exercise === a.ejercicio).reduce((acc: number, m: any) => Math.max(acc, m.value), 0);
                    const met = best >= a.objetivo;
                    return (
                      <li key={i} className="flex items-center gap-2 text-sm">
                        <span className={met ? 'text-[var(--voltage-lime)]' : 'text-[var(--muted)]'}>{met ? '✓' : '○'}</span>
                        <span className="metric text-[var(--foreground)]">{a.objetivo}</span>
                        <span className="text-[var(--muted)]">{a.unidad}</span>
                        <span className="text-[var(--foreground)]">{a.ejercicio}</span>
                        {best > 0 && (
                          <span className="label-caps text-[var(--muted)]">(mejor: {best})</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
              {specialModels.map((m) => (
                <div key={m.id} className="flex items-center justify-between gap-3 pt-2">
                  <span className="label-caps text-[var(--muted)]">{m.name}</span>
                  <Link to={`/routine/${m.id}`}>
                    <Button variant="default" size="sm">Registrar marca</Button>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <section>
        <div className="border-b border-[var(--border)] pb-2 mb-4 flex items-center justify-between">
          <span className="label-caps text-[var(--foreground)]">Rutinas</span>
          <span className="metric text-sm text-[var(--muted)]">{normalModels.length}</span>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {normalModels.map((m) => (
            <div key={m.id}>
              <Card className="flex h-full flex-col gap-2 px-3 py-2 transition-colors hover:border-[var(--ink)]">
                <div className="flex items-start justify-between gap-2">
                  <Link to={`/routine/${m.id}`} className="block min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium leading-tight">{m.name}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      <Badge variant="secondary" className="label-status">{m.totalTimeMin} min</Badge>
                      <Badge variant="outline" className="label-status border-[var(--border)] text-[var(--muted)]">intensidad {m.intensity}</Badge>
                    </div>
                  </Link>
                  <DropdownMenu>
                    <DropdownMenuTrigger className="inline-flex h-7 w-7 items-center justify-center text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--muted-surface)]"><MoreHorizontal className="h-4 w-4" /></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openModelEdit(m)}>Editar</DropdownMenuItem>
                      <DropdownMenuSub>
                        <DropdownMenuSubTrigger>Etiquetas</DropdownMenuSubTrigger>
                        <DropdownMenuSubContent className="w-64 p-2">
                          <TagsMenu targetType="routine" targetId={m.id} />
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-[var(--alert)]" onClick={() => setModelDelete({ id: m.id, name: m.name })}>Borrar</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </Card>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
