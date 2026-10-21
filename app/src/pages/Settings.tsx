import { useEffect, useState } from 'react';
import { db } from '../db';
import { cn } from '@/lib/utils';

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex min-h-[56px] items-center justify-between gap-3 border border-border bg-card px-4 py-3">
      <span className="text-sm">{label}</span>
      {children}
    </label>
  );
}

const BACKUP_SHAPE: { key: string; fields: string[] }[] = [
  { key: 'sessions', fields: ['date', 'planId', 'modelId'] },
  { key: 'progress', fields: ['exerciseId', 'week', 'value'] },
  { key: 'goals', fields: ['goalId', 'current'] },
  { key: 'settings', fields: ['key'] },
  { key: 'marks', fields: ['exercise', 'value', 'unit'] },
  { key: 'tags', fields: ['targetType', 'targetId', 'tag'] },
];

function hasFields(value: unknown, fields: string[]): boolean {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        item !== null &&
        typeof item === 'object' &&
        fields.every((field) => field in (item as Record<string, unknown>)),
    )
  );
}

export default function Settings() {
  const [sound, setSound] = useState(true);
  const [dark, setDark] = useState(false);
  const [msg, setMsg] = useState('');
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    (async () => {
      const s = await db.settings.get('sound');
      if (s) setSound(!!s.value);
      const t = await db.settings.get('theme');
      if (t) setDark(t.value === 'dark');
    })();
  }, []);

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
    try {
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
    } catch {
      setMsg('No se pudo exportar el backup.');
    }
  };

  const importData = async (file: File) => {
    setImporting(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text) as Record<string, unknown>;
      if (data === null || typeof data !== 'object') throw new Error('formato');
      for (const { key, fields } of BACKUP_SHAPE) {
        const value = data[key];
        if (value === undefined) continue;
        if (!hasFields(value, fields)) throw new Error('formato');
      }
      if (Array.isArray(data.sessions)) await db.sessions.bulkPut(data.sessions);
      if (Array.isArray(data.progress)) await db.progress.bulkPut(data.progress);
      if (Array.isArray(data.goals)) await db.goals.bulkPut(data.goals);
      if (Array.isArray(data.settings)) await db.settings.bulkPut(data.settings);
      if (Array.isArray(data.marks)) await db.marks.bulkPut(data.marks);
      if (Array.isArray(data.tags)) await db.tags.bulkPut(data.tags);
      setMsg('Importación completada.');
    } catch {
      setMsg('No se pudo leer el archivo. Revisá que sea un backup de Logstenia.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-bold tracking-tight">Ajustes</h1>
        <p className="label-caps text-muted-foreground">sonido · tema · datos</p>
      </header>

      <section className="border border-border bg-card">
        <header className="border-b border-border px-4 py-2">
          <h2 className="label-caps text-foreground">Sonido</h2>
        </header>
        <div className="space-y-2 p-4">
          <Row label="Sonido al terminar el descanso">
            <input
              type="checkbox"
              className="h-5 w-5 accent-[var(--text)]"
              aria-label="Sonido al terminar el descanso"
              checked={sound}
              onChange={toggleSound}
            />
          </Row>
          <button
            type="button"
            onClick={testSound}
            className="label-caps h-11 border border-border bg-card px-4 text-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
          >
            Probar sonido
          </button>
        </div>
      </section>

      <section className="border border-border bg-card">
        <header className="border-b border-border px-4 py-2">
          <h2 className="label-caps text-foreground">Tema</h2>
        </header>
        <div className="p-4">
          <Row label="Tema oscuro">
            <input
              type="checkbox"
              className="h-5 w-5 accent-[var(--text)]"
              aria-label="Tema oscuro"
              checked={dark}
              onChange={toggleTheme}
            />
          </Row>
        </div>
      </section>

      <section className="border border-border bg-card">
        <header className="border-b border-border px-4 py-2">
          <h2 className="label-caps text-foreground">Datos</h2>
        </header>
        <div className="space-y-2 p-4">
          <p className="label-caps text-muted-foreground">
            todo vive en este dispositivo: exportá un backup antes de limpiar el navegador
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={exportData}
              className="label-caps h-11 border border-ink bg-accent px-4 text-ink transition-colors hover:bg-primary hover:text-primary-foreground"
            >
              Exportar backup
            </button>
            <label
              className={cn(
                'label-caps inline-flex h-11 cursor-pointer items-center border border-border bg-card px-4 text-foreground transition-colors hover:bg-primary hover:text-primary-foreground',
                importing && 'pointer-events-none opacity-50',
              )}
            >
              {importing ? 'Importando…' : 'Importar backup'}
              <input
                type="file"
                accept="application/json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) importData(f);
                  e.target.value = '';
                }}
              />
            </label>
          </div>
          {msg ? (
            <p role="status" className="label-caps text-muted-foreground">
              {msg}
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
