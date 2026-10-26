import { describe, it, expect } from 'vitest';
import plansJson from './plans.json';
import type { Block, Exercise, Model, PlanData, Program } from '../types';

interface Pattern {
  id: PatternId;
  match: RegExp;
}

type PatternId = 'pull' | 'push' | 'core' | 'arms' | 'skill' | 'legs';

/**
 * Pattern classification, checked in order: the first match wins, so every
 * exercise name resolves to exactly one pattern. Core sits before skill
 * because "Plank a planche" is a hold progression, and arms before skill
 * because "Reverse planche hold (tríceps)" names its target muscle.
 * `\bpino` keeps "supino"/"supina" (bench and inverted variants) out of push.
 */
const PATTERNS: Pattern[] = [
  { id: 'pull', match: /dominada|pull up|pullups|australian|remo|invertida/i },
  { id: 'push', match: /fondo|\bpica|\bpino|flexion/i },
  { id: 'core', match: /leg raise|knee raise|l sit|plank|hollow|lanza|plancha|l a v/i },
  { id: 'arms', match: /curl|tr[ií]ceps|enterrador/i },
  { id: 'skill', match: /lean|reverse|planche|hefesto/i },
  { id: 'legs', match: /rana|sentadilla|peso muerto|zancada|bulgara|isquio|gluteo|gemelo|pierna/i },
];

const FORCE_PROGRAMS = ['fuerza-principiantes', 'fuerza-intermedios', 'fuerza-avanzados'];
const EXPLOSIVE = /explosiv/i;

const plans = plansJson as PlanData;

function classify(name: string): PatternId | undefined {
  return PATTERNS.find((pattern) => pattern.match.test(name))?.id;
}

function forceProgram(id: string): Program {
  const program = plans.categories.find((c) => c.id === 'fuerza')?.programs.find((p) => p.id === id);
  if (!program) throw new Error(`missing fuerza program: ${id}`);
  return program;
}

const programs = FORCE_PROGRAMS.map(forceProgram);
const routines = programs.flatMap((program) =>
  program.models.filter((model) => !model.benchmark).map((model) => ({ program, model })),
);

function exercisesOf(model: Model): Exercise[] {
  return model.blocks.flatMap((block) => block.exercises);
}

function patternsOf(blocks: Block[]): Set<PatternId> {
  const patterns = new Set<PatternId>();
  for (const block of blocks) {
    for (const exercise of block.exercises) {
      const pattern = classify(exercise.name);
      if (pattern) patterns.add(pattern);
    }
  }
  return patterns;
}

describe('fuerza routine balance', () => {
  it('covers every fuerza exercise with exactly one pattern', () => {
    const names = [...new Set(routines.flatMap(({ model }) => exercisesOf(model).map((e) => e.name)))];
    expect(names.filter((name) => classify(name) === undefined)).toEqual([]);
  });

  it('keeps pull and push work in every routine (S3)', () => {
    const violations: string[] = [];
    for (const { program, model } of routines) {
      const patterns = patternsOf(model.blocks);
      const missing = (['pull', 'push'] as const).filter((pattern) => !patterns.has(pattern));
      if (missing.length > 0) violations.push(`${program.id}/${model.id}: missing ${missing.join(' + ')}`);
    }
    expect(violations).toEqual([]);
  });

  it('keeps pull and push within three exercises per routine (S4)', () => {
    const violations: string[] = [];
    for (const { program, model } of routines) {
      const exercisesPerPattern = new Map<PatternId, number>();
      for (const exercise of exercisesOf(model)) {
        const pattern = classify(exercise.name);
        if (!pattern) continue;
        exercisesPerPattern.set(pattern, (exercisesPerPattern.get(pattern) ?? 0) + 1);
      }
      for (const [pattern, count] of exercisesPerPattern) {
        if ((pattern === 'pull' || pattern === 'push') && count > 3) {
          violations.push(`${program.id}/${model.id}: ${pattern} in ${count} exercises`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it('keeps core work in every routine (S5)', () => {
    const violations: string[] = [];
    for (const { program, model } of routines) {
      if (!patternsOf(model.blocks).has('core')) violations.push(`${program.id}/${model.id}: missing core`);
    }
    expect(violations).toEqual([]);
  });

  it('uses an explosive exercise in at most two models per program (S6)', () => {
    const violations: string[] = [];
    for (const program of programs) {
      const modelsPerExercise = new Map<string, Set<string>>();
      for (const model of program.models.filter((candidate) => !candidate.benchmark)) {
        for (const name of new Set(exercisesOf(model).map((e) => e.name))) {
          if (!EXPLOSIVE.test(name)) continue;
          const models = modelsPerExercise.get(name) ?? new Set<string>();
          models.add(model.id);
          modelsPerExercise.set(name, models);
        }
      }
      for (const [name, models] of modelsPerExercise) {
        if (models.size > 2) violations.push(`${program.id}: ${name} in ${models.size} models`);
      }
    }
    expect(violations).toEqual([]);
  });
});
