import { useCallback } from 'react';

/** Returns a function that plays a short 880Hz beep (best-effort). */
export function useBeep(): () => void {
  return useCallback(() => {
    try {
      const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) return;
      const c = new Ctx();
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.connect(gain);
      gain.connect(c.destination);
      osc.frequency.value = 880;
      gain.gain.value = 0.15;
      osc.start();
      osc.stop(c.currentTime + 0.12);
    } catch {
      // ignore
    }
  }, []);
}
