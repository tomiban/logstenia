import { useCallback, useEffect, useMemo, useState } from 'react';
import { db } from '../db';
import { allPrograms } from '../lib/plans';
import { computeStats, type Stats } from '../lib/stats';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Progress as ProgressBar } from '@/components/ui/progress';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const WEEKS = ['S1','S2','S3','S4','S5','S6','S7','S8'];

export default function Progress() {
  // --- métricas ---
  const [stats, setStats] = useState<Stats>({ sessions: 0, totalMin: 0, streak: 0, byPlan: [] });
  const [progressRows, setProgressRows] = useState<any[]>([]);
  const [goalCurrent, setGoalCurrent] = useState<Record<string, number>>({});

  // --- progreso semanal ---
  const [exercise, setExercise] = useState('');
  const [week, setWeek] = useState('S1');
  const [value, setValue] = useState('');

  // --- ajustes ---
  const [sound, setSound] = useState(true);
  const [dark, setDark] = useState(false);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    setStats(await computeStats());
    const pr = await db.progress.toArray();
    setProgressRows(pr);
    const g = await db.goals.toArray();
    const gm: Record<string, number> = {};
    g.forEach(x => { gm[x.goalId] = x.current; });
    setGoalCurrent(gm);
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  useEffect(() => {
    (async () => {
      const s = await db.settings.get('sound');
      if (s) setSound(!!s.value);
      const t = await db.settings.get('theme');
      if (t) setDark(t.value === 'dark');
    })();
  }, []);

  const saveProgress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!exercise || !value) return;
    await db.progress.add({ exerciseId: exercise, week, value: Number(value), date: new Date().toISOString() });
    setExercise(''); setValue('');
    loadAll();
  };

  const grouped = useMemo(() => {
    const out: Record<string, Record<string, number>> = {};
    progressRows.forEach(r => {
      out[r.exerciseId] = out[r.exerciseId] || {};
      out[r.exerciseId][r.week] = r.value;
    });
    return out;
  }, [progressRows]);

  const toggleSound = async () => {
    const v = !sound;
    setSound(v);
    await db.settings.put({ key: 'sound', value: v });
  };
  const toggleTheme = async () => {
    const v = !dark;
    setDark(v);
    await db.settings.put({ key: 'theme', value: v ? 'dark' : 'light' });
    document.documentElement.classList.toggle('dark', v);
  };
  const testSound = () => {
    const a = new Audio('/sounds/item-found.mp3');
    a.play().catch(() => {});
  };
  const exportData = async () => {
    const data = {
      sessions: await db.sessions.toArray(),
      progress: await db.progress.toArray(),
      goals: await db.goals.toArray(),
      settings: await db.settings.toArray(),
      marks: await db.marks.toArray(),
      tags: await db.tags.toArray(),
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'logstenia-backup.json';
    a.click();
    URL.revokeObjectURL(url);
    setMsg('Backup exportado.');
  };
  const importData = async (file: File) => {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (Array.isArray(data.sessions)) await db.sessions.bulkPut(data.sessions);
      if (Array.isArray(data.progress)) await db.progress.bulkPut(data.progress);
      if (Array.isArray(data.goals)) await db.goals.bulkPut(data.goals);
      if (Array.isArray(data.settings)) await db.settings.bulkPut(data.settings);
      if (Array.isArray(data.marks)) await db.marks.bulkPut(data.marks);
      if (Array.isArray(data.tags)) await db.tags.bulkPut(data.tags);
      setMsg('Importación completada.');
      loadAll();
    } catch {
      setMsg('Error al importar el archivo.');
    }
  };

  if (loading) {
    return (
      <div className="space-y-6" aria-busy="true" aria-label="Cargando">
        <div className="h-8 w-40 animate-pulse bg-[var(--muted-surface)]" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse bg-[var(--muted-surface)]" />
          ))}
        </div>
        <div className="h-48 animate-pulse bg-[var(--muted-surface)]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-bold tracking-tight">Progreso</h1>
        <p className="label-caps text-[var(--muted)]">métricas, marcas y ajustes</p>
      </header>

      {/* Métricas */}
      <section className="space-y-3">
        <h2 className="font-heading text-base font-bold">Métricas</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="p-4">
            <div className="metric text-3xl text-[var(--foreground)]">{stats.sessions}</div>
            <div className="label-caps text-[var(--muted)] mt-1">sesiones</div>
          </Card>
          <Card className="p-4">
            <div className="metric text-3xl text-[var(--foreground)]">{stats.totalMin}</div>
            <div className="label-caps text-[var(--muted)] mt-1">minutos totales</div>
          </Card>
          <Card className="p-4">
            <div className="metric text-3xl text-[var(--foreground)]">{stats.streak}</div>
            <div className="label-caps text-[var(--muted)] mt-1">racha (días)</div>
          </Card>
          <Card className="p-4">
            <div className="metric text-3xl text-[var(--foreground)]">{stats.byPlan.length}</div>
            <div className="label-caps text-[var(--muted)] mt-1">planes usados</div>
          </Card>
        </div>

        <div>
          <h3 className="label-caps text-[var(--foreground)] mb-2">Sesiones por plan</h3>
          {stats.byPlan.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">Sin sesiones registradas aún.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {stats.byPlan.map(b => (
                <li key={b.planId} className="flex justify-between border-b border-[var(--border)] py-1">
                  <span>{b.name}</span><span className="metric text-[var(--muted)]">{b.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h3 className="label-caps text-[var(--foreground)] mb-2">Progreso registrado (holds/reps)</h3>
          {progressRows.length === 0 && <p className="text-sm text-[var(--muted)]">Sin registros aún. Usá el formulario de abajo.</p>}
          <ul className="space-y-1 text-sm">
            {progressRows.map(p => (
              <li key={p.id} className="flex justify-between border-b border-[var(--border)] py-1">
                <span>{p.exerciseId} · {p.week}</span>
                <span className="metric text-[var(--muted)]">{p.value}</span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="label-caps text-[var(--foreground)] mb-2">Metas</h3>
          {allPrograms().flatMap(p => p.goals).length === 0 && (
            <p className="text-sm text-[var(--muted)]">Sin metas definidas.</p>
          )}
          <div className="space-y-3">
            {allPrograms().flatMap(p => p.goals.map(g => ({ program: p, goal: g }))).map(({ program, goal }) => {
              const cur = goalCurrent[goal.id] ?? 0;
              const pct = Math.min(100, Math.round((cur / goal.target) * 100));
              return (
                <Card key={goal.id} className="p-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium text-sm">{goal.name}</span>
                    <Badge variant="secondary">{program.name}</Badge>
                  </div>
                  <ProgressBar value={pct} className="mb-2" />
                  <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
                    <span>{cur} / {goal.target} {goal.unit}</span>
                    <Input
                      type="number"
                      className="w-20 h-8 text-xs"
                      defaultValue={cur}
                      onBlur={async (e) => {
                        const v = Number(e.target.value);
                        if (Number.isNaN(v)) return;
                        setGoalCurrent(prev => ({ ...prev, [goal.id]: v }));
                        await db.goals.put({ goalId: goal.id, current: v, updatedAt: new Date().toISOString() });
                      }}
                    />
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Progreso semanal */}
      <section className="space-y-3">
        <h2 className="font-heading text-base font-bold">Progreso semanal (S1..S8)</h2>
        <form onSubmit={saveProgress} className="flex flex-wrap items-end gap-2 border border-[var(--border)] bg-[var(--surface)] p-3">
          <div className="flex-1 min-w-[160px] space-y-1">
            <label htmlFor="prog-exercise" className="label-caps text-[var(--muted)]">Ejercicio</label>
            <Input id="prog-exercise" value={exercise} onChange={e=>setExercise(e.target.value)} placeholder="Hold tuck planche" />
          </div>
          <div className="space-y-1">
            <label htmlFor="prog-week" className="label-caps text-[var(--muted)]">Semana</label>
            <select id="prog-week" value={week} onChange={(e) => setWeek(e.target.value)} className="h-10 min-w-[80px] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm">
              {WEEKS.map(w=><option key={w}>{w}</option>)}
            </select>
          </div>
          <div className="w-24 space-y-1">
            <label htmlFor="prog-value" className="label-caps text-[var(--muted)]">Valor</label>
            <Input id="prog-value" type="number" value={value} onChange={e=>setValue(e.target.value)} placeholder="0" />
          </div>
          <Button type="submit" size="sm" className="min-h-[40px]">Guardar</Button>
        </form>

        {Object.keys(grouped).length === 0 ? (
          <p className="text-sm text-[var(--muted)]">Sin registros aún. Guardá tu primera marca arriba.</p>
        ) : (
          <div className="overflow-x-auto border border-[var(--border)]">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--muted-surface)]">
                  <th className="sticky left-0 bg-[var(--muted-surface)] p-2 text-left label-caps text-[var(--muted)]">Ejercicio</th>
                  {WEEKS.map(w=><th key={w} className="p-2 text-center label-caps text-[var(--muted)]">{w}</th>)}
                </tr>
              </thead>
              <tbody>
                {Object.entries(grouped).map(([ex, vals]) => (
                  <tr key={ex} className="border-t border-[var(--border)]">
                    <td className="sticky left-0 bg-[var(--surface)] p-2 font-medium">{ex}</td>
                    {WEEKS.map(w => <td key={w} className="p-2 text-center metric text-[var(--foreground)]">{vals[w] ?? '—'}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Ajustes */}
      <section className="space-y-3">
        <h2 className="font-heading text-base font-bold">Ajustes</h2>
        <div className="space-y-2">
          <h3 className="label-caps text-[var(--foreground)]">Sonido</h3>
          <label className="flex min-h-[48px] items-center justify-between border border-[var(--border)] bg-[var(--surface)] p-3">
            <span className="text-sm">Sonido al terminar descanso</span>
            <input type="checkbox" className="h-5 w-5" aria-label="Sonido al terminar descanso" checked={sound} onChange={toggleSound} />
          </label>
          <Button variant="secondary" size="sm" onClick={testSound}>Probar sonido</Button>
        </div>
        <div className="space-y-2">
          <h3 className="label-caps text-[var(--foreground)]">Tema</h3>
          <label className="flex min-h-[48px] items-center justify-between border border-[var(--border)] bg-[var(--surface)] p-3">
            <span className="text-sm">Tema oscuro</span>
            <input type="checkbox" className="h-5 w-5" aria-label="Tema oscuro" checked={dark} onChange={toggleTheme} />
          </label>
        </div>
        <div className="space-y-2">
          <h3 className="label-caps text-[var(--foreground)]">Datos</h3>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={exportData}>Exportar backup</Button>
            <label className="inline-flex min-h-[40px] cursor-pointer items-center border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm">
              Importar backup
              <input type="file" accept="application/json" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) importData(f); }} />
            </label>
          </div>
          {msg && <p className="label-caps text-[var(--muted)]">{msg}</p>}
        </div>
      </section>
    </div>
  );
}