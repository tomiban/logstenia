import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';

const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

let audio: HTMLAudioElement | null = null;

export function desbloquearAudio() {
  audio = audio || new Audio('/sounds/item-found.mp3');
  audio.volume = 0;
  audio.play().catch(() => {});
  audio.pause();
  audio.volume = 1;
}

export default function Cronometro({ modo = 'crono', inicio = 60, objetivo, onFin, onUsar, auto = false, usarDisabled = false }: any) {
  const [seg, setSeg] = useState(modo === 'descanso' ? inicio : 0);
  const [corre, setCorre] = useState(auto);
  const [aviso, setAviso] = useState(false);
  const [preparando, setPreparando] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const fin = useRef(onFin);
  fin.current = onFin;

  useEffect(() => {
    if (!preparando) return;
    if (countdown <= 0) {
      setPreparando(false);
      try {
        const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
        if (Ctx) {
          const ctx = new Ctx();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain); gain.connect(ctx.destination);
          osc.frequency.value = 880; gain.gain.value = 0.3;
          osc.start(); osc.stop(ctx.currentTime + 0.2);
        }
      } catch {}
      (navigator as any).vibrate?.([100]);
      setCorre(true);
      return;
    }
    const id = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [preparando, countdown]);

  useEffect(() => {
    if (!corre) return;
    const t0 = Date.now();
    const s0 = seg;
    const id = setInterval(() => {
      const d = Math.floor((Date.now() - t0) / 1000);
      setSeg(modo === 'descanso' ? Math.max(0, s0 - d) : s0 + d);
    }, 250);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [corre, modo]);

  useEffect(() => {
    if (!corre || !('wakeLock' in navigator)) return;
    let lock: any = null;
    (navigator as any).wakeLock.request('screen').then((l: any) => { lock = l; }).catch(() => {});
    return () => lock?.release?.().catch(() => {});
  }, [corre]);

  useEffect(() => {
    if (!corre) setSeg(modo === 'descanso' ? inicio : 0);
  }, [inicio, modo]);

  useEffect(() => {
    if (modo !== 'crono' || !corre || !objetivo || seg < objetivo) return;
    setCorre(false);
    (navigator as any).vibrate?.([180, 90, 180]);
    try {
      const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (Ctx) {
        const ctx = new Ctx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.frequency.value = 880; gain.gain.value = 0.3;
        osc.start(); osc.stop(ctx.currentTime + 0.3);
      }
    } catch {}
  }, [seg, corre, modo, objetivo]);

  useEffect(() => {
    if (modo !== 'descanso' || !corre || seg > 0) return;
    setCorre(false);
    setAviso(true);
    (navigator as any).vibrate?.([180, 90, 180]);
    audio = audio || new Audio('/sounds/item-found.mp3');
    audio.currentTime = 0;
    audio.play().catch(() => {});
    fin.current?.();
  }, [seg, corre, modo]);

  const agotado = modo === 'descanso' && seg <= 0;
  const reset = () => {
    setCorre(false); setAviso(false); setPreparando(false); setCountdown(0);
    setSeg(modo === 'descanso' ? inicio : 0);
  };

  return (
    <div className={'border bg-[var(--surface)] p-4 ' + (corre ? 'border-[var(--ink)]' : 'border-[var(--border)]')}>
      <div className="flex items-center justify-between gap-2">
        <span className="label-caps">{corre ? '● ' : ''}{modo === 'descanso' ? 'Descanso' : 'Cronómetro'}</span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-4">
        {preparando ? (
          <span className="metric tabular text-5xl text-[var(--ink)] animate-pulse">{countdown === 0 ? 'GO!' : countdown}</span>
        ) : (
          <>
            <span className={'metric tabular text-5xl ' + (corre ? 'text-[var(--ink)]' : agotado ? 'text-[var(--muted)]' : '')}>{fmt(Math.max(0, seg))}</span>
            {objetivo ? <span className="label-caps text-[var(--muted)]">/ {fmt(objetivo)}</span> : null}
          </>
        )}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => { setAviso(false); if (modo === 'crono' && seg === 0) { setPreparando(true); setCountdown(3); } else { setCorre(true); } }} disabled={corre || agotado}>
            {preparando ? 'Preparando…' : 'Aplicar'}
          </Button>
          <Button variant="ghost" size="sm" onClick={reset}>Reiniciar</Button>
          {onUsar && modo === 'crono' && (
            <Button variant="accent" size="sm" disabled={usarDisabled} onClick={() => onUsar(seg)}>Usar tiempo</Button>
          )}
        </div>
      </div>
      <span className="sr-only" role="status">{aviso ? 'descanso terminado' : ''}</span>
    </div>
  );
}
