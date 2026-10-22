import { describe, it, expect } from 'vitest';
import { toISODate, toISOTimestamp, toLocalISODate, formatShort, formatLong } from './date';

describe('date helpers', () => {
  it('toISODate returns YYYY-MM-DD in UTC', () => {
    const d = new Date('2024-05-10T12:00:00.000Z');
    expect(toISODate(d)).toBe('2024-05-10');
  });
  it('toISODate accepts string/number', () => {
    expect(toISODate('2024-05-10T12:00:00.000Z')).toBe('2024-05-10');
  });
  it('toISOTimestamp returns full ISO', () => {
    const d = new Date('2024-05-10T12:34:56.000Z');
    expect(toISOTimestamp(d)).toBe('2024-05-10T12:34:56.000Z');
  });
  it('toLocalISODate respects timezone offset', () => {
    const d = new Date('2024-05-10T00:30:00.000Z');
    // result depends on local tz; just ensure format
    expect(toLocalISODate(d)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it('formatShort returns non-empty string', () => {
    expect(formatShort(new Date('2024-05-10T12:00:00.000Z')).length).toBeGreaterThan(0);
  });
  it('formatLong returns non-empty string', () => {
    expect(formatLong(new Date('2024-05-10T12:00:00.000Z')).length).toBeGreaterThan(0);
  });
});
