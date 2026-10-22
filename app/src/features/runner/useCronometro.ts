import { useEffect, useRef, useState } from 'react';

export type Modo = 'crono' | 'descanso';

export interface CronometroProps {
  modo?: Modo;
  inicio?: number;
  objetivo?: number;
  onFin?: () => void;
  onUsar?: (segundos: number) => void;
  auto?: boolean;
  usarDisabled?: boolean;
}

export const fmt = (s: number): string =>
  `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

let audio: HTMLAudioElement | null = null;

export function desbloquearAudio(): void {
  audio = audio || new Audio('/sounds/item-found.mp3');
  audio.volume = 0;
  audio.play().catch(() => {});
  audio.pause();
  audio.volume = 1;
}

export function useCronometro(props: CronometroProps) {
  const modo: Modo = props.modo ?? 'crono';
  const inicio = props.inicio ?? 60;
  const objetivo = props.objetivo;
  const onFin = props.onFin;
  const onUsar = props.onUsar;
  const auto = props.auto ?? false;
  const usarDisabled = props.usarDisabled ?? false;

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

  const aplicar = () => {
    setAviso(false);
    if (modo === 'crono' && seg === 0) {
      setPreparando(true);
      setCountdown(3);
    } else {
      setCorre(true);
    }
  };

  const usar = () => {
    if (onUsar) onUsar(seg);
  };

  return {
    seg,
    corre,
    aviso,
    preparando,
    countdown,
    agotado,
    reset,
    aplicar,
    usar,
    usarDisabled,
    objetivo,
    modo,
  };
}