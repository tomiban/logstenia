import { useEffect, useRef, useState } from 'react';
import { db } from '../db';
import { cn } from '@/lib/utils';

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

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex min-h-[44px] items-center justify-between gap-3">
      <span className="text-sm">{label}</span>
      {children}
    </label>
  );
}

/** Settings popover anchored to the profile name in the navbar. */
export function SettingsMenu() {
  const [open, setOpen] = useState(false);
  const [sound, setSound] = useState(true);
  const [dark, setDark] = useState(false);
  const [msg, setMsg] = useState('');
  const [importing, setImporting] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    (async () => {
      const s = await db.settings.get('sound');
      if (s) setSound(!!s.value);
      const t = await db.settings.get('theme');
      if (t) setDark(t.value === 'dark');
    })();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const toggleSound = async () => {
    const value = !sound;
    setSound(value);
    await db.settings.put({ key: 'sound', value });
  };

  const toggleTheme = async () => {
    const value = !dark;
    setDark(value);
    await db.settings.put({ key: 'theme', value: value ? 'dark' : 'light' });
    document.documentElement.classList.toggle('dark', value);
  };

  const testSound = () => {
    const audio = new Audio('/sounds/item-found.mp3');
    audio.play().catch(() => {});
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
      const link = document.createElement('a');
      link.href = url;
      link.download = 'logstenia-backup.json';
      link.click();
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
    <div ref={rootRef} className="relative shrink-0">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="label-caps h-11 border border-border bg-card px-3 text-foreground transition-colors hover:bg-secondary"
      >
        tomas
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Ajustes"
          className="absolute right-0 top-full z-30 mt-1 w-[280px] border border-border bg-card p-4"
        >
          <div className="border-b border-border pb-2">
            <p className="label-caps text-foreground">Ajustes</p>
          </div>

          <div className="space-y-1 pt-3">
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
              className="label-caps h-11 w-full border border-border bg-card px-3 text-left text-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
            >
              Probar sonido
            </button>
          </div>

          <div className="border-t border-border pt-2">
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

          <div className="border-t border-border pt-3">
            <p className="label-caps text-muted-foreground">Tus datos viven en este dispositivo</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={exportData}
                className="label-caps h-11 border border-ink bg-accent px-3 text-ink transition-colors hover:bg-primary hover:text-primary-foreground"
              >
                Exportar
              </button>
              <label
                className={cn(
                  'label-caps inline-flex h-11 cursor-pointer items-center border border-border bg-card px-3 text-foreground transition-colors hover:bg-primary hover:text-primary-foreground',
                  importing && 'pointer-events-none opacity-50',
                )}
              >
                {importing ? 'Importando…' : 'Importar'}
                <input
                  type="file"
                  accept="application/json"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) importData(file);
                    e.target.value = '';
                  }}
                />
              </label>
            </div>
            {msg ? (
              <p role="status" className="label-caps mt-2 text-muted-foreground">
                {msg}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
