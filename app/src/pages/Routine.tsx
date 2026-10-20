import { useParams, Link } from 'react-router-dom';
import { useEffect } from 'react';
import { getModel } from '../lib/plans';
import { addTag } from '../lib/tags';
import Video from '../components/Video';
import { Button } from '@/components/ui/button';
import { TagsInput } from '../components/ui/tags-input';

function fmtRest(sec: number) { return sec >= 60 ? `${Math.round(sec / 60)}min` : `${sec}s`; }

export default function Routine() {
  const { id } = useParams();
  const res = getModel(id || '');

  useEffect(() => {
    if (!res) return;
    const { model } = res;
    (async () => {
      for (const b of model.blocks) {
        for (const e of b.exercises) {
          if (e.name.toLowerCase().includes('hold') || e.timeSec) {
            await addTag('exercise', e.name, 'isometricos');
          }
        }
      }
    })();
  }, [id]);

  if (!res) return <p className="label-caps">Rutina no encontrada.</p>;
  const { model, program } = res;

  return (
    <div className="space-y-6">
      <div>
        <Link to={`/program/${program.id}`} className="label-caps text-[var(--muted)] hover:text-[var(--ink)]">
          ← {program.name}
        </Link>
      </div>

      <header className="border-b border-[var(--border)] pb-4">
        <h1 className="font-heading text-3xl font-bold tracking-tight text-[var(--foreground)]">{model.name}</h1>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <p className="text-sm text-[var(--muted)]">
            Intensidad {model.intensity} · {model.totalTimeMin} min
            {program.rules.length > 0 && ` · ${program.rules.join(' · ')}`}
          </p>
          <TagsInput targetType="routine" targetId={model.id} allowAdd={false} />
        </div>
      </header>


      <div className="space-y-4">
        {model.blocks.map((b, i) => (
          <section key={i} className="border border-[var(--border)]">
            <div className="border-b border-[var(--border)] bg-[var(--muted-surface)] px-3 py-2 flex flex-wrap items-center justify-between gap-2">
              <span className="label-caps text-[var(--foreground)]">{b.type}</span>
              <span className="label-caps text-[var(--muted)]">
                {b.sets} vuelta(s) · descanso {fmtRest(b.restBetweenSetsSec)}
                {b.restBetweenExercisesSec ? ` · entre ejercicios ${fmtRest(b.restBetweenExercisesSec)}` : ''}
              </span>
            </div>
            <ul className="divide-y divide-[var(--border)]">
              {b.exercises.map((e, j) => (
                <li key={j} className="px-3 py-3 bg-[var(--surface)]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <span className="block font-heading text-base font-bold text-[var(--foreground)]">{e.name}</span>
                    </div>
                    <div className="shrink-0 flex items-center gap-2">
                      <Video query={e.name} />
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
                  <div className="mt-2">
                    <TagsInput targetType="exercise" targetId={e.name} />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <div>
        <Link to={`/run/${model.id}`} className="block">
          <Button className="w-full">Iniciar rutina</Button>
        </Link>
      </div>
    </div>
  );
}
