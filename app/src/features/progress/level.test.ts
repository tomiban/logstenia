import { describe, expect, it } from 'vitest';
import { LEVELS, LEVEL_LABEL, levelForSave, tagsForSave } from './level';

describe('levelForSave', () => {
  it('keeps an explicit level when the tags carry no level label', () => {
    expect(levelForSave('intermediate')).toBe('intermediate');
  });

  it('keeps every documented level as chosen in the form', () => {
    expect(LEVELS.map((level) => levelForSave(level))).toEqual(['beginner', 'intermediate', 'advanced']);
  });

  it('falls back to beginner for a value that is not a documented level', () => {
    expect(levelForSave('')).toBe('beginner');
    expect(levelForSave('experto')).toBe('beginner');
  });
});

describe('tagsForSave', () => {
  it('mirrors the level label into the tag list', () => {
    expect(tagsForSave(['en casa'], 'advanced')).toEqual(['avanzado', 'en casa']);
  });

  it('keeps a level label the tags already had without duplicating it', () => {
    expect(tagsForSave(['principiante', 'en casa'], 'beginner')).toEqual(['principiante', 'en casa']);
  });

  it('never lets a tag label override the explicit level', () => {
    expect(tagsForSave(['avanzado'], 'beginner')).toEqual(['principiante']);
    expect(tagsForSave([], 'intermediate')).toEqual(['intermedio']);
  });

  it('drops repeated tags while mirroring the level label', () => {
    expect(tagsForSave(['en casa', 'en casa'], 'beginner')).toEqual(['principiante', 'en casa']);
  });

  it('uses the documented Spanish label for every level', () => {
    expect(LEVELS.map((level) => tagsForSave([], level)[0])).toEqual(Object.values(LEVEL_LABEL));
  });
});
