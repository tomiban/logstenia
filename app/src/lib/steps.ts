export type Step =
  | { kind: 'work'; exercise: { name: string; timeSec?: number; reps?: string }; blockIdx: number; setIdx: number; exIdx: number }
  | { kind: 'rest'; seconds: number; label: string };

export function buildSteps(model: any): Step[] {
  const steps: Step[] = [];
  model.blocks.forEach((block: any, bi: number) => {
    for (let s = 0; s < block.sets; s++) {
      block.exercises.forEach((ex: any, ei: number) => {
        steps.push({ kind: 'work', exercise: ex, blockIdx: bi, setIdx: s, exIdx: ei });
        if (ei < block.exercises.length - 1 && block.restBetweenExercisesSec > 0) {
          steps.push({ kind: 'rest', seconds: block.restBetweenExercisesSec, label: 'Descanso' });
        }
      });
      if (s < block.sets - 1 && block.restBetweenSetsSec > 0) {
        steps.push({ kind: 'rest', seconds: block.restBetweenSetsSec, label: 'Descanso entre series' });
      }
    }
  });
  return steps;
}
