import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCategories } from '@/hooks/usePlans';
import type { Category, Model, Program } from '@/types';
import { createSessionRepository, createSettingsRepository } from '@/repositories';
import type { MarkRecord, SessionRecord } from '@/repositories';
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
import { formatDayMonth } from '@/lib/date';
import { pluralForm } from '@/lib/format';
import { bloquesDe, destinoDeHoy, dosisDeBloque } from './hoy';

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

const settingsRepository = createSettingsRepository();
const sessionRepository = createSessionRepository();

export default function Home() {
  const navigate = useNavigate();
  const cats = useCategories();
  const [mesoInicio, setMesoInicioState] = useState('');
  const [warmup, setWarmupState] = useState(false);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [startedPlanIds, setStartedPlanIds] = useState<string[]>([]);
  const [marks, setMarks] = useState<MarkRecord[]>([]);
  const [warmupRoutine, setWarmupRoutine] = useState<{ prog: Program; model: Model } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        setMesoInicioState(await getMesoInicio());
        setWarmupState(await getWarmup());
        setSessions(await sessionRepository.list());
        const sp = await settingsRepository.get('startedPlans');
        setStartedPlanIds((sp?.value as string[]) || []);
        setSaveError(null);
      } catch {
        setSaveError('No se pudieron cargar tus datos.');
      } finally {
        setLoading(false);
      }
    })();
  }, [reloadKey]);

  useEffect(() => {
    if (mesoInicio) {
      getMarks(mesoInicio).then(setMarks).catch(() => setSaveError('No se pudieron leer las marcas del mesociclo.'));
    }
  }, [mesoInicio, reloadKey]);

  const ahora = useNow();
  const hoyIso = iso(ahora);

  const dIni = mesoInicio ? new Date(mesoInicio + 'T00:00:00') : null;
  const semana = dIni ? Math.max(1, Math.floor(entreDias(dIni, ahora) / 7) + 1) : null;
  const iniDescarga = dIni ? addDias(dIni, MESO.carga * 7) : null;
  const faltaDescarga = iniDescarga ? entreDias(ahora, iniDescarga) : 0;
  const semanaActual = semana != null && semana <= MESO.total ? semana : null;

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
      try {
        const ids = await targetsByTag('calentamiento', 'routine');
        const candidates: { prog: Program; model: Model }[] = [];
        for (const c of cats) for (const p of c.programs) for (const m of p.models) {
          if (ids.includes(m.id)) candidates.push({ prog: p, model: m });
        }
        if (candidates.length === 0) { setWarmupRoutine(null); return; }
        setWarmupRoutine(candidates[Math.floor(Math.random() * candidates.length)]);
      } catch {
        setSaveError('No se pudo elegir el calentamiento.');
      }
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
        /* Best mark of this program's exercises. Marks carry the exercise display name and progress
           rows carry exercise ids, so only marks can be matched until the catalogue names are
           normalized (see odd/tasks/logstenia.md). */
        const exNames = new Set(p.models.flatMap((m) => m.blocks.flatMap((b) => b.exercises.map((e) => e.name))));
        let best: { value: number; unit: string } | null = null;
        for (const m of marks) {
          if (exNames.has(m.exercise) && (!best || m.value > best.value)) best = { value: m.value, unit: m.unit };
        }
        out.push({ prog: p, cat: c, sessions: progSessions.length, completedModels, totalModels, best });
      }
    }
    return out;
  })();

  const retryLoad = () => {
    setLoading(true);
    setReloadKey((k) => k + 1);
  };

  const toggleWarmup = async () => {
    const v = !warmup;
    setWarmupState(v);
    try {
      await setWarmup(v);
      setSaveError(null);
    } catch {
      setSaveError('No se pudo guardar el calentamiento.');
    }
  };

  const onMesoChange = async (v: string) => {
    setMesoInicioState(v);
    try {
      await setMesoInicio(v);
      setSaveError(null);
    } catch {
      setSaveError('No se pudo guardar el inicio del mesociclo.');
    }
  };

  const ultimas = (() => {
    const m = new Map<string, { k: string; fecha: string; sesion_id: string; sesiones: number }>();
    for (const s of sessions) {
      const k = s.date + '|' + s.modelId;
      const x = m.get(k) || { k, fecha: s.date, sesion_id: s.modelId, sesiones: 0 };
      x.sesiones += 1;
      m.set(k, x);
    }
    return [...m.values()].sort((a, b) => (a.fecha < b.fecha ? 1 : -1)).slice(0, 5);
  })();

  const info = (() => {
    const m = new Map<string, { prog: Program; model: Model }>();
    for (const c of cats) for (const p of c.programs) for (const md of p.models) m.set(md.id, { prog: p, model: md });
    return m;
  })();

  const destino = destinoDeHoy(cats, sessions, hoyIso);
  const bloques = destino ? bloquesDe(destino.model) : [];
  const sesionesHoy = sessions.filter((s) => s.date === hoyIso && s.completed).length;
  const fechaLarga = ahora.toLocaleDateString('es-AR', { weekday: 'long', day: '2-digit', month: 'long' });

  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Cargando">
        <div className="h-32 animate-pulse bg-secondary" />
        <div className="h-16 animate-pulse bg-secondary" />
        <div className="h-64 animate-pulse bg-secondary" />
      </div>
    );
  }

  return (
    <div className="-mx-6 -mt-6">
      <header className="banda">
        <div className="min-w-0">
          <p className="banda-kicker">Hoy · {fechaLarga}</p>
          <h1 className="banda-titulo">{destino ? destino.model.name : 'Sin programa'}</h1>
          <p className="banda-sub flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            {destino ? (
              <>
                <span className="whitespace-nowrap">{destino.prog.name}</span>
                <span aria-hidden="true">·</span>
                <span className="whitespace-nowrap">
                  {bloques.length} {pluralForm(bloques.length, 'bloque', 'bloques')}
                </span>
                <span aria-hidden="true">·</span>
                <span className="whitespace-nowrap">{destino.model.totalTimeMin} min</span>
              </>
            ) : (
              <span>elegí un programa y el día aparece acá</span>
            )}
          </p>
        </div>
        <span aria-hidden="true" className="banda-flecha">
          →
        </span>
      </header>

      {saveError && (
        <div role="alert" className="flex items-center justify-between gap-3 border-b border-ink bg-secondary px-6 py-2">
          <p className="text-sm text-foreground">{saveError}</p>
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="outline" size="lg" onClick={retryLoad}>
              Reintentar
            </Button>
            <Button variant="ghost" size="icon-lg" aria-label="Descartar aviso" onClick={() => setSaveError(null)}>
              ×
            </Button>
          </div>
        </div>
      )}

      {destino ? (
        <>
          <button type="button" className="accion" onClick={() => navigate(`/run/${destino.model.id}`)}>
            <span className="accion-titulo">{destino.hoyCompletada ? 'Repetir' : 'Iniciar'}</span>
            <span className="accion-meta">
              {bloques.length} {pluralForm(bloques.length, 'bloque', 'bloques')} · {destino.model.totalTimeMin} min{' '}
              <span aria-hidden="true">→</span>
            </span>
          </button>

          <div className="franja">
            <span className="label-caps text-foreground">Bloque 1 de {bloques.length}</span>
            <span className="label-caps text-muted-foreground">
              {sesionesHoy > 0
                ? `${sesionesHoy} ${pluralForm(sesionesHoy, 'sesión', 'sesiones')} hoy`
                : 'nada registrado hoy'}
            </span>
          </div>

          <div>
            {bloques.map((b, i) => (
              <button
                key={b.block.id ?? `bloque-${i}`}
                type="button"
                className="fila"
                onClick={() => navigate(`/routine/${destino.model.id}`)}
              >
                <span className="puerta">{String(i + 1).padStart(2, '0')}</span>
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 block text-[15px] font-semibold leading-tight">{b.nombre}</span>
                  <span className="mt-1 block font-mono text-[11px] tracking-[0.04em] text-muted-foreground">
                    {dosisDeBloque(b.block)}
                    {b.formato === 'simple' ? '' : ` · ${b.formato}`}
                  </span>
                </span>
                <span aria-hidden="true" className="flecha">
                  →
                </span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="border-b border-border px-6 py-6">
          <p className="text-sm text-muted-foreground">
            Todavía no registraste entrenamientos. Elegí un programa para empezar.
          </p>
          <Button variant="accent" size="lg" className="mt-3" onClick={() => navigate('/planes')}>
            Ver programas
          </Button>
        </div>
      )}

      <section aria-label="Mesociclo y semana">
        <div className="franja border-border">
          <span className="label-caps text-foreground">Mesociclo</span>
          <span className="label-caps text-muted-foreground">
            {semanaActual != null
              ? `semana ${semanaActual} de ${MESO.total}`
              : semana != null
                ? 'terminado'
                : 'sin inicio'}
          </span>
        </div>
        <div className="flex flex-wrap items-end gap-3 border-b border-border px-6 py-3">
          <div className="flex flex-col gap-1">
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
          {semana == null ? (
            <p className="text-sm text-muted-foreground">cargá la fecha de inicio para ubicarte</p>
          ) : (
            <div className="space-y-1.5">
              <div
                className="flex w-40 gap-1"
                role="img"
                aria-label={
                  semanaActual != null
                    ? `Semana ${semanaActual} de ${MESO.total}`
                    : `Mesociclo terminado, ${MESO.total} semanas completadas`
                }
              >
                {Array.from({ length: MESO.total }, (_, i) => {
                  const n = i + 1;
                  const estado =
                    semanaActual == null || n < semanaActual
                      ? 'bg-ink'
                      : n === semanaActual
                        ? 'bg-accent ring-1 ring-ink'
                        : 'bg-secondary dark:bg-border';
                  return <div key={`semana-${n}`} className={`h-2 flex-1 ${estado}`} />;
                })}
              </div>
              <p className="text-sm text-muted-foreground">
                {semanaActual == null ? (
                  <>
                    mesociclo terminado · semana <span className="metric text-foreground">{semana}</span>
                  </>
                ) : semanaActual === MESO.total ? (
                  <span className="label-status border border-ink bg-accent px-1 text-on-accent">descarga · última semana</span>
                ) : (
                  <>
                    carga · descarga en <span className="metric text-foreground">{faltaDescarga}</span>{' '}
                    {pluralForm(faltaDescarga, 'día', 'días')}
                    {iniDescarga ? ` (${formatDayMonth(iso(iniDescarga))})` : ''}
                  </>
                )}
              </p>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between px-6 pb-2 pt-3">
          <span className="label-caps text-foreground">Esta semana</span>
          <span className="text-sm text-muted-foreground">
            <span className="metric text-foreground">{entrenados}</span> de 7 días
          </span>
        </div>
        <div className="grid grid-cols-7 gap-1 px-6 pb-4">
          {semana7.map((d) => (
            <div key={d.iso} className={'border p-2 text-center ' + (d.iso === hoyIso ? 'border-ink' : 'border-border')}>
              <div className="label-caps">{d.dia}</div>
              <div className="metric text-base">{d.num}</div>
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
              <span className="sr-only">
                {d.iso === hoyIso ? 'hoy, ' : ''}
                {d.marcas ? 'toma de marcas' : d.entreno ? 'entrenado' : 'sin entrenar'}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section aria-label="Programas">
        <div className="franja border-border">
          <span className="label-caps text-foreground">Programas</span>
          <label className="flex min-h-11 items-center gap-2 label-caps text-muted-foreground">
            <input
              type="checkbox"
              className="h-4 w-4 accent-foreground"
              aria-label="Incluir calentamiento"
              checked={warmup}
              onChange={toggleWarmup}
            />
            calentamiento
          </label>
        </div>

        {warmup && warmupRoutine && (
          <div className="flex items-center justify-between gap-3 border-b border-border px-6 py-3">
            <div className="min-w-0">
              <p className="truncate text-[15px] font-semibold">{warmupRoutine.model.name}</p>
              <p className="label-caps text-muted-foreground">
                {warmupRoutine.prog.name} · {warmupRoutine.model.totalTimeMin} min · calentamiento
              </p>
            </div>
            <Button variant="outline" size="lg" onClick={() => navigate(`/routine/${warmupRoutine.model.id}`)}>
              Iniciar rutina
            </Button>
          </div>
        )}

        {startedPrograms.length > 0 ? (
          startedPrograms.map((p) => (
            <button
              key={p.prog.id}
              type="button"
              className="fila"
              onClick={() => navigate(`/program/${p.prog.id}`)}
            >
              <span className="min-w-0 flex-1">
                <span className="block font-heading text-sm font-bold leading-tight tracking-tight text-foreground">
                  {p.prog.name}
                </span>
                <span className="label-caps mt-1 block text-muted-foreground">
                  <span className="metric text-foreground">{p.completedModels}</span>/{p.totalModels}{' '}
                  {pluralForm(p.totalModels, 'rutina', 'rutinas')} ·{' '}
                  <span className="metric text-foreground">{p.sessions}</span>{' '}
                  {pluralForm(p.sessions, 'sesión', 'sesiones')}
                  {p.best ? (
                    <>
                      {' · '}mejor <span className="metric text-foreground">{p.best.value}</span>{' '}
                      {p.best.unit}
                    </>
                  ) : null}
                </span>
              </span>
              <span aria-hidden="true" className="flecha">
                →
              </span>
            </button>
          ))
        ) : (
          <div className="space-y-3 px-6 py-4">
            <p className="text-sm text-muted-foreground">Elegí un programa de los planes para arrancar.</p>
            <Button variant="accent" size="lg" onClick={() => navigate('/planes')}>
              Ver programas
            </Button>
          </div>
        )}
        {warmup && !warmupRoutine && startedPrograms.length > 0 && (
          <p className="px-6 py-3 text-sm text-muted-foreground">
            Etiquetá una rutina con "calentamiento" para verla acá.
          </p>
        )}
      </section>

      <section aria-label="Últimos entrenamientos">
        <div className="franja border-border">
          <span className="label-caps text-foreground">Últimos entrenamientos</span>
          <span className="text-sm text-muted-foreground">
            <span className="metric text-foreground">{ultimas.length}</span> de 5
          </span>
        </div>
        {ultimas.length === 0 ? (
          <p className="px-6 py-4 text-sm text-muted-foreground">Todavía no registraste entrenamientos.</p>
        ) : (
          ultimas.map((h) => {
            const it = info.get(h.sesion_id);
            return (
              <button
                key={h.k}
                type="button"
                disabled={!it}
                onClick={() => it && navigate(`/routine/${it.model.id}`)}
                className="fila disabled:opacity-60"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold text-foreground">
                    {it ? it.model.name : h.sesion_id}
                  </span>
                  <span className="label-caps mt-1 block text-muted-foreground">
                    {it && `${it.prog.name} · `}
                    <span className="metric text-foreground">{h.sesiones}</span>{' '}
                    {pluralForm(h.sesiones, 'sesión', 'sesiones')}
                  </span>
                </span>
                <span className="label-status tabular shrink-0 text-muted-foreground">{formatDayMonth(h.fecha)}</span>
                <span aria-hidden="true" className="flecha">
                  →
                </span>
              </button>
            );
          })
        )}
      </section>
    </div>
  );
}
