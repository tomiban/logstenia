import { useParams, Link } from 'react-router-dom';
import { useId, useState } from 'react';
import type { Block, BlockType, Exercise, Intensity } from '@/types';
import { BLOCK_TYPE_LABEL, restLabel } from '@/lib/labels';
import { cn } from '@/lib/utils';
import { BackLink } from '@/components/BackLink';
import { getModel, updateModel, createBlock, updateBlock, deleteBlock, createExercise, updateExercise, deleteExercise, reorderExercises, moveExercise, allModels } from './plans';
import { usePlansVersion } from '@/hooks/usePlans';
import { uniqueId } from './ids';
import { exerciseKey, nextBlockId } from './blocks';
import { MoreHorizontal, GripVertical, Pencil, X } from 'lucide-react';
import Video from './Video';
import { Button, buttonVariants } from '@/components/ui/button';
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

function youtubeId(url: string): string | null {
  const m = url.match(/(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

const BLOCK_TYPES = ['single', 'biseries', 'superseries'] as const;

/** The select hands back a string; anything outside the three block types falls back to `single`. */
function toBlockType(raw: string | null | undefined): BlockType {
  return raw === 'biseries' ? 'biseries' : raw === 'superseries' ? 'superseries' : 'single';
}

/** The select hands back a string; anything outside the three levels falls back to the first. */
function toIntensity(raw: string | null | undefined): Intensity {
  return raw === '2' ? 2 : raw === '3' ? 3 : 1;
}

/** A block header: where the block sits in the routine, its shape, then its numbers as telemetry. */
function BlockHeader({ block, position }: { block: Block; position: number }) {
  const betweenExercises = block.restBetweenExercisesSec;
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="label-caps text-foreground">Bloque {position}</span>
        <span className="label-status border border-border px-1.5 py-0.5 text-muted-foreground">
          {BLOCK_TYPE_LABEL[block.type]}
        </span>
      </div>
      <dl className="flex flex-wrap items-start gap-x-4 gap-y-1">
        <div>
          <dt className="label-caps text-muted-foreground">Series</dt>
          <dd className="metric text-sm text-foreground">{block.sets}</dd>
        </div>
        <div>
          <dt className="label-caps text-muted-foreground">Descanso</dt>
          <dd className="metric text-sm text-foreground">{restLabel(block.restBetweenSetsSec)}</dd>
        </div>
        {betweenExercises ? (
          <div>
            <dt className="label-caps text-muted-foreground">Entre ejercicios</dt>
            <dd className="metric text-sm text-foreground">{restLabel(betweenExercises)}</dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}

interface ExerciseBankProps {
  exercises: Exercise[];
  search: string;
  onSearchChange: (value: string) => void;
  onCreate: () => void;
  onGrab: (exercise: Exercise) => void;
  onRelease: () => void;
  actionClassName?: string;
  listClassName?: string;
}

/**
 * The exercise bank: search, create, and the draggable pool of every exercise the plans already
 * know. Both the desktop sidebar and the mobile sheet render this, so only the spacing their
 * containers disagree on is configurable.
 */
function ExerciseBank({ exercises, search, onSearchChange, onCreate, onGrab, onRelease, actionClassName, listClassName }: ExerciseBankProps) {
  const query = search.toLowerCase();
  const matches = exercises.filter((e) => e.name.toLowerCase().includes(query));
  return (
    <>
      <Input placeholder="Buscar ejercicio..." value={search} onChange={(e) => onSearchChange(e.target.value)} />
      <Button variant="accent" size="sm" className={cn('w-full', actionClassName)} onClick={onCreate}>+ Crear ejercicio</Button>
      <div className={cn('space-y-2 overflow-auto overflow-x-hidden', listClassName)}>
        {matches.map((ex) => (
          <div
            key={ex.id || ex.name}
            draggable
            onDragStart={() => onGrab(ex)}
            onDragEnd={onRelease}
            className="border border-border bg-secondary px-3 py-2 cursor-grab text-sm flex items-center gap-2 select-none min-w-0"
          >
            <GripVertical className="h-4 w-4 text-muted-foreground" />
            <span className="flex-1 min-w-0 line-clamp-2 break-words">{ex.name}</span>
          </div>
        ))}
      </div>
    </>
  );
}

interface ExerciseActionsMenuProps {
  onEdit: () => void;
  onEditVideo: () => void;
  onDelete: () => void;
}

/** The actions every exercise row offers, shared by the read-only list and the editor list. */
function ExerciseActionsMenu({ onEdit, onEditVideo, onDelete }: ExerciseActionsMenuProps) {
  return (
    <DropdownMenuContent align="end">
      <DropdownMenuItem onClick={onEdit}>Editar</DropdownMenuItem>
      <DropdownMenuItem onClick={onEditVideo}>Editar video</DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem className="text-destructive" onClick={onDelete}>Borrar</DropdownMenuItem>
    </DropdownMenuContent>
  );
}

/** Fields the model dialog round-trips; the number input hands back a string. */
interface ModelForm {
  name: string;
  intensity: Intensity;
  totalTimeMin: string;
}

/** Fields the block dialogs round-trip; the number inputs hand back strings. */
interface BlockForm {
  type: BlockType;
  sets: string;
  restBetweenSetsSec: string;
  restBetweenExercisesSec: string;
}

/** Fields the exercise dialogs round-trip; `timeSec` is a string because the input is one. */
interface ExerciseForm {
  name: string;
  reps: string;
  timeSec: string;
  cadence: string;
  notes: string;
}

const EMPTY_BLOCK_FORM: BlockForm = { type: 'single', sets: '1', restBetweenSetsSec: '60', restBetweenExercisesSec: '' };
const EMPTY_EXERCISE_FORM: ExerciseForm = { name: '', reps: '', timeSec: '', cadence: '', notes: '' };

export default function Routine() {
  const { id } = useParams();
  const tagsLabelId = useId();
  usePlansVersion();
  const res = getModel(id || '');


  // model edit
  const [modelEditOpen, setModelEditOpen] = useState(false);
  const [modelForm, setModelForm] = useState<ModelForm | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // block create/edit
  const [blockCreateOpen, setBlockCreateOpen] = useState(false);
  const [newBlock, setNewBlock] = useState<BlockForm>(EMPTY_BLOCK_FORM);
  const [blockEdit, setBlockEdit] = useState<{ index: number; form: BlockForm } | null>(null);
  const [blockDelete, setBlockDelete] = useState<number | null>(null);

  // exercise create/edit
  const [exCreate, setExCreate] = useState<{ blockIndex: number } | null>(null);
  const [newEx, setNewEx] = useState<ExerciseForm>(EMPTY_EXERCISE_FORM);
  const [exEdit, setExEdit] = useState<{ bi: number; ei: number; form: ExerciseForm } | null>(null);
  const [exDelete, setExDelete] = useState<{ bi: number; ei: number } | null>(null);
  const [drag, setDrag] = useState<{ bi: number; ei: number } | null>(null);
  const [dragPayload, setDragPayload] = useState<{ kind: 'bank' | 'routine'; ex?: Exercise; bi?: number; ei?: number } | null>(null);
  const [dropTarget, setDropTarget] = useState<{ bi: number } | null>(null);
  const [search, setSearch] = useState('');
  const [bankOpen, setBankOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [urlEdit, setUrlEdit] = useState<{ bi: number; ei: number; url: string } | null>(null);

  if (!res) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">No encontramos esta rutina.</p>
        <Link to="/planes" className={buttonVariants({ variant: 'outline', size: 'lg' })}>
          Volver a planes
        </Link>
      </div>
    );
  }
  const { model, program } = res;
  const showStartBar = !editing && model.blocks.length > 0;

  const existingExerciseOptions = Array.from(
    new Map(
      allModels()
        .flatMap(({ model: m }) => m.blocks.flatMap((b) => b.exercises))
        .map((e) => [e.id || e.name, e] as const),
    ).values(),
  );

  const openExerciseCreate = () => {
    if (model.blocks.length === 0) setBlockCreateOpen(true);
    else setExCreate({ blockIndex: model.blocks.length - 1 });
  };
  const grabFromBank = (exercise: Exercise) => setDragPayload({ kind: 'bank', ex: exercise });
  const releaseBankDrag = () => setDragPayload(null);

  const openModelEdit = () => {
    setModelForm({ name: model.name, intensity: model.intensity, totalTimeMin: String(model.totalTimeMin) });
    setModelEditOpen(true);
  };
  const saveModelEdit = async () => {
    if (!modelForm) return;
    try {
      await updateModel(model.id, {
        name: modelForm.name.trim(),
        intensity: modelForm.intensity,
        totalTimeMin: Number(modelForm.totalTimeMin),
      });
      setSaveError(null);
      setModelEditOpen(false);
      setModelForm(null);
    } catch {
      setSaveError('No se pudieron guardar los datos de la rutina.');
    }
  };

  const saveNewBlock = async () => {
    const block: Block = {
      id: nextBlockId(newBlock.type, model.blocks),
      type: newBlock.type,
      sets: Number(newBlock.sets) || 1,
      restBetweenSetsSec: Number(newBlock.restBetweenSetsSec) || 0,
      exercises: [],
    };
    if (newBlock.restBetweenExercisesSec !== '') {
      block.restBetweenExercisesSec = Number(newBlock.restBetweenExercisesSec);
    }
    try {
      await createBlock(model.id, block);
      setSaveError(null);
      setNewBlock(EMPTY_BLOCK_FORM);
      setBlockCreateOpen(false);
    } catch {
      setSaveError('No se pudo agregar el bloque.');
    }
  };

  const openBlockEdit = (i: number) => {
    const b = model.blocks[i];
    setBlockEdit({
      index: i,
      form: {
        type: b.type,
        sets: String(b.sets),
        restBetweenSetsSec: String(b.restBetweenSetsSec),
        restBetweenExercisesSec: b.restBetweenExercisesSec == null ? '' : String(b.restBetweenExercisesSec),
      },
    });
  };
  const saveBlockEdit = async () => {
    if (!blockEdit) return;
    const f = blockEdit.form;
    const patch: Partial<Block> = {
      type: f.type,
      sets: Number(f.sets) || 1,
      restBetweenSetsSec: Number(f.restBetweenSetsSec) || 0,
      restBetweenExercisesSec: f.restBetweenExercisesSec === '' ? undefined : Number(f.restBetweenExercisesSec),
    };
    try {
      await updateBlock(model.id, blockEdit.index, patch);
      setSaveError(null);
      setBlockEdit(null);
    } catch {
      setSaveError('No se pudo guardar el bloque.');
    }
  };
  const confirmDeleteBlock = async () => {
    if (blockDelete === null) return;
    try {
      await deleteBlock(model.id, blockDelete);
      setSaveError(null);
      setBlockDelete(null);
    } catch {
      setSaveError('No se pudo borrar el bloque.');
    }
  };

  const saveNewEx = async () => {
    if (!exCreate || !newEx.name.trim()) return;
    const bi = exCreate.blockIndex;
    const block = model.blocks[bi];
    const existing = new Set(block.exercises.map((e) => e.id).filter((eid): eid is string => Boolean(eid)));
    const id = uniqueId(newEx.name, existing);
    const ex: Exercise = { id, name: newEx.name.trim() };
    if (newEx.reps.trim()) ex.reps = newEx.reps.trim();
    if (newEx.timeSec !== '') ex.timeSec = Number(newEx.timeSec);
    if (newEx.cadence.trim()) ex.cadence = newEx.cadence.trim();
    if (newEx.notes.trim()) ex.notes = newEx.notes.trim();
    try {
      await createExercise(model.id, bi, ex);
      setSaveError(null);
      setNewEx(EMPTY_EXERCISE_FORM);
      setExCreate(null);
    } catch {
      setSaveError('No se pudo crear el ejercicio.');
    }
  };

  const openExEdit = (bi: number, ei: number) => {
    const e = model.blocks[bi].exercises[ei];
    setExEdit({
      bi, ei,
      form: {
        name: e.name,
        reps: e.reps ?? '',
        timeSec: e.timeSec == null ? '' : String(e.timeSec),
        cadence: e.cadence ?? '',
        notes: e.notes ?? '',
      },
    });
  };
  const saveExEdit = async () => {
    if (!exEdit) return;
    const f = exEdit.form;
    const patch: Partial<Exercise> = {
      name: f.name.trim(),
      reps: f.reps.trim() || undefined,
      timeSec: f.timeSec === '' ? undefined : Number(f.timeSec),
      cadence: f.cadence.trim() || undefined,
      notes: f.notes.trim() || undefined,
    };
    try {
      await updateExercise(model.id, exEdit.bi, exEdit.ei, patch);
      setSaveError(null);
      setExEdit(null);
    } catch {
      setSaveError('No se pudo guardar el ejercicio.');
    }
  };
  const confirmDeleteEx = async () => {
    if (!exDelete) return;
    try {
      await deleteExercise(model.id, exDelete.bi, exDelete.ei);
      setSaveError(null);
      setExDelete(null);
    } catch {
      setSaveError('No se pudo borrar el ejercicio.');
    }
  };

  const saveUrlEdit = async () => {
    if (!urlEdit) return;
    const { bi, ei, url } = urlEdit;
    const id = youtubeId(url.trim());
    const ex = model.blocks[bi].exercises[ei];
    try {
      if (id) {
        await updateExercise(model.id, bi, ei, {
          video: { id, title: ex.name, channel: '', url: `https://www.youtube.com/watch?v=${id}`, thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg` },
        });
      } else if (url.trim() === '') {
        await updateExercise(model.id, bi, ei, { video: undefined });
      }
      setSaveError(null);
      setUrlEdit(null);
    } catch {
      setSaveError('No se pudo guardar el video.');
    }
  };

  return (
    <div className={showStartBar ? 'space-y-6 pb-28 md:pb-20' : 'space-y-6'}>
      <div>
        <BackLink to={`/program/${program.id}`}>{program.name}</BackLink>
      </div>

      <header className="space-y-4 border-b border-border pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-1">
            <ContextMenu>
              <ContextMenuTrigger className="min-w-0">
                <h1 className="break-words font-heading text-2xl leading-tight font-bold tracking-tight text-foreground">{model.name}</h1>
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
            <p className="text-sm text-muted-foreground">
              Intensidad {model.intensity} · {model.totalTimeMin} min
              {program.rules.length > 0 && ` · ${program.rules.join(' · ')}`}
            </p>
          </div>
          <Button
            size="lg"
            variant={editing ? 'ink' : 'outline'}
            aria-pressed={editing}
            className="shrink-0 gap-1.5"
            onClick={() => setEditing((v) => !v)}
          >
            {editing ? <X aria-hidden="true" /> : <Pencil aria-hidden="true" />}
            {editing ? 'Cerrar edición' : 'Editar rutina'}
          </Button>
        </div>
        <div className="space-y-1.5">
          <p id={tagsLabelId} className="label-caps text-muted-foreground">Etiquetas</p>
          <div role="group" aria-labelledby={tagsLabelId} className="min-w-0">
            <TagsInput targetType="routine" targetId={model.id} className="w-full sm:max-w-md" />
          </div>
        </div>
      </header>

      {saveError && (
        <p role="alert" className="border border-ink bg-secondary px-3 py-2 text-sm text-foreground">
          {saveError}
        </p>
      )}

      <Dialog open={modelEditOpen} onOpenChange={setModelEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar rutina</DialogTitle></DialogHeader>
          {modelForm && (
            <div className="space-y-3">
              <div className="space-y-1.5"><Label>Nombre</Label><Input value={modelForm.name} onChange={(e) => setModelForm({ ...modelForm, name: e.target.value })} /></div>
              <div className="space-y-1.5">
                <Label>Intensidad</Label>
                <Select value={String(modelForm.intensity)} onValueChange={(v) => setModelForm({ ...modelForm, intensity: toIntensity(v) })}>
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
              <Select value={newBlock.type} onValueChange={(v) => setNewBlock({ ...newBlock, type: toBlockType(v) })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {BLOCK_TYPES.map((t) => <SelectItem key={t} value={t}>{BLOCK_TYPE_LABEL[t]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Series</Label><Input type="number" value={newBlock.sets} onChange={(e) => setNewBlock({ ...newBlock, sets: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Descanso entre series (s)</Label><Input type="number" value={newBlock.restBetweenSetsSec} onChange={(e) => setNewBlock({ ...newBlock, restBetweenSetsSec: e.target.value })} /></div>
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
                <Select value={blockEdit.form.type} onValueChange={(v) => setBlockEdit({ ...blockEdit!, form: { ...blockEdit!.form, type: toBlockType(v) } })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {BLOCK_TYPES.map((t) => <SelectItem key={t} value={t}>{BLOCK_TYPE_LABEL[t]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Series</Label><Input type="number" value={blockEdit.form.sets} onChange={(e) => setBlockEdit({ ...blockEdit!, form: { ...blockEdit!.form, sets: e.target.value } })} /></div>
              <div className="space-y-1.5"><Label>Descanso entre series (s)</Label><Input type="number" value={blockEdit.form.restBetweenSetsSec} onChange={(e) => setBlockEdit({ ...blockEdit!, form: { ...blockEdit!.form, restBetweenSetsSec: e.target.value } })} /></div>
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
          <section key={b.id} className="border border-border">
            <ContextMenu>
              <ContextMenuTrigger className="block">
                <div className="border-b border-border bg-secondary">
                  <BlockHeader block={b} position={i + 1} />
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
                  if (drag.ei !== last) reorderExercises(model.id, i, drag.ei, last).then(() => setDrag(null)).catch(() => setSaveError('No se pudo mover el ejercicio.'));
                  else setDrag(null);
                } else {
                  moveExercise(model.id, drag.bi, drag.ei, i, b.exercises.length).then(() => setDrag(null)).catch(() => setSaveError('No se pudo mover el ejercicio.'));
                }
              }}
            >
              {b.exercises.map((e, j) => (
                <li
                  key={exerciseKey(b.exercises, j)}
                  draggable={editing}
                  onDragStart={() => { if (editing) setDrag({ bi: i, ei: j }); }}
                  onDragOver={(ev) => ev.preventDefault()}
                  onDragEnd={() => setDrag(null)}
                  onDrop={(ev) => {
                    ev.stopPropagation();
                    if (!drag) { setDrag(null); return; }
                    if (drag.bi === i && drag.ei === j) { setDrag(null); return; }
                    if (drag.bi === i) {
                      reorderExercises(model.id, i, drag.ei, j).then(() => setDrag(null)).catch(() => setSaveError('No se pudo mover el ejercicio.'));
                    } else {
                      moveExercise(model.id, drag.bi, drag.ei, i, j).then(() => setDrag(null)).catch(() => setSaveError('No se pudo mover el ejercicio.'));
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
                            <ExerciseActionsMenu
                              onEdit={() => openExEdit(i, j)}
                              onEditVideo={() => setUrlEdit({ bi: i, ei: j, url: e.video?.url ?? '' })}
                              onDelete={() => setExDelete({ bi: i, ei: j })}
                            />
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
            <ExerciseBank
              exercises={existingExerciseOptions}
              search={search}
              onSearchChange={setSearch}
              onCreate={openExerciseCreate}
              onGrab={grabFromBank}
              onRelease={releaseBankDrag}
              listClassName="max-h-[60vh]"
            />
          </aside>

          <div className="space-y-3">
          {model.blocks.length === 0 && (
            <p className="text-sm text-muted-foreground">Sin bloques. Agregá el primero con el botón de abajo.</p>
          )}
          {model.blocks.map((b, i) => (
            <section
              key={b.id}
              onDragOver={(ev) => { ev.preventDefault(); setDropTarget({ bi: i }); }}
              onDragLeave={() => setDropTarget(null)}
              onDrop={(ev) => {
                ev.preventDefault();
                if (!dragPayload) return;
                if (dragPayload.kind === 'bank' && dragPayload.ex) {
                  const existing = new Set(b.exercises.map((e) => e.id).filter((eid): eid is string => Boolean(eid)));
                  const id = uniqueId(dragPayload.ex.name, existing);
                  createExercise(model.id, i, { ...dragPayload.ex, id }).then(() => setDragPayload(null)).catch(() => setSaveError('No se pudo agregar el ejercicio.'));
                } else if (dragPayload.kind === 'routine' && dragPayload.bi !== undefined && dragPayload.ei !== undefined && dragPayload.bi !== i) {
                  moveExercise(model.id, dragPayload.bi, dragPayload.ei, i, b.exercises.length).then(() => setDragPayload(null)).catch(() => setSaveError('No se pudo mover el ejercicio.'));
                }
                setDropTarget(null);
              }}
              className={`border border-border bg-card transition-colors ${dropTarget?.bi === i ? 'ring-1 ring-accent' : ''}`}
            >
              <div className="border-b border-border bg-secondary">
                <BlockHeader block={b} position={i + 1} />
              </div>
              <div className="divide-y divide-border">
                {b.exercises.length === 0 && (
                  <p className="px-3 py-4 text-sm text-muted-foreground">Arrastrá un ejercicio aquí</p>
                )}
                {b.exercises.map((e, j) => (
                  <div
                    key={exerciseKey(b.exercises, j)}
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
                      <ExerciseActionsMenu
                        onEdit={() => openExEdit(i, j)}
                        onEditVideo={() => setUrlEdit({ bi: i, ei: j, url: e.video?.url ?? '' })}
                        onDelete={() => setExDelete({ bi: i, ei: j })}
                      />
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
            <ExerciseBank
              exercises={existingExerciseOptions}
              search={search}
              onSearchChange={setSearch}
              onCreate={openExerciseCreate}
              onGrab={grabFromBank}
              onRelease={releaseBankDrag}
              actionClassName="mt-2"
              listClassName="mt-2 max-h-[50vh]"
            />
          </div>
        </div>
      )}
      </>
      )}

      {!editing && model.blocks.length === 0 && (
        <p className="border border-border bg-card px-3 py-4 text-sm text-muted-foreground">
          Esta rutina todavía no tiene bloques. Editala para agregar el primero.
        </p>
      )}

      {showStartBar && (
        <div className="fixed inset-x-0 bottom-[57px] z-40 border-t border-border bg-background md:bottom-0">
          <div className="mx-auto w-full max-w-6xl px-6 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:pb-2">
            <Link to={`/run/${model.id}`} className={cn(buttonVariants({ variant: 'accent', size: 'lg' }), 'w-full')}>
              Iniciar rutina
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
