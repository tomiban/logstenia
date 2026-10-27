import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { createSettingsRepository } from '@/repositories';
import { migrateMarksToIds } from '@/features/progress/marks';
import { migrateBlocksToIds } from '@/features/plans/blocks';
import { SettingsMenu } from '@/features/settings/SettingsMenu';

const settingsRepository = createSettingsRepository();

const NAV = [
  { id: 'home', label: 'Hoy', path: '/', icon: 'home' },
  { id: 'planes', label: 'Planes', path: '/planes', icon: 'plans' },
  { id: 'metrics', label: 'Métricas', path: '/metrics', icon: 'metrics' },
];

/** Detail routes a nav item owns, so the catalog stays highlighted while you are inside it. */
const NAV_OWNED_ROUTES: Record<string, string[]> = {
  planes: ['/planes', '/program', '/routine', '/skill'],
};

function navIsActive(id: string, path: string, pathname: string): boolean {
  const owned = NAV_OWNED_ROUTES[id];
  if (!owned) return pathname === path;
  return owned.some((prefix) => pathname === prefix || pathname.startsWith(prefix + '/'));
}

function Icon({ name }: { name: string }) {
  const common = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (name) {
    case 'home':
      return <svg {...common}><path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" /></svg>;
    case 'plans':
      return <svg {...common}><rect x="3" y="4" width="18" height="16" rx="0" /><path d="M3 9h18M8 4v5" /></svg>;
    case 'metrics':
      return <svg {...common}><path d="M4 20V10M10 20V4M16 20v-6M22 20H2" /></svg>;
    default:
      return null;
  }
}

/**
 * Best-effort boot work: applying the saved theme and the lazy id migrations. A failure here
 * leaves the stored data readable and the migration retries on the next mount, so it is reported to
 * the console instead of turning into an error banner on every screen. The `<html>` class is set
 * imperatively because React does not own that node; Tailwind's dark mode reads it from there.
 */
function bestEffort(run: () => Promise<unknown>): void {
  void run().catch((error: unknown) => {
    console.error('[layout] boot task failed', error);
  });
}

export default function Layout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  /* The guided session owns the whole screen: its own control bar sits where the app nav usually
     does, so the nav steps aside instead of stacking two bottom bars on a 390px phone. */
  const immersive = pathname.startsWith('/run');

  useEffect(() => {
    bestEffort(() =>
      settingsRepository.get('theme').then((saved) => {
        if (saved?.value === 'dark') document.documentElement.classList.add('dark');
      }),
    );
    bestEffort(migrateMarksToIds);
    bestEffort(migrateBlocksToIds);
  }, []);

  return (
    <div className={'min-h-screen ' + (immersive ? '' : 'pb-20 md:pb-0')}>
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:z-50 focus:border focus:border-foreground focus:bg-card focus:px-3 focus:py-2 focus:label-caps">Saltar al contenido</a>
      <header className="sticky top-0 z-20 border-b border-border bg-background">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-2 px-6">
          <span className="shrink-0 inline-flex items-center gap-2 font-heading text-lg font-bold tracking-tight text-foreground">
            <img src="/favicon.svg" width="24" height="24" alt="" aria-hidden="true" className="shrink-0" />
            Logtenia
          </span>
          <nav aria-label="Navegación principal" className="hidden md:inline-flex items-center shrink-0 divide-x divide-border border border-border overflow-x-auto">
            {NAV.map((n) => (
              <NavLink
                key={n.id}
                to={n.path}
                className={
                  'label-caps h-11 inline-flex items-center justify-center gap-2 px-4 transition-colors ' +
                  (navIsActive(n.id, n.path, pathname)
                    ? 'bg-primary text-primary-foreground dark:bg-foreground dark:text-background'
                    : 'bg-card text-muted-foreground hover:bg-secondary hover:text-foreground')
                }
              >
                <Icon name={n.icon} />
                {n.label}
              </NavLink>
            ))}
          </nav>
          <SettingsMenu />
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-6xl space-y-4 px-6 py-6">
        {children ?? <Outlet />}
      </main>
      <nav
        aria-label="Navegación principal"
        className={
          'fixed bottom-0 inset-x-0 z-30 border-t border-border bg-background md:hidden' +
          (immersive ? ' hidden' : '')
        }
      >
        <ul className="mx-auto flex max-w-6xl items-stretch justify-around">
          {NAV.map((n) => (
            <li key={n.id} className="flex-1">
              <NavLink
                to={n.path}
                className={
                  'flex min-h-[56px] flex-col items-center justify-center gap-0.5 px-1 text-center transition-colors ' +
                  (navIsActive(n.id, n.path, pathname)
                    ? 'bg-primary text-primary-foreground dark:bg-foreground dark:text-background'
                    : 'text-muted-foreground hover:text-foreground')
                }
              >
                <span><Icon name={n.icon} /></span>
                <span className="label-status">{n.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}