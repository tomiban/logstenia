import { describe, it, expect } from 'vitest';
import { BLOCK_TYPE_LABEL, restLabel } from './labels';

describe('restLabel', () => {
  it('reads short rests in seconds', () => {
    expect(restLabel(45)).toBe('45 s');
    expect(restLabel(30)).toBe('30 s');
  });
  it('reads a whole minute or more in minutes', () => {
    expect(restLabel(60)).toBe('1 min');
    expect(restLabel(120)).toBe('2 min');
    expect(restLabel(180)).toBe('3 min');
  });
  it('keeps the seconds of a rest that is not a whole minute', () => {
    expect(restLabel(90)).toBe('1 min 30 s');
    expect(restLabel(75)).toBe('1 min 15 s');
    expect(restLabel(150)).toBe('2 min 30 s');
  });
  it('never prints a negative or empty rest', () => {
    expect(restLabel(0)).toBe('0 s');
    expect(restLabel(Number.NaN)).toBe('0 s');
  });
});

describe('BLOCK_TYPE_LABEL', () => {
  it('names every block type in Spanish', () => {
    expect(BLOCK_TYPE_LABEL.single).toBe('Simple');
    expect(BLOCK_TYPE_LABEL.biseries).toBe('Biserie');
    expect(BLOCK_TYPE_LABEL.superseries).toBe('Superserie');
  });
});
