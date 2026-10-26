import { useEffect, useState } from 'react';
import { loadProgression, reportFrom, type ProgressionData, type ProgressionReport } from '@/features/plans/progression';

export interface ProgressionHook {
  data: ProgressionData | null;
  reportFor: (programId: string) => ProgressionReport | null;
  reload: () => void;
}

/** Loads the marks behind every level once, then answers level reports in memory. */
export function useProgression(): ProgressionHook {
  const [data, setData] = useState<ProgressionData | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let alive = true;
    loadProgression()
      .then((next) => { if (alive) setData(next); })
      .catch(() => {});
    return () => { alive = false; };
  }, [version]);

  const reportFor = (programId: string) => (data ? reportFrom(programId, data) : null);
  return { data, reportFor, reload: () => setVersion((v) => v + 1) };
}
