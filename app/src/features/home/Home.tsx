import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCategories } from '@/hooks/usePlans';
import type { Category, Program } from '@/types';
import { createProgressRepository, createSessionRepository, createSettingsRepository } from '@/repositories';
import type { MarkRecord, ProgressRecord, SessionRecord } from '@/repositories';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  MESO,
  getMesoInicio,
  setMesoInicio,
  getWarmup,
  setWarmup,
  addDias,
  lunesDe,
  entreDias,
  iso,
} from '@/features/plans/meso';
import { getMarks } from '@/features/progress/marks';
import { targetsByTag } from '@/lib/tags';
import { useNow } from '@/hooks/useNow';

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

const settingsRepository = createSettingsRepository();
const sessionRepository = createSessionRepository();
const progressRepository = createProgressRepository();

export default function Home() {
  const navigate = useNavigate();
  const cats = useCategories();
  const [mesoInicio, setMesoInicioState] = useState('');
  const [warmup, setWarmupState] = useState(false);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [progress, setProgress] = useState<ProgressRecord[]>([]);
  const [startedPlanIds, setStartedPlanIds] = useState<string[]>([]);
  const [marks, setMarks] = useState<MarkRecord[]>([]);
  const [warmupRoutine, setWarmupRoutine] = useState<{ prog: any; model: any } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setMesoInicioState(await getMesoInicio());
        setWarmupState(await getWarmup());
        setSessions(await sessionRepository.list());
        setProgress(await progressRepository.list());
        const sp = await settingsRepository.get('startedPlans');
        setStartedPlanIds((sp?.value as string[]) || []);
      } catch {
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (mesoInicio) {
      getMarks(mesoInicio).then(setMarks).catch(() => {});
    }
  }, [mesoInicio]);

  const ahora = useNow();
  const hoyIso = iso(ahora);

  const dIni = mesoInicio ? new Date(mesoInicio + 'T00:00:00') : null;
  const semana = dIni ? Math.max(1, Math.floor(entreDias(dIni, ahora) / 7) + 1) : null;
  const iniDescarga = dIni ? addDias(dIni, MESO.carga * 7) : null;
  const faltaDescarga = iniDescarga ? entreDias(ahora, iniDescarga) : null;

  const fechasLog = new Set(sessions.map((s) => s.date));
  const lunes = lunesDe(ahora);
  const semana7 = Array.from({ length: 7 }, (_, i) => {
    const d = addDias(lunes, i);
    const isoD = iso(d);
    return { iso: isoD, dia: DIAS[i], num: d.getDate(), entreno: fechasLog.has(isoD), marcas: isoD === mesoInicio };
  });
  const entrenados = semana7.filter((d) => d.entreno).length;

  useEffect(() => {
    (async () => {
      const ids = await targetsByTag('calentamiento', 'routine');
      const candidates: { prog: any; model: any }[] = [];
      for (const c of cats) for (const p of c.programs) for (const m of p.models) {
        if (ids.includes(m.id)) candidates.push({ prog: p, model: m });
      }
      if (candidates.length === 0) { setWarmupRoutine(null); return; }
      setWarmupRoutine(candidates[Math.floor(Math.random() * candidates.length)]);
    })();
  }, [cats]);

  const startedPrograms = (() => {
    const startedIds = new Set(sessions.filter((s) => s.completed).map((s) => s.planId));
    const manualIds = new Set(startedPlanIds);
    const out: { prog: Program; cat: Category; sessions: number; completedModels: number; totalModels: number; best: { value: number; unit: string } | null }[] = [];
    for (const c of cats) {
      for (const p of c.programs) {
        if (!startedIds.has(p.id) && !manualIds.has(p.id)) continue;
        const progSessions = sessions.filter((s) => s.planId === p.id && s.completed);
        const completedModels = new Set(progSessions.map((s) => s.modelId)).size;
        const totalModels = p.models.length || 1;
        // best value from marks + progress for this program's exercises
        const exNames = new Set(p.models.flatMap((m) => m.blocks.flatMap((b) => b.exercises.map((e) => e.name))));
        let best: { value: number; unit: string } | null = null;
        for (const m of marks) {
          if (exNames.has(m.exercise) && (!best || m.value > best.value)) best = { value: m.value, unit: m.unit };
        }
        for (const pr of progress) {
          if (exNames.has(pr.exerciseId)) {
            if (!best || pr.value > best.value) best = { value: pr.value, unit: 'reps' };
          }
        }
        out.push({ prog: p, cat: c, sessions: progSessions.length, completedModels, totalModels, best });
      }
    }
    return out;
  })();

  const toggleWarmup = async () => {
    const v = !warmup;
    setWarmupState(v);
    await setWarmup(v);
  };

  const onMesoChange = async (v: string) => {
    setMesoInicioState(v);
    await setMesoInicio(v);
  };

  const ultimas = (() => {
    const m = new Map<string, { k: string; fecha: string; sesion_id: string; series: number }>();
    for (const s of sessions) {
      const k = s.date + '|' + s.modelId;
      const x = m.get(k) || { k, fecha: s.date, sesion_id: s.modelId, series: 0 };
      x.series += 1;
      m.set(k, x);
    }
    return [...m.values()].sort((a, b) => (a.fecha < b.fecha ? 1 : -1)).slice(0, 5);
  })();

  const info = (() => {
    const m = new Map<string, { prog: Program; modelId: string }>();
    for (const c of cats) for (const p of c.programs) for (const md of p.models) m.set(md.id, { prog: p, modelId: md.id });
    return m;
  })();

  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Cargando">
        <div className="h-8 w-32 animate-pulse bg-secondary" />
        <div className="grid gap-4 md:grid-cols-2">
          <div className="h-40 animate-pulse bg-secondary" />
          <div className="h-40 animate-pulse bg-secondary" />
        </div>
        <div className="h-24 animate-pulse bg-secondary" />
        <div className="h-48 animate-pulse bg-secondary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-bold tracking-tight">Hoy</h1>
        <p className="label-caps text-muted-foreground">
          {ahora.toLocaleDateString('es-AR', { weekday: 'long', day: '2-digit', month: 'long' })}
        </p>
      </header>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <div className="border-b border-border px-4 py-2">
            <span className="label-caps text-foreground">Mesociclo</span>
          </div>
          <div className="space-y-3 p-4">
            <p className="label-caps">{MESO.carga} semanas de carga + 1 de descarga</p>
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="meso-inicio" className="label-caps">
                  Inicio
                </label>
                <Input
                  id="meso-inicio"
                  type="date"
                  className="h-11 w-full sm:w-[170px]"
                  value={mesoInicio}
                  onChange={(e) => onMesoChange(e.currentTarget.value)}
                />
              </div>
              {semana != null && (
                <span className="pb-3 label-caps">
                  semana <span className="metric text-base text-foreground">{Math.min(semana, MESO.total)}</span> de{' '}
                  {MESO.total}
                </span>
              )}
            </div>
            {semana == null ? (
              <p className="label-caps">cargá la fecha de inicio para ubicarte</p>
            ) : (
              <div className="space-y-2">
                <div className="flex gap-1" role="img" aria-label={`Semana ${Math.min(semana, MESO.total)} de ${MESO.total}`}>
                  {Array.from({ length: MESO.total }, (_, i) => (
                    <div
                      key={i}
                      className={
                        'h-2 flex-1 ' +
                        (i + 1 < Math.min(semana, MESO.total)
                          ? 'bg-primary'
                          : i + 1 === Math.min(semana, MESO.total)
                            ? 'bg-accent ring-1 ring-ink'
                            : 'bg-secondary')
                      }
                    />
                  ))}
                </div>
                {semana > MESO.total ? (
                  <p className="label-caps text-muted-foreground">mesociclo terminado (semana {semana})</p>
                ) : semana === MESO.total ? (
                  <Badge className="label-status border border-ink bg-accent text-on-accent">
                    descarga · última semana
                  </Badge>
                ) : (
                  <p className="label-caps">
                    carga · descarga en <span className="metric text-foreground">{faltaDescarga}</span> días ({iniDescarga ? iso(iniDescarga) : ''})
                  </p>
                )}
              </div>
            )}
          </div>
        </Card>

        <Card>
          <div className="border-b border-border px-4 py-2 flex items-center justify-between">
            <span className="label-caps text-foreground">Esta semana</span>
            <span className="label-caps">
              <span className="metric text-foreground">{entrenados}</span> / 7 días
            </span>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-7 gap-1">
              {semana7.map((d) => (
                <div
                  key={d.iso}
                  className={
                    'border p-2 text-center ' +
                    (d.iso === hoyIso
                      ? 'border-ink bg-accent/10 dark:border-accent dark:bg-accent/20'
                      : 'border-border')
                  }
                >
                  <div className="label-caps">{d.dia}</div>
                  <div className={'metric text-base ' + (d.iso === hoyIso ? 'text-ink dark:text-accent' : '')}>{d.num}</div>
                  {d.marcas ? (
                    <span className="mx-auto mt-1 inline-block border border-ink bg-accent px-1 label-status text-on-accent" aria-hidden="true">
                      M
                    </span>
                  ) : d.entreno ? (
                    <span className="mx-auto mt-1 inline-block border border-ink bg-accent px-1 label-status text-on-accent" aria-hidden="true">
                      ✓
                    </span>
                  ) : (
                    <span className="mx-auto mt-1 inline-block h-2 w-2 bg-secondary dark:bg-border" aria-hidden="true" />
                  )}
                  <span className="sr-only">{d.marcas ? 'toma de marcas' : d.entreno ? 'entrenado' : 'sin entrenar'}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <div className="border-b border-border px-4 py-2 flex items-center justify-between gap-2">
          <span className="label-caps text-foreground">Entrenamiento</span>
          <label className="flex items-center gap-2 label-caps text-muted-foreground">
            <input type="checkbox" className="h-4 w-4 accent-foreground" aria-label="Incluir calentamiento" checked={warmup} onChange={toggleWarmup} />
            calentamiento
          </label>
        </div>
        <div className="p-4 space-y-3">
          {warmup && warmupRoutine && (
            <div className="flex items-center justify-between gap-3 border border-border bg-secondary p-3">
              <div className="min-w-0">
                <p className="font-medium truncate">{warmupRoutine.model.name}</p>
                <p className="label-caps text-muted-foreground">{warmupRoutine.prog.name} · {warmupRoutine.model.totalTimeMin} min · calentamiento</p>
              </div>
              <Button variant="accent" size="sm" onClick={() => navigate(`/routine/${warmupRoutine.model.id}`)}>Entrenar</Button>
            </div>
          )}
          {startedPrograms.length === 0 ? (
            <p className="label-caps text-muted-foreground">Todavía no registraste entrenamientos. Elegí un plan para empezar.</p>
          ) : (
            <ul className="space-y-2">
              {startedPrograms.map((p) => (
                <li key={p.prog.id}>
                  <div className="flex items-center justify-between gap-3 border border-border bg-card p-3">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{p.prog.name}</p>
                      <p className="label-caps text-muted-foreground">{p.completedModels}/{p.totalModels} modelos · {p.sessions} sesiones</p>
                    </div>
                    <Button variant="accent" size="sm" onClick={() => navigate(`/program/${p.prog.id}`)}>Entrenar</Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {!warmup && !warmupRoutine && startedPrograms.length === 0 && (
            <p className="label-caps text-muted-foreground">Etiquetá una rutina con "calentamiento" para verla acá.</p>
          )}
        </div>
      </Card>

      <Card>
        <div className="border-b border-border px-4 py-2 flex items-center justify-between">
          <span className="label-caps text-foreground">Últimos entrenamientos</span>
          <span className="label-caps">
            <span className="metric text-foreground">{ultimas.length}</span> de 5
          </span>
        </div>
        <div className="p-4">
          {ultimas.length === 0 ? (
            <p className="label-caps">todavía no registraste entrenamientos</p>
          ) : (
            <ul className="divide-y divide-border">
              {ultimas.map((h) => {
                const it = info.get(h.sesion_id);
                return (
                  <li key={h.k}>
                    <button
                      type="button"
                      disabled={!it}
                      onClick={() => it && navigate(`/routine/${it.modelId}`)}
                      className="flex min-h-14 w-full items-center justify-between gap-3 py-2 text-left hover:bg-secondary disabled:opacity-60"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-foreground">
                          {it ? `${it.prog.name}` : h.sesion_id}
                        </span>
                        <span className="label-caps">
                          <span className="metric text-foreground">{h.series}</span>{' '}
                          {h.series === 1 ? 'serie' : 'series'}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        <span className="label-status tabular text-muted-foreground">{h.fecha}</span>
                        {it && <span className="label-caps text-foreground">→</span>}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </Card>
    </div>
  );
}