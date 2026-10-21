import { useParams, Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { getModel, updateModel, createBlock, updateBlock, deleteBlock, createExercise, updateExercise, deleteExercise } from '../lib/plans';
import { usePlansVersion } from '../lib/usePlans';
import { uniqueId } from '../lib/ids';
import { addTag } from '../lib/tags';
import Video from '../components/Video';
import { Button } from '@/components/ui/button';
import { MoreHorizontal } from 'lucide-react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { TagsInput } from '../components/ui/tags-input';
import { TagsMenu } from '../components/ui/tags-menu';
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

function fmtRest(sec: number) { return sec >= 60 ? `${Math.round(sec / 60)}min` : `${sec}s`; }

function youtubeId(url: string): string | null {
  const m = url.match(/(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

const BLOCK_TYPES = ['single', 'biseries', 'superseries'] as const;

export default function Routine() {
  const { id } = useParams();
  usePlansVersion();
  const res = getModel(id || '');

  const [editing, setEditing] = useState(false);

  // model edit
  const [modelEditOpen, setModelEditOpen] = useState(false);
  const [modelForm, setModelForm] = useState<any>(null);

  // block create/edit
  const [blockCreateOpen, setBlockCreateOpen] = useState(false);
  const [newBlock, setNewBlock] = useState<any>({ type: 'single', sets: 1, restBetweenSetsSec: 60, restBetweenExercisesSec: '' });
  const [blockEdit, setBlockEdit] = useState<{ index: number; form: any } | null>(null);
  const [blockDelete, setBlockDelete] = useState<number | null>(null);

  // exercise create/edit
  const [exCreate, setExCreate] = useState<{ blockIndex: number } | null>(null);
  const [newEx, setNewEx] = useState<any>({ name: '', reps: '', timeSec: '', cadence: '', notes: '' });
  const [exEdit, setExEdit] = useState<{ bi: number; ei: number; form: any } | null>(null);
  const [exDelete, setExDelete] = useState<{ bi: number; ei: number } | null>(null);
  const [urlEdit, setUrlEdit] = useState<{ bi: number; ei: number; url: string } | null>(null);

  useEffect(() => {
    if (!res) return;
    const { model } = res;
    (async () => {
      for (const b of model.blocks) {
        for (const e of b.exercises) {
          if (e.name.toLowerCase().includes('hold') || e.timeSec) {
            await addTag('exercise', e.id || e.name, 'isometricos');
          }
        }
      }
    })();
  }, [id, res?.model?.blocks?.length]);

  if (!res) return <p className="label-caps">Rutina no encontrada.</p>;
  const { model, program } = res;

  const openModelEdit = () => {
    setModelForm({ name: model.name, intensity: model.intensity, totalTimeMin: model.totalTimeMin });
    setModelEditOpen(true);
  };
  const saveModelEdit = async () => {
    if (!modelForm) return;
    await updateModel(model.id, {
      name: modelForm.name.trim(),
      intensity: Number(modelForm.intensity) as any,
      totalTimeMin: Number(modelForm.totalTimeMin),
    });
    setModelEditOpen(false);
    setModelForm(null);
  };

  const saveNewBlock = async () => {
    const block: any = {
      type: newBlock.type,
      sets: Number(newBlock.sets) || 1,
      restBetweenSetsSec: Number(newBlock.restBetweenSetsSec) || 0,
      exercises: [],
    };
    if (newBlock.restBetweenExercisesSec !== '' && newBlock.restBetweenExercisesSec != null) {
      block.restBetweenExercisesSec = Number(newBlock.restBetweenExercisesSec);
    }
    await createBlock(model.id, block);
    setNewBlock({ type: 'single', sets: 1, restBetweenSetsSec: 60, restBetweenExercisesSec: '' });
    setBlockCreateOpen(false);
  };

  const openBlockEdit = (i: number) => {
    const b = model.blocks[i];
    setBlockEdit({
      index: i,
      form: {
        type: b.type,
        sets: b.sets,
        restBetweenSetsSec: b.restBetweenSetsSec,
        restBetweenExercisesSec: b.restBetweenExercisesSec ?? '',
      },
    });
  };
  const saveBlockEdit = async () => {
    if (!blockEdit) return;
    const f = blockEdit.form;
    const patch: any = {
      type: f.type,
      sets: Number(f.sets) || 1,
      restBetweenSetsSec: Number(f.restBetweenSetsSec) || 0,
    };
    if (f.restBetweenExercisesSec !== '' && f.restBetweenExercisesSec != null) {
      patch.restBetweenExercisesSec = Number(f.restBetweenExercisesSec);
    } else {
      patch.restBetweenExercisesSec = undefined;
    }
    await updateBlock(model.id, blockEdit.index, patch);
    setBlockEdit(null);
  };
  const confirmDeleteBlock = async () => {
    if (blockDelete === null) return;
    await deleteBlock(model.id, blockDelete);
    setBlockDelete(null);
  };

  const saveNewEx = async () => {
    if (!exCreate || !newEx.name.trim()) return;
    const bi = exCreate.blockIndex;
    const block = model.blocks[bi];
    const existing = new Set(block.exercises.map((e: any) => e.id).filter(Boolean));
    const id = uniqueId(newEx.name, existing);
    const ex: any = { id, name: newEx.name.trim() };
    if (newEx.reps.trim()) ex.reps = newEx.reps.trim();
    if (newEx.timeSec !== '') ex.timeSec = Number(newEx.timeSec);
    if (newEx.cadence.trim()) ex.cadence = newEx.cadence.trim();
    if (newEx.notes.trim()) ex.notes = newEx.notes.trim();
    await createExercise(model.id, bi, ex);
    setNewEx({ name: '', reps: '', timeSec: '', cadence: '', notes: '' });
    setExCreate(null);
  };

  const openExEdit = (bi: number, ei: number) => {
    const e = model.blocks[bi].exercises[ei];
    setExEdit({
      bi, ei,
      form: {
        name: e.name,
        reps: e.reps ?? '',
        timeSec: e.timeSec ?? '',
        cadence: e.cadence ?? '',
        notes: e.notes ?? '',
      },
    });
  };
  const saveExEdit = async () => {
    if (!exEdit) return;
    const f = exEdit.form;
    const patch: any = { name: f.name.trim() };
    patch.reps = f.reps.trim() || undefined;
    patch.timeSec = f.timeSec === '' ? undefined : Number(f.timeSec);
    patch.cadence = f.cadence.trim() || undefined;
    patch.notes = f.notes.trim() || undefined;
    await updateExercise(model.id, exEdit.bi, exEdit.ei, patch);
    setExEdit(null);
  };
  const confirmDeleteEx = async () => {
    if (!exDelete) return;
    await deleteExercise(model.id, exDelete.bi, exDelete.ei);
    setExDelete(null);
  };

  const saveUrlEdit = async () => {
    if (!urlEdit) return;
    const { bi, ei, url } = urlEdit;
    const id = youtubeId(url.trim());
    const ex = model.blocks[bi].exercises[ei];
    if (id) {
      await updateExercise(model.id, bi, ei, {
        video: { id, title: ex.name, channel: '', url: `https://www.youtube.com/watch?v=${id}`, thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg` },
      });
    } else if (url.trim() === '') {
      await updateExercise(model.id, bi, ei, { video: undefined });
    }
    setUrlEdit(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <Link to={`/program/${program.id}`} className="label-caps text-[var(--muted)] hover:text-[var(--ink)]">
          ← {program.name}
        </Link>
      </div>

      <header className="border-b border-[var(--border)] pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="font-heading text-3xl font-bold tracking-tight text-[var(--foreground)]">{model.name}</h1>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setEditing((v) => !v)}>
              {editing ? 'Cerrar edición' : 'Editar rutina'}
            </Button>
            <Button size="sm" variant="ghost" onClick={openModelEdit}>Editar datos</Button>
          </div>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <p className="text-sm text-[var(--muted)]">
            Intensidad {model.intensity} · {model.totalTimeMin} min
            {program.rules.length > 0 && ` · ${program.rules.join(' · ')}`}
          </p>
          <TagsInput targetType="routine" targetId={model.id} allowAdd={false} />
        </div>
      </header>

      <Dialog open={modelEditOpen} onOpenChange={setModelEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar rutina</DialogTitle></DialogHeader>
          {modelForm && (
            <div className="space-y-3">
              <div className="space-y-1.5"><Label>Nombre</Label><Input value={modelForm.name} onChange={(e) => setModelForm({ ...modelForm, name: e.target.value })} /></div>
              <div className="space-y-1.5">
                <Label>Intensidad</Label>
                <Select value={String(modelForm.intensity)} onValueChange={(v) => setModelForm({ ...modelForm, intensity: (v ?? "") as string })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1</SelectItem>
                    <SelectItem value="2">2</SelectItem>
                    <SelectItem value="3">3</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Tiempo total (min)</Label><Input type="number" value={modelForm.totalTimeMin} onChange={(e) => setModelForm({ ...modelForm, totalTimeMin: e.target.value })} /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setModelEditOpen(false); setModelForm(null); }}>Cancelar</Button>
            <Button onClick={saveModelEdit}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {editing && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setBlockCreateOpen(true)}>+ Bloque</Button>
        </div>
      )}

      <Dialog open={blockCreateOpen} onOpenChange={setBlockCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nuevo bloque</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={newBlock.type} onValueChange={(v) => setNewBlock({ ...newBlock, type: (v ?? "") as string })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {BLOCK_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Sets</Label><Input type="number" value={newBlock.sets} onChange={(e) => setNewBlock({ ...newBlock, sets: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Descanso entre sets (s)</Label><Input type="number" value={newBlock.restBetweenSetsSec} onChange={(e) => setNewBlock({ ...newBlock, restBetweenSetsSec: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Descanso entre ejercicios (s)</Label><Input type="number" value={newBlock.restBetweenExercisesSec} onChange={(e) => setNewBlock({ ...newBlock, restBetweenExercisesSec: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setBlockCreateOpen(false)}>Cancelar</Button>
            <Button onClick={saveNewBlock}>Agregar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!blockEdit} onOpenChange={(o) => !o && setBlockEdit(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar bloque</DialogTitle></DialogHeader>
          {blockEdit && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <Select value={blockEdit.form.type} onValueChange={(v) => setBlockEdit({ ...blockEdit!, form: { ...blockEdit!.form, type: (v ?? "") as string } })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {BLOCK_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Sets</Label><Input type="number" value={blockEdit.form.sets} onChange={(e) => setBlockEdit({ ...blockEdit!, form: { ...blockEdit!.form, sets: e.target.value } })} /></div>
              <div className="space-y-1.5"><Label>Descanso entre sets (s)</Label><Input type="number" value={blockEdit.form.restBetweenSetsSec} onChange={(e) => setBlockEdit({ ...blockEdit!, form: { ...blockEdit!.form, restBetweenSetsSec: e.target.value } })} /></div>
              <div className="space-y-1.5"><Label>Descanso entre ejercicios (s)</Label><Input type="number" value={blockEdit.form.restBetweenExercisesSec} onChange={(e) => setBlockEdit({ ...blockEdit!, form: { ...blockEdit!.form, restBetweenExercisesSec: e.target.value } })} /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setBlockEdit(null)}>Cancelar</Button>
            <Button onClick={saveBlockEdit}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={blockDelete !== null} onOpenChange={(o) => !o && setBlockDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Borrar bloque?</AlertDialogTitle>
            <AlertDialogDescription>Se borrarán sus ejercicios.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteBlock}>Borrar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!exCreate} onOpenChange={(o) => !o && setExCreate(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nuevo ejercicio</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Nombre</Label><Input value={newEx.name} onChange={(e) => setNewEx({ ...newEx, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5"><Label>Reps</Label><Input value={newEx.reps} onChange={(e) => setNewEx({ ...newEx, reps: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Tiempo (s)</Label><Input type="number" value={newEx.timeSec} onChange={(e) => setNewEx({ ...newEx, timeSec: e.target.value })} /></div>
            </div>
            <div className="space-y-1.5"><Label>Cadencia</Label><Input value={newEx.cadence} onChange={(e) => setNewEx({ ...newEx, cadence: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Notas</Label><Textarea value={newEx.notes} onChange={(e) => setNewEx({ ...newEx, notes: e.target.value })} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setExCreate(null)}>Cancelar</Button>
            <Button onClick={saveNewEx}>Agregar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!exEdit} onOpenChange={(o) => !o && setExEdit(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar ejercicio</DialogTitle></DialogHeader>
          {exEdit && (
            <div className="space-y-3">
              <div className="space-y-1.5"><Label>Nombre</Label><Input value={exEdit.form.name} onChange={(e) => setExEdit({ ...exEdit!, form: { ...exEdit!.form, name: e.target.value } })} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5"><Label>Reps</Label><Input value={exEdit.form.reps} onChange={(e) => setExEdit({ ...exEdit!, form: { ...exEdit!.form, reps: e.target.value } })} /></div>
                <div className="space-y-1.5"><Label>Tiempo (s)</Label><Input type="number" value={exEdit.form.timeSec} onChange={(e) => setExEdit({ ...exEdit!, form: { ...exEdit!.form, timeSec: e.target.value } })} /></div>
              </div>
              <div className="space-y-1.5"><Label>Cadencia</Label><Input value={exEdit.form.cadence} onChange={(e) => setExEdit({ ...exEdit!, form: { ...exEdit!.form, cadence: e.target.value } })} /></div>
              <div className="space-y-1.5"><Label>Notas</Label><Textarea value={exEdit.form.notes} onChange={(e) => setExEdit({ ...exEdit!, form: { ...exEdit!.form, notes: e.target.value } })} rows={2} /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setExEdit(null)}>Cancelar</Button>
            <Button onClick={saveExEdit}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!urlEdit} onOpenChange={(o) => !o && setUrlEdit(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>URL de video</DialogTitle></DialogHeader>
          {urlEdit && (
            <div className="space-y-1.5">
              <Label>URL de YouTube</Label>
              <Input value={urlEdit.url} onChange={(e) => setUrlEdit({ ...urlEdit, url: e.target.value })} placeholder="https://www.youtube.com/watch?v=..." />
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setUrlEdit(null)}>Cancelar</Button>
            <Button onClick={saveUrlEdit}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!exDelete} onOpenChange={(o) => !o && setExDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Borrar ejercicio?</AlertDialogTitle>
            <AlertDialogDescription>Se eliminará de la rutina.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteEx}>Borrar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="space-y-4">
        {model.blocks.map((b, i) => (
          <section key={i} className="border border-[var(--border)]">
            <div className="border-b border-[var(--border)] bg-[var(--muted-surface)] px-3 py-2 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="label-caps text-[var(--foreground)]">{b.type}</span>
                <span className="label-caps text-[var(--muted)]">
                  {b.sets} vuelta(s) · descanso {fmtRest(b.restBetweenSetsSec)}
                  {b.restBetweenExercisesSec ? ` · entre ejercicios ${fmtRest(b.restBetweenExercisesSec)}` : ''}
                </span>
              </div>
              {editing && (
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setExCreate({ blockIndex: i })}>+ Ejercicio</Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger className="inline-flex h-7 w-7 items-center justify-center text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--muted-surface)]"><MoreHorizontal className="h-4 w-4" /></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openBlockEdit(i)}>Editar bloque</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-[var(--alert)]" onClick={() => setBlockDelete(i)}>Borrar bloque</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
            </div>
            <ul className="divide-y divide-[var(--border)]">
              {b.exercises.map((e, j) => (
                <li key={j} className="px-3 py-3 bg-[var(--surface)]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <span className="block font-heading text-base font-bold text-[var(--foreground)]">{e.name}</span>
                    </div>
                    <div className="shrink-0 flex items-center gap-2">
                      {editing && (
                        <DropdownMenu>
                          <DropdownMenuTrigger className="inline-flex h-7 w-7 items-center justify-center text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--muted-surface)]"><MoreHorizontal className="h-4 w-4" /></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openExEdit(i, j)}>Editar</DropdownMenuItem>
                            <DropdownMenuSub>
                              <DropdownMenuSubTrigger>Etiquetas</DropdownMenuSubTrigger>
                              <DropdownMenuSubContent className="w-64 p-2">
                                <TagsMenu targetType="exercise" targetId={e.id || e.name} />
                              </DropdownMenuSubContent>
                            </DropdownMenuSub>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-[var(--alert)]" onClick={() => setExDelete({ bi: i, ei: j })}>Borrar</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                      <Video query={e.name} video={e.video} />
                      <div className="text-right">
                        <span className="metric text-lg text-[var(--foreground)]">
                          {e.timeSec ? `${e.timeSec}s` : e.reps}
                        </span>
                        {e.cadence && (
                          <span className="block label-caps text-[var(--muted)]">CAD {e.cadence}</span>
                        )}
                      </div>
                    </div>
                  </div>

                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {!editing && (
        <div>
          <Link to={`/run/${model.id}`} className="block">
            <Button className="w-full">Iniciar rutina</Button>
          </Link>
        </div>
      )}
    </div>
  );
}
