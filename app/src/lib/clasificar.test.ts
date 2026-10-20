import { describe, it, expect } from 'vitest';
import { clasificar, enfasisDeEjercicios } from './clasificar';

describe('clasificar', () => {
  it('classifies planche as skill planche', () => {
    expect(clasificar('Tuck planche')).toEqual({ grupo: 'skill', sub: 'planche' });
  });
  it('classifies front lever as skill front lever', () => {
    expect(clasificar('Tuck front lever')).toEqual({ grupo: 'skill', sub: 'front lever' });
  });
  it('classifies pino as skill pino', () => {
    expect(clasificar('Isometrico pino en pared')).toEqual({ grupo: 'skill', sub: 'pino' });
  });
  it('classifies flexion as basico empuje', () => {
    expect(clasificar('Flexiones')).toEqual({ grupo: 'basico', sub: 'empuje' });
  });
  it('classifies dominada as basico tirón', () => {
    expect(clasificar('Dominadas pronas')).toEqual({ grupo: 'basico', sub: 'tirón' });
  });
  it('classifies sentadilla as basico pierna', () => {
    expect(clasificar('Sentadilla búlgara')).toEqual({ grupo: 'basico', sub: 'pierna' });
  });
  it('returns otros for unknown', () => {
    expect(clasificar('Respiración')).toEqual({ grupo: 'basico', sub: 'otros' });
  });
});

describe('enfasisDeEjercicios', () => {
  it('returns empuje when majority push', () => {
    expect(enfasisDeEjercicios(['Flexiones', 'Fondos', 'Flexiones'])).toBe('empuje');
  });
  it('returns mixto when no majority', () => {
    expect(enfasisDeEjercicios(['Flexiones', 'Dominadas', 'Sentadilla'])).toBe('mixto');
  });
  it('returns mixto for empty', () => {
    expect(enfasisDeEjercicios([])).toBe('mixto');
  });
});
