import { describe, it, expect } from 'vitest';
import { pluralForm } from './format';

describe('pluralForm', () => {
  it('keeps the singular for exactly one', () => {
    expect(pluralForm(1, 'programa', 'programas')).toBe('programa');
    expect(pluralForm(1, 'día', 'días')).toBe('día');
  });
  it('uses the plural for zero and for more than one', () => {
    expect(pluralForm(0, 'programa', 'programas')).toBe('programas');
    expect(pluralForm(2, 'programa', 'programas')).toBe('programas');
    expect(pluralForm(9, 'rutina', 'rutinas')).toBe('rutinas');
  });
});
