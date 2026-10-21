import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getProgram } from '../lib/plans';
import { chainFor, getProgressionIndex, isUnlocked, unlockedReason, anchorsFor } from '../lib/progression';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TagsInput } from '../components/ui/tags-input';
import { db } from '../db';

export default function Program() {
  const { id } = useParams();
  const p = getProgram(id || '');
  const [progIdx, setProgIdx] = useState<number | null>(null);
  const [unlocked, setUnlocked] = useState(true);
  const [lockReason, setLockReason] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const [marks, setMarks] = useState<any[]>([]);
  const [challengeAnchors, setChallengeAnchors] = useState<any[]>([]);
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
              {challengeAnchors.length > 0 && challengeAnchors.every((a) => {
                const best = marks.filter((m: any) => m.exercise === a.ejercicio).reduce((acc: number, m: any) => Math.max(acc, m.value), 0);
                return best >= a.objetivo;
              }) && (
                <p className="label-caps text-[var(--voltage-lime)]">¡Listo para el siguiente nivel!</p>
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
              {unlocked ? (
                <Link to={`/routine/${m.id}`} className="block">
                  <Card className="flex h-full flex-col gap-2 px-3 py-2 transition-colors hover:border-[var(--ink)]">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium leading-tight">{m.name}</span>
                      <div onClick={(e) => e.stopPropagation()}>
                        <TagsInput targetType="routine" targetId={m.id} />
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="secondary" className="label-status">{m.totalTimeMin} min</Badge>
                      <Badge variant="outline" className="label-status border-[var(--border)] text-[var(--muted)]">intensidad {m.intensity}</Badge>
                    </div>
                  </Card>
                </Link>
              ) : (
                <Card className="flex h-full flex-col gap-2 px-3 py-2 opacity-60">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium leading-tight">{m.name}</span>
                    <div onClick={(e) => e.stopPropagation()}>
                      <TagsInput targetType="routine" targetId={m.id} allowAdd={false} />
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="secondary" className="label-status">{m.totalTimeMin} min</Badge>
                    <Badge variant="outline" className="label-status border-[var(--border)] text-[var(--muted)]">intensidad {m.intensity}</Badge>
                  </div>
                </Card>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
