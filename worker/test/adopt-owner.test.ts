import { describe, expect, it } from 'vitest';
import {
  buildCountCommand,
  buildUpdateCommand,
  checkOwners,
  normalizeOwner,
  parseCountRows,
} from '../scripts/adopt-owner.mjs';

describe('normalizeOwner', () => {
  // SQLite's lower() is ASCII-only, so the hand-written UPDATE this script replaces turned
  // `Ñoña@Ejemplo.com` into `Ñoña@ejemplo.com` while the Worker derives `ñoña@ejemplo.com`.
  it('lowercases accented uppercase with JavaScript rules, like the Worker', () => {
    expect(normalizeOwner('  Ñoña@Ejemplo.com ')).toBe('ñoña@ejemplo.com');
  });
});

describe('buildUpdateCommand', () => {
  it('adopts the legacy rows to the normalized owner', () => {
    expect(buildUpdateCommand('Ñoña@Ejemplo.com')).toBe(
      "UPDATE rows SET owner = 'ñoña@ejemplo.com' WHERE owner = 'legacy@local'",
    );
  });

  it('escapes single quotes so the statement stays valid', () => {
    expect(buildUpdateCommand("o'brien@example.com")).toBe(
      "UPDATE rows SET owner = 'o''brien@example.com' WHERE owner = 'legacy@local'",
    );
  });
});

describe('buildCountCommand', () => {
  it('asks for one count per owner', () => {
    expect(buildCountCommand()).toBe('SELECT owner, COUNT(*) AS total FROM rows GROUP BY owner');
  });
});

describe('parseCountRows', () => {
  // `wrangler d1 execute --json` prints one envelope per statement with a `results` array.
  it('reads the rows out of the wrangler envelope', () => {
    const output = JSON.stringify([
      {
        results: [
          { owner: 'duena@ejemplo.com', total: 12 },
          { owner: 'legacy@local', total: 3 },
        ],
        success: true,
        meta: { duration: 1 },
      },
    ]);

    expect(parseCountRows(output)).toEqual([
      { owner: 'duena@ejemplo.com', total: 12 },
      { owner: 'legacy@local', total: 3 },
    ]);
  });
});

describe('checkOwners', () => {
  it('reports a row still parked under the legacy marker', () => {
    const problems = checkOwners([
      { owner: 'duena@ejemplo.com', total: 12 },
      { owner: 'legacy@local', total: 3 },
    ]);

    expect(problems).toHaveLength(1);
    expect(problems[0]?.owner).toBe('legacy@local');
    expect(problems[0]?.problem).toContain('legacy@local');
  });

  it('accepts a clean owner list', () => {
    expect(
      checkOwners([
        { owner: 'duena@ejemplo.com', total: 12 },
        { owner: 'dev@local', total: 1 },
      ]),
    ).toEqual([]);
  });

  it('reports an owner that is not normalized, which the Worker could never derive', () => {
    const problems = checkOwners([{ owner: 'Ñoña@ejemplo.com', total: 4 }]);

    expect(problems).toHaveLength(1);
    expect(problems[0]?.owner).toBe('Ñoña@ejemplo.com');
    expect(problems[0]?.fix).toBe(
      "UPDATE rows SET owner = 'ñoña@ejemplo.com' WHERE owner = 'Ñoña@ejemplo.com'",
    );
  });
});
