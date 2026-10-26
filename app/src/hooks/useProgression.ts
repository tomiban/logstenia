import { useEffect, useState } from 'react';
import { loadProgression, reportFrom, type ProgressionData, type ProgressionReport } from '@/features/plans/progression';

export interface ProgressionHook {
  data: ProgressionData | null;
  error: boolean;
  reportFor: (programId: string) => ProgressionReport | null;
  reload: () => void;
}

/** Loads the marks behind every level once, then answers level reports in memory. */
export function useProgression(): ProgressionHook {
  const [data, setData] = useState<ProgressionData | null>(null);
  const [error, setError] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let alive = true;
    loadProgression()
      .then((next) => { if (alive) { setError(false); setData(next); } })
      .catch(() => { if (alive) setError(true); });
    return () => { alive = false; };
  }, [version]);

  const reportFor = (programId: string) => (data ? reportFrom(programId, data) : null);
  return { data, error, reportFor, reload: () => setVersion((v) => v + 1) };
}
