import { NavLink, Outlet } from 'react-router-dom';
import { useEffect, useMemo } from 'react';
import { db } from '../db';

const NAV = [
  { id: 'home', label: 'Hoy', path: '/', icon: 'home' },
  { id: 'planes', label: 'Planes', path: '/planes', icon: 'plans' },
  { id: 'progress', label: 'Progreso', path: '/progress', icon: 'progress' },
];

function Icon({ name }: { name: string }) {
  const common = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (name) {
    case 'home':
      return <svg {...common}><path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" /></svg>;
    case 'plans':
      return <svg {...common}><rect x="3" y="4" width="18" height="16" rx="0" /><path d="M3 9h18M8 4v5" /></svg>;
    case 'metrics':
      return <svg {...common}><path d="M4 20V10M10 20V4M16 20v-6M22 20H2" /></svg>;
    case 'progress':
      return <svg {...common}><path d="M3 3v18h18" /><path d="M7 15l4-4 3 3 5-7" /></svg>;
    case 'settings':
      return <svg {...common}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>;
    default:
      return null;
  }
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const fecha = useMemo(() => new Date().toLocaleDateString('es-AR', { weekday: 'short', day: '2-digit', month: 'short' }), []);
  useEffect(() => {
    db.settings.get('theme').then(s => {
      if (s?.value === 'dark') document.documentElement.classList.add('dark');
    }).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen pb-16 md:pb-0">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:z-50 focus:border focus:border-[var(--ink)] focus:bg-[var(--surface)] focus:px-3 focus:py-2 focus:label-caps">Saltar al contenido</a>
      <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--background)]">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-2 px-3 sm:px-6">
          <span className="shrink-0 font-heading text-lg font-bold tracking-tight text-[var(--ink)]">
            Logtenia
          </span>
          <nav aria-label="Navegación principal" className="hidden md:inline-flex items-center shrink-0 divide-x divide-[var(--border)] overflow-x-auto">
            {NAV.map((n) => (
              <NavLink
                key={n.id}
                to={n.path}
                className={({ isActive }) =>
                  'label-caps h-11 inline-flex items-center justify-center gap-2 px-4 transition-colors ' +
                  (isActive
                    ? 'bg-[var(--ink)] text-[var(--voltage-lime)]'
                    : 'bg-[var(--surface)] text-[var(--muted-ink)] hover:bg-[var(--muted-surface)] hover:text-[var(--ink)]')
                }
              >
                <Icon name={n.icon} />
                {n.label}
              </NavLink>
            ))}
          </nav>
          <span className="shrink-0 label-caps text-[var(--muted-ink)] md:hidden">
            {fecha}
          </span>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-6xl space-y-4 px-4 py-6 sm:px-6">
        {children ?? <Outlet />}
      </main>
      <nav
        aria-label="Navegación principal"
        className="fixed bottom-0 inset-x-0 z-30 border-t border-[var(--border)] bg-[var(--background)] md:hidden"
      >
        <ul className="mx-auto flex max-w-6xl items-stretch justify-around">
          {NAV.map((n) => (
            <li key={n.id} className="flex-1">
              <NavLink
                to={n.path}
                className={({ isActive }) =>
                  'relative flex min-h-[56px] flex-col items-center justify-center gap-0.5 px-1 text-center transition-colors ' +
                  (isActive
                    ? 'text-[var(--ink)]'
                    : 'text-[var(--muted-ink)] hover:text-[var(--ink)]')
                }
              >
                {({ isActive }) => (
                  <>
                    <span className={isActive ? 'text-[var(--voltage-lime)]' : ''}><Icon name={n.icon} /></span>
                    <span className="label-status">{n.label}</span>
                    {isActive && <span className="absolute bottom-0 h-0.5 w-8 bg-[var(--voltage-lime)]" />}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}