import { Button } from '@/components/ui/button';
import { useCronometro, fmt, type CronometroProps } from './useCronometro';
export type { CronometroProps };

export default function Cronometro(props: CronometroProps) {
  const c = useCronometro(props);

  return (
    <div className={'border bg-card p-4 ' + (c.corre ? 'border-ink' : 'border-border')}>
      <div className="flex items-center justify-between gap-2">
        <span className="label-caps">{c.corre ? '● ' : ''}{c.modo === 'descanso' ? 'Descanso' : 'Cronómetro'}</span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-4">
        {c.preparando ? (
          <span className="metric tabular text-5xl text-ink animate-pulse">{c.countdown === 0 ? 'GO!' : c.countdown}</span>
        ) : (
          <>
            <span className={'metric tabular text-5xl ' + (c.corre ? 'text-ink' : c.agotado ? 'text-muted-foreground' : '')}>{fmt(Math.max(0, c.seg))}</span>
            {c.objetivo ? <span className="label-caps text-muted-foreground">/ {fmt(c.objetivo)}</span> : null}
          </>
        )}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={c.aplicar} disabled={c.corre || c.agotado}>
            {c.preparando ? 'Preparando…' : 'Aplicar'}
          </Button>
          <Button variant="ghost" size="sm" onClick={c.reset}>Reiniciar</Button>
          {props.onUsar && c.modo === 'crono' && (
            <Button variant="accent" size="sm" disabled={props.usarDisabled} onClick={c.usar}>Usar tiempo</Button>
          )}
        </div>
      </div>
      {c.sinSonido ? (
        <p className="label-caps mt-2 text-muted-foreground" role="status">no se pudo reproducir el sonido del descanso</p>
      ) : null}
      <span className="sr-only" role="status">{c.aviso ? 'descanso terminado' : ''}</span>
    </div>
  );
}
