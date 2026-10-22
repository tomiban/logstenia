import { useParams, Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { BackLink } from '@/components/BackLink';
import { getModel, updateModel, createBlock, updateBlock, deleteBlock, createExercise, updateExercise, deleteExercise, reorderExercises, moveExercise, allModels } from './plans';
import { usePlansVersion } from '@/hooks/usePlans';
import { uniqueId } from './ids';
import { MoreHorizontal, GripVertical, Pencil, X } from 'lucide-react';
import { addTag } from '@/lib/tags';
import Video from './Video';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuSub, ContextMenuSubTrigger, ContextMenuSubContent } from '@/components/ui/context-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { TagsInput } from '@/components/ui/tags-input';
import { TagsMenu } from '@/components/ui/tags-menu';
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
  const [drag, setDrag] = useState<{ bi: number; ei: number } | null>(null);
  const [dragPayload, setDragPayload] = useState<{ kind: 'bank' | 'routine'; ex?: any; bi?: number; ei?: number } | null>(null);
  const [dropTarget, setDropTarget] = useState<{ bi: number } | null>(null);
  const [search, setSearch] = useState('');
  const [bankOpen, setBankOpen] = useState(false);
  const [editing, setEditing] = useState(false);
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

  const existingExerciseOptions = Array.from(
    new Map(
      allModels()
        .flatMap(({ model: m }) => m.blocks.flatMap((b) => b.exercises))
        .map((e) => [e.id || e.name, e] as const),
    ).values(),
  );

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
        <BackLink to={`/program/${program.id}`}>{program.name}</BackLink>
      </div>

      <header className="border-b border-border pb-4">
        <ContextMenu>
          <ContextMenuTrigger className="min-w-0">
            <h1 className="break-words font-heading text-lg leading-tight font-bold tracking-tight text-foreground sm:text-3xl">{model.name}</h1>
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem onClick={openModelEdit}>Editar datos</ContextMenuItem>
            <ContextMenuSub>
              <ContextMenuSubTrigger>Etiquetas</ContextMenuSubTrigger>
              <ContextMenuSubContent >
                <TagsMenu targetType="routine" targetId={model.id} />
              </ContextMenuSubContent>
            </ContextMenuSub>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={() => setEditing((v) => !v)}>{editing ? 'Cerrar edición' : 'Editar rutina'}</ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
        <p className="mt-1 text-sm text-muted-foreground">
          Intensidad {model.intensity} · {model.totalTimeMin} min
          {program.rules.length > 0 && ` · ${program.rules.join(' · ')}`}
        </p>
        <div className="mt-2 min-w-0">
          <TagsInput targetType="routine" targetId={model.id} className="w-full" />
        </div>
        <div className="mt-2">
          <Button
            size="sm"
            variant={editing ? 'ink' : 'outline'}
            aria-pressed={editing}
            className="gap-1.5"
            onClick={() => setEditing((v) => !v)}
          >
            {editing ? <X aria-hidden="true" /> : <Pencil aria-hidden="true" />}
            {editing ? 'Cerrar edición' : 'Editar rutina'}
          </Button>
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
            <Button variant="accent" onClick={saveModelEdit}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
            <Button variant="accent" onClick={saveNewBlock}>Agregar</Button>
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
            <Button variant="accent" onClick={saveBlockEdit}>Guardar</Button>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="space-y-1.5"><Label>Reps</Label><Input value={newEx.reps} onChange={(e) => setNewEx({ ...newEx, reps: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Tiempo (s)</Label><Input type="number" value={newEx.timeSec} onChange={(e) => setNewEx({ ...newEx, timeSec: e.target.value })} /></div>
            </div>
            <div className="space-y-1.5"><Label>Cadencia</Label><Input value={newEx.cadence} onChange={(e) => setNewEx({ ...newEx, cadence: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Notas</Label><Textarea value={newEx.notes} onChange={(e) => setNewEx({ ...newEx, notes: e.target.value })} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setExCreate(null)}>Cancelar</Button>
            <Button variant="accent" onClick={saveNewEx}>Agregar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!exEdit} onOpenChange={(o) => !o && setExEdit(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar ejercicio</DialogTitle></DialogHeader>
          {exEdit && (
            <div className="space-y-3">
              <div className="space-y-1.5"><Label>Nombre</Label><Input value={exEdit.form.name} onChange={(e) => setExEdit({ ...exEdit!, form: { ...exEdit!.form, name: e.target.value } })} /></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="space-y-1.5"><Label>Reps</Label><Input value={exEdit.form.reps} onChange={(e) => setExEdit({ ...exEdit!, form: { ...exEdit!.form, reps: e.target.value } })} /></div>
                <div className="space-y-1.5"><Label>Tiempo (s)</Label><Input type="number" value={exEdit.form.timeSec} onChange={(e) => setExEdit({ ...exEdit!, form: { ...exEdit!.form, timeSec: e.target.value } })} /></div>
              </div>
              <div className="space-y-1.5"><Label>Cadencia</Label><Input value={exEdit.form.cadence} onChange={(e) => setExEdit({ ...exEdit!, form: { ...exEdit!.form, cadence: e.target.value } })} /></div>
              <div className="space-y-1.5"><Label>Notas</Label><Textarea value={exEdit.form.notes} onChange={(e) => setExEdit({ ...exEdit!, form: { ...exEdit!.form, notes: e.target.value } })} rows={2} /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setExEdit(null)}>Cancelar</Button>
            <Button variant="accent" onClick={saveExEdit}>Guardar</Button>
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
            <Button variant="accent" onClick={saveUrlEdit}>Guardar</Button>
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

      {!editing && (
      <div className="space-y-4">
        {model.blocks.map((b, i) => (
          <section key={i} className="border border-border">
            <ContextMenu>
              <ContextMenuTrigger className="block">
                <div className="border-b border-border bg-secondary px-3 py-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="label-caps text-foreground">{b.type}</span>
                    <span className="label-caps text-muted-foreground">
                      {b.sets} vuelta(s) · descanso {fmtRest(b.restBetweenSetsSec)}
                      {b.restBetweenExercisesSec ? ` · entre ejercicios ${fmtRest(b.restBetweenExercisesSec)}` : ''}
                    </span>
                  </div>
                  {editing && (
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setExCreate({ blockIndex: i })}>+ Ejercicio</Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger className="inline-flex h-7 w-7 items-center justify-center border border-border text-muted-foreground hover:text-ink hover:bg-secondary hover:border-ink" aria-label="Acciones">
                        <MoreHorizontal className="h-4 w-4" />
                      </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setExCreate({ blockIndex: i })}>Nuevo ejercicio</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => openBlockEdit(i)}>Editar bloque</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive" onClick={() => setBlockDelete(i)}>Borrar bloque</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  </div>
                  )}
                </div>
              </ContextMenuTrigger>
              <ContextMenuContent>
                {editing ? (
                  <>
                    <ContextMenuItem onClick={() => setExCreate({ blockIndex: i })}>Nuevo ejercicio</ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem onClick={() => openBlockEdit(i)}>Editar bloque</ContextMenuItem>
                    <ContextMenuSub>
                      <ContextMenuSubTrigger>Etiquetas del bloque</ContextMenuSubTrigger>
                      <ContextMenuSubContent className="w-64 p-2">
                        <TagsMenu targetType="routine" targetId={model.id} />
                      </ContextMenuSubContent>
                    </ContextMenuSub>
                    <ContextMenuSeparator />
                    <ContextMenuItem className="text-destructive" onClick={() => setBlockDelete(i)}>Borrar bloque</ContextMenuItem>
                  </>
                ) : (
                  <ContextMenuItem onClick={() => setEditing(true)}>Editar rutina</ContextMenuItem>
                )}
              </ContextMenuContent>
            </ContextMenu>
            <ul
              className="divide-y divide-border min-h-[2rem]"
              onDragOver={(ev) => ev.preventDefault()}
              onDrop={(ev) => {
                ev.stopPropagation();
                if (!drag) return;
                if (drag.bi === i) {
                  const last = Math.max(0, b.exercises.length - 1);
                  if (drag.ei !== last) reorderExercises(model.id, i, drag.ei, last).then(() => setDrag(null));
                  else setDrag(null);
                } else {
                  moveExercise(model.id, drag.bi, drag.ei, i, b.exercises.length).then(() => setDrag(null));
                }
              }}
            >
              {b.exercises.map((e, j) => (
                <li
                  key={j}
                  draggable={editing}
                  onDragStart={() => { if (editing) setDrag({ bi: i, ei: j }); }}
                  onDragOver={(ev) => ev.preventDefault()}
                  onDragEnd={() => setDrag(null)}
                  onDrop={(ev) => {
                    ev.stopPropagation();
                    if (!drag) { setDrag(null); return; }
                    if (drag.bi === i && drag.ei === j) { setDrag(null); return; }
                    if (drag.bi === i) {
                      reorderExercises(model.id, i, drag.ei, j).then(() => setDrag(null));
                    } else {
                      moveExercise(model.id, drag.bi, drag.ei, i, j).then(() => setDrag(null));
                    }
                  }}
                  className={`px-3 py-3 bg-card cursor-move ${drag?.bi === i && drag?.ei === j ? 'opacity-50' : ''}`}
                >
                  <ContextMenu>
                    <ContextMenuTrigger className="block">
                      <div className="grid grid-cols-[minmax(0,1fr)_48px_5ch] items-center gap-2">
                        <div className="flex min-w-0 items-start justify-between gap-2">
                          <span className="block font-heading text-base font-bold text-foreground">{e.name}</span>
                          {editing && (
                          <DropdownMenu>
                            <DropdownMenuTrigger className="inline-flex h-7 w-7 items-center justify-center border border-border text-muted-foreground hover:text-ink hover:bg-secondary hover:border-ink" aria-label="Acciones">
                              <MoreHorizontal className="h-4 w-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openExEdit(i, j)}>Editar</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setUrlEdit({ bi: i, ei: j, url: e.video?.url ?? '' })}>Editar video</DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-destructive" onClick={() => setExDelete({ bi: i, ei: j })}>Borrar</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                          )}
                        </div>
                        <div className="justify-self-center">
                          <Video query={e.name} video={e.video} />
                        </div>
                        <div className="min-w-0 text-right">
                          <span className="metric text-lg text-foreground">
                            {e.timeSec ? `${e.timeSec}s` : e.reps}
                          </span>
                          {e.cadence && (
                            <span className="block label-caps text-muted-foreground">CAD {e.cadence}</span>
                          )}
                        </div>
                      </div>
                    </ContextMenuTrigger>
                    <ContextMenuContent>
                      {editing ? (
                        <>
                          <ContextMenuItem onClick={() => openExEdit(i, j)}>Editar</ContextMenuItem>
                          <ContextMenuItem onClick={() => setUrlEdit({ bi: i, ei: j, url: e.video?.url ?? '' })}>Editar video</ContextMenuItem>
                          <ContextMenuSub>
                            <ContextMenuSubTrigger>Etiquetas</ContextMenuSubTrigger>
                            <ContextMenuSubContent className="w-64 p-2">
                              <TagsMenu targetType="exercise" targetId={e.id || e.name} />
                            </ContextMenuSubContent>
                          </ContextMenuSub>
                          <ContextMenuSeparator />
                          <ContextMenuItem className="text-destructive" onClick={() => setExDelete({ bi: i, ei: j })}>Borrar</ContextMenuItem>
                        </>
                      ) : (
                        <ContextMenuItem onClick={() => setEditing(true)}>Editar rutina</ContextMenuItem>
                      )}
                    </ContextMenuContent>
                  </ContextMenu>
                </li>
              ))}
              {editing && b.exercises.length === 0 && (
                <li className="px-3 py-3 bg-card">
                  <Button size="sm" variant="ghost" onClick={() => setExCreate({ blockIndex: i })}>
                    + Agregar ejercicio
                  </Button>
                </li>
              )}

            </ul>
          </section>
        ))}
      </div>
      )}

      {editing && (
      <>
        <Button className="lg:hidden w-full mb-2" variant="accent" onClick={() => setBankOpen(true)}>Ejercicios</Button>
        <div className="grid gap-4 lg:grid-cols-[260px_1fr] min-w-0">
          <aside className="hidden lg:block border border-border bg-card p-3 space-y-3 h-fit min-w-0">
            <h2 className="font-heading text-base font-bold">Ejercicios</h2>
            <Input placeholder="Buscar ejercicio..." value={search} onChange={(e) => setSearch(e.target.value)} />
            <Button variant="accent" size="sm" className="w-full" onClick={() => {
              if (model.blocks.length === 0) setBlockCreateOpen(true);
              else setExCreate({ blockIndex: model.blocks.length - 1 });
            }}>+ Crear ejercicio</Button>
            <div className="space-y-2 max-h-[60vh] overflow-auto overflow-x-hidden">
              {existingExerciseOptions
                .filter((e) => e.name.toLowerCase().includes(search.toLowerCase()))
                .map((ex) => (
                  <div
                    key={ex.id || ex.name}
                    draggable
                    onDragStart={() => setDragPayload({ kind: 'bank', ex })}
                    onDragEnd={() => setDragPayload(null)}
                    className="border border-border bg-secondary px-3 py-2 cursor-grab text-sm flex items-center gap-2 select-none min-w-0"
                  >
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                    <span className="flex-1 min-w-0 line-clamp-2 break-words">{ex.name}</span>
                  </div>
                ))}
            </div>
          </aside>

          <div className="space-y-3">
          {model.blocks.length === 0 && (
            <p className="text-sm text-muted-foreground">Sin bloques. Agregá el primero con el botón de abajo.</p>
          )}
          {model.blocks.map((b, i) => (
            <section
              key={i}
              onDragOver={(ev) => { ev.preventDefault(); setDropTarget({ bi: i }); }}
              onDragLeave={() => setDropTarget(null)}
              onDrop={(ev) => {
                ev.preventDefault();
                if (!dragPayload) return;
                if (dragPayload.kind === 'bank' && dragPayload.ex) {
                  const existing = new Set(b.exercises.map((e: any) => e.id).filter(Boolean));
                  const id = uniqueId(dragPayload.ex.name, existing);
                  createExercise(model.id, i, { ...dragPayload.ex, id }).then(() => setDragPayload(null));
                } else if (dragPayload.kind === 'routine' && dragPayload.bi !== undefined && dragPayload.ei !== undefined && dragPayload.bi !== i) {
                  moveExercise(model.id, dragPayload.bi, dragPayload.ei, i, b.exercises.length).then(() => setDragPayload(null));
                }
                setDropTarget(null);
              }}
              className={`border border-border bg-card transition-colors ${dropTarget?.bi === i ? 'ring-1 ring-accent' : ''}`}
            >
              <div className="border-b border-border bg-secondary px-3 py-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="label-caps text-foreground">{b.type}</span>
                  <span className="label-caps text-muted-foreground truncate">{b.sets} vuelta(s) · descanso {fmtRest(b.restBetweenSetsSec)}</span>
                </div>
              </div>
              <div className="divide-y divide-border">
                {b.exercises.length === 0 && (
                  <p className="px-3 py-4 text-sm text-muted-foreground">Arrastrá un ejercicio aquí</p>
                )}
                {b.exercises.map((e, j) => (
                  <div
                    key={j}
                    draggable
                    onDragStart={() => setDragPayload({ kind: 'routine', bi: i, ei: j, ex: e })}
                    onDragEnd={() => setDragPayload(null)}
                    className="grid grid-cols-[24px_minmax(0,1fr)_44px] items-center gap-2 px-3 py-2 text-sm cursor-move hover:bg-secondary min-h-[48px]"
                  >
                    <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="min-w-0 line-clamp-2 break-words">{e.name}</span>
                    <DropdownMenu>
                      <DropdownMenuTrigger className="inline-flex h-6 w-6 items-center justify-center border border-border text-muted-foreground hover:text-ink hover:border-ink shrink-0" aria-label="Acciones">
                        <MoreHorizontal className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openExEdit(i, j)}>Editar</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setUrlEdit({ bi: i, ei: j, url: e.video?.url ?? '' })}>Editar video</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive" onClick={() => setExDelete({ bi: i, ei: j })}>Borrar</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))}
              </div>
            </section>
          ))}
          {editing && (
            <Button className="w-full" variant="outline" onClick={() => setBlockCreateOpen(true)}>+ Agregar bloque</Button>
          )}
        </div>
      </div>
      {bankOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/40" onClick={() => setBankOpen(false)}>
          <div className="absolute bottom-0 left-0 right-0 max-h-[70vh] overflow-auto bg-card border-t border-border p-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-heading text-base font-bold">Ejercicios</h2>
              <Button size="sm" variant="ghost" onClick={() => setBankOpen(false)}>Cerrar</Button>
            </div>
            <Input placeholder="Buscar ejercicio..." value={search} onChange={(e) => setSearch(e.target.value)} />
            <Button variant="accent" size="sm" className="w-full mt-2" onClick={() => {
              if (model.blocks.length === 0) setBlockCreateOpen(true);
              else setExCreate({ blockIndex: model.blocks.length - 1 });
            }}>+ Crear ejercicio</Button>
            <div className="space-y-2 mt-2 max-h-[50vh] overflow-auto overflow-x-hidden">
              {existingExerciseOptions
                .filter((e) => e.name.toLowerCase().includes(search.toLowerCase()))
                .map((ex) => (
                  <div
                    key={ex.id || ex.name}
                    draggable
                    onDragStart={() => setDragPayload({ kind: 'bank', ex })}
                    onDragEnd={() => setDragPayload(null)}
                    className="border border-border bg-secondary px-3 py-2 cursor-grab text-sm flex items-center gap-2 select-none min-w-0"
                  >
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                    <span className="flex-1 min-w-0 line-clamp-2 break-words">{ex.name}</span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
      </>
      )}

      {!editing && (
        <div>
          <Link to={`/run/${model.id}`} className="block">
            <Button variant="accent" className="w-full">Iniciar rutina</Button>
          </Link>
        </div>
      )}
    </div>
  );
}
