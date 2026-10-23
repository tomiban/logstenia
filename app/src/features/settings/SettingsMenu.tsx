import { useEffect, useRef, useState } from 'react';
import {
  createGoalRepository,
  createMarkRepository,
  createProgressRepository,
  createSessionRepository,
  createSettingsRepository,
  createTagRepository,
  exportableSettings,
} from '@/repositories';
import { toISOTimestamp } from '@/lib/date';
import { Button } from '@/components/ui/button';
import { useSyncStatus } from './useSyncStatus';

const sessionRepository = createSessionRepository();
const progressRepository = createProgressRepository();
const goalRepository = createGoalRepository();
const settingsRepository = createSettingsRepository();
const markRepository = createMarkRepository();
const tagRepository = createTagRepository();

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sync = useSyncStatus();

  useEffect(() => {
    (async () => {
      const s = await settingsRepository.get('sound');
      if (s) setSound(!!s.value);
      const t = await settingsRepository.get('theme');
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
    await settingsRepository.put({ key: 'sound', value });
  };

  const toggleTheme = async () => {
    const value = !dark;
    setDark(value);
    await settingsRepository.put({ key: 'theme', value: value ? 'dark' : 'light' });
    document.documentElement.classList.toggle('dark', value);
  };

  const testSound = () => {
    const audio = new Audio('/sounds/item-found.mp3');
    audio.play().catch(() => {});
  };

  const exportData = async () => {
    try {
      const data = {
        sessions: await sessionRepository.list(),
        progress: await progressRepository.list(),
        goals: await goalRepository.list(),
        settings: exportableSettings(await settingsRepository.list()),
        marks: await markRepository.list(),
        tags: await tagRepository.list(),
        exportedAt: toISOTimestamp(),
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
      if (Array.isArray(data.sessions)) await sessionRepository.bulkPut(data.sessions);
      if (Array.isArray(data.progress)) await progressRepository.bulkPut(data.progress);
      if (Array.isArray(data.goals)) await goalRepository.bulkPut(data.goals);
      if (Array.isArray(data.settings)) await settingsRepository.bulkPut(data.settings);
      if (Array.isArray(data.marks)) await markRepository.bulkPut(data.marks);
      if (Array.isArray(data.tags)) await tagRepository.bulkPut(data.tags);
      setMsg('Importación completada.');
    } catch {
      setMsg('No se pudo leer el archivo. Revisá que sea un backup de Logstenia.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div ref={rootRef} className="relative shrink-0">
      <Button
        ref={buttonRef}
        type="button"
        variant="outline"
        size="lg"
        className="label-caps"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        tomas
      </Button>

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
                className="h-5 w-5 accent-foreground"
                aria-label="Sonido al terminar el descanso"
                checked={sound}
                onChange={toggleSound}
              />
            </Row>
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="label-caps w-full justify-start"
              onClick={testSound}
            >
              Probar sonido
            </Button>
          </div>

          <div className="border-t border-border pt-2">
            <Row label="Tema oscuro">
              <input
                type="checkbox"
                className="h-5 w-5 accent-foreground"
                aria-label="Tema oscuro"
                checked={dark}
                onChange={toggleTheme}
              />
            </Row>
          </div>

          <div className="border-t border-border pt-3">
            <p className="label-caps text-muted-foreground">Sincronización</p>
            <p role="status" className="mt-2 text-xs text-muted-foreground">
              {sync.statusLine}
            </p>
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="label-caps mt-2 w-full justify-start"
              disabled={sync.syncing}
              onClick={sync.syncNow}
            >
              {sync.syncing ? 'Sincronizando…' : 'Sincronizar ahora'}
            </Button>
            {sync.sessionExpired ? (
              <Button
                type="button"
                variant="destructive"
                size="lg"
                className="label-caps mt-2 w-full justify-start"
                onClick={() => window.location.reload()}
              >
                {sync.sessionLine}
              </Button>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">{sync.sessionLine}</p>
            )}
            {sync.clockWarning ? (
              <p className="mt-2 text-xs text-warning">{sync.clockWarning}</p>
            ) : null}
          </div>

          <div className="border-t border-border pt-3">
            <p className="label-caps text-muted-foreground">Tus datos viven en este dispositivo</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="accent"
                size="lg"
                className="label-caps"
                onClick={exportData}
              >
                Exportar
              </Button>
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="label-caps"
                disabled={importing}
                onClick={() => fileInputRef.current?.click()}
              >
                {importing ? 'Importando…' : 'Importar'}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) importData(file);
                  e.target.value = '';
                }}
              />
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
