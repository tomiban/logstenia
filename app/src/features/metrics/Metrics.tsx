import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { createMarkRepository, createSessionRepository } from '@/repositories';
import type { MarkRecord, SessionRecord } from '@/repositories';
import { MESO, addDias, getMesoInicio, iso } from '@/features/plans/meso';
import { ANCLAS } from '@/features/progress/marks';
import { formatDayMonth } from '@/lib/date';
import { anchorProgress, collectMarks, inWindow } from './metrics';

const nf = new Intl.NumberFormat('es-AR');
const UNIT_LABEL: Record<'sec' | 'reps', string> = { sec: 'seg', reps: 'reps' };
const sessionRepository = createSessionRepository();
const markRepository = createMarkRepository();

function Panel({ title, meta, children }: { title: string; meta?: string; children: ReactNode }) {
  return (
    <section className="border border-border bg-card">
      <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-border px-4 py-2">
        <h2 className="label-caps text-foreground">{title}</h2>
        {meta ? <span className="label-caps text-right text-muted-foreground">{meta}</span> : null}
      </header>
      {children}
    </section>
  );
}

function Readout({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="bg-card p-4">
      <div className="label-caps text-muted-foreground">{label}</div>
      <div className="mt-1.5 flex items-baseline gap-1.5">
        <span className="metric text-3xl tabular-nums text-foreground">{value}</span>
        {unit ? <span className="label-caps text-muted-foreground">{unit}</span> : null}
      </div>
    </div>
  );
}

/**
 * Only what a single athlete reads between sessions: how many sessions the mesocycle has, how long
 * they train, and the record of the four lifts that tell whether the block is working.
 */
export default function Metrics() {
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [marks, setMarks] = useState<MarkRecord[]>([]);
  const [mesoInicio, setMesoInicio] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [s, m, inicio] = await Promise.all([
          sessionRepository.list(),
          markRepository.list(),
          getMesoInicio(),
        ]);
        if (cancelled) return;
        setSessions(s);
        setMarks(m);
        setMesoInicio(inicio);
      } catch {
        if (!cancelled) setError('No se pudieron leer los datos de este dispositivo.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Cargando">
        <div className="h-8 w-40 animate-pulse bg-secondary" />
        <div className="grid grid-cols-3 gap-px bg-border">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse bg-secondary" />
          ))}
        </div>
        <div className="h-48 animate-pulse bg-secondary" />
      </div>
    );
  }

  if (error) {
    return (
      <section className="border border-border bg-card p-4" role="alert">
        <h2 className="font-heading text-base font-bold">{error}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          recargá la página: los datos viven solo en este dispositivo
        </p>
      </section>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="font-heading text-2xl font-bold tracking-tight">Métricas</h1>
        <section className="border border-border bg-card p-4">
          <h2 className="font-heading text-base font-bold">Todavía no hay nada que medir</h2>
          <p className="mt-2 max-w-prose text-sm text-muted-foreground">
            Esta pantalla se arma con lo que registrás: cada sesión suma al mesociclo y su duración, y
            cada serie con valor deja una marca. Empezá entrenando y volvé acá.
          </p>
          <Link
            to="/"
            className="label-caps mt-4 inline-flex h-11 items-center border border-ink bg-accent px-4 text-on-accent transition-colors hover:bg-ink hover:text-on-ink"
          >
            Empezar a entrenar
          </Link>
        </section>
      </div>
    );
  }

  const fin = mesoInicio ? iso(addDias(new Date(mesoInicio + 'T00:00:00'), MESO.total * 7 - 1)) : '';
  const delMeso = mesoInicio
    ? sessions.filter((s) => s.completed && inWindow(s.date.slice(0, 10), { start: mesoInicio, end: fin }))
    : [];
  const conTiempo = delMeso.filter((s) => s.durationSec > 0);
  const minutos = Math.round(
    conTiempo.reduce((total, s) => total + s.durationSec, 0) / 60 / (conTiempo.length || 1),
  );
  const dias = new Set(delMeso.map((s) => s.date.slice(0, 10))).size;
  const anclas = anchorProgress(ANCLAS, collectMarks(sessions, marks));

  return (
    <div className="space-y-4">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-bold tracking-tight">Métricas</h1>
        <p className="text-sm text-muted-foreground">
          {mesoInicio
            ? `Mesociclo desde el ${formatDayMonth(mesoInicio)}`
            : 'sin inicio de mesociclo: cargalo en Hoy para ver el conteo'}
        </p>
      </header>

      {mesoInicio ? (
        <Panel title="Mesociclo" meta={`${MESO.total} semanas`}>
          <div className="grid grid-cols-3 gap-px bg-border">
            <Readout label="Sesiones" value={nf.format(delMeso.length)} />
            <Readout label="Días" value={nf.format(dias)} />
            <Readout
              label="Tiempo promedio"
              value={conTiempo.length > 0 ? nf.format(minutos) : '—'}
              unit={conTiempo.length > 0 ? 'min' : undefined}
            />
          </div>
        </Panel>
      ) : (
        <Panel title="Mesociclo">
          <p className="px-4 py-4 text-sm text-muted-foreground">
            <Link to="/" className="underline underline-offset-4 hover:text-foreground">
              Cargá la fecha de inicio
            </Link>{' '}
            para contar los entrenamientos del bloque.
          </p>
        </Panel>
      )}

      <Panel title="Marcas clave" meta="mejor registro">
        <ul>
          {anclas.map((a) => (
            <li key={a.exercise} className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-foreground">{a.exercise}</div>
                <div className="label-caps mt-1 text-muted-foreground">
                  {a.current === 0
                    ? 'sin registro'
                    : a.reached
                      ? 'objetivo alcanzado'
                      : `al ${a.pct}% del objetivo`}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="metric text-lg tabular-nums text-foreground">
                  {nf.format(a.current)}{' '}
                  <span className="label-caps text-muted-foreground">/ {nf.format(a.target)}</span>
                </div>
                <div className="label-caps mt-1 text-muted-foreground">{UNIT_LABEL[a.unit]}</div>
              </div>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
