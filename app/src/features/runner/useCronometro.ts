import { useEffect, useRef, useState } from 'react';
import { useWakeLock } from '@/hooks/useWakeLock';
import { playBeep, playSound, unlockAudio, vibrate } from '@/lib/audio';

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
  const [sinSonido, setSinSonido] = useState(false);
  const finRef = useRef(onFin);
  finRef.current = onFin;
  useWakeLock(corre);

  useEffect(() => {
    if (!preparando) return;
    if (countdown <= 0) {
      setPreparando(false);
      setSinSonido(!playBeep(0.2, 0.3));
      vibrate([100]);
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
    // The interval captures the start value on purpose: it only restarts when
    // the clock starts or the mode changes, never on every tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [corre, modo]);

  useEffect(() => {
    if (!corre) setSeg(modo === 'descanso' ? inicio : 0);
    // Resets on a new objective or mode only: when the clock stops on its own the
    // achieved time must stay on screen, so `corre` is deliberately not a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inicio, modo]);

  useEffect(() => {
    if (modo !== 'crono' || !corre || !objetivo || seg < objetivo) return;
    setCorre(false);
    vibrate([180, 90, 180]);
    setSinSonido(!playBeep(0.3, 0.3));
  }, [seg, corre, modo, objetivo]);

  useEffect(() => {
    if (modo !== 'descanso' || !corre || seg > 0) return;
    setCorre(false);
    setAviso(true);
    vibrate([180, 90, 180]);
    void playSound().then((played) => setSinSonido(!played));
    finRef.current?.();
  }, [seg, corre, modo]);

  const agotado = modo === 'descanso' && seg <= 0;

  const reset = () => {
    setCorre(false);
    setAviso(false);
    setPreparando(false);
    setCountdown(0);
    setSeg(modo === 'descanso' ? inicio : 0);
  };

  const aplicar = () => {
    setAviso(false);
    if (modo === 'crono' && seg === 0) {
      setPreparando(true);
      setCountdown(3);
    } else {
      unlockAudio();
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
    sinSonido,
  };
}
