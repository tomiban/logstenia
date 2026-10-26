import type { Exercise } from '@/types';

/**
 * The rule the runner and the tag mirror share: an exercise counted by time instead of reps.
 * Either the plan says it out loud (`tags`) or it carries only `timeSec`, with no `reps` to
 * complete.
 */
export function isTimedExercise(exercise: Exercise): boolean {
  return (
    (!!exercise.timeSec && !exercise.reps) ||
    (Array.isArray(exercise.tags) && exercise.tags.includes('isometricos'))
  );
}
