import { describe, it, expect } from 'vitest';
import { getCategories, getProgram, getModel, allPrograms } from './plans';

describe('plans', () => {
  it('has categories', () => {
    const cats = getCategories();
    expect(cats.length).toBeGreaterThan(0);
    expect(cats.find(c => c.id === 'cardio')).toBeDefined();
    expect(cats.find(c => c.id === 'movilidad')).toBeDefined();
  });

  it('resolves program and model by id', () => {
    const p = getProgram('cardio-casa');
    expect(p).toBeDefined();
    const m = getModel('cardio-r1');
    expect(m?.model.name).toBe('Rutina 1');
    expect(m?.program.id).toBe('cardio-casa');
  });

  it('collects programs with goals', () => {
    const goals = allPrograms().flatMap(p => p.goals);
    expect(goals.length).toBeGreaterThan(0);
  });
});
