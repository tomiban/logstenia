import { describe, expect, it } from 'vitest';
import { collectProblems } from '../scripts/preflight.mjs';

const VALID_DATABASE_ID = '8f2c1a44-6b7d-4f0e-9c31-2d5a7b8e4f61';
const VALID_AUD = 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90';

function config(overrides: { databaseId?: string; team?: string; aud?: string; vars?: boolean } = {}) {
  const databaseId = overrides.databaseId ?? VALID_DATABASE_ID;
  const vars = overrides.vars ?? true;
  const team = overrides.team ?? 'logstenia';
  const aud = overrides.aud ?? VALID_AUD;

  const varsBlock = vars ? `\n[vars]\nCF_ACCESS_TEAM = "${team}"\nCF_ACCESS_AUD = "${aud}"\n` : '';
  return [
    'name = "logstenia-sync"',
    'main = "src/index.ts"',
    'compatibility_date = "2026-10-23"',
    '',
    '[assets]',
    'directory = "../app/dist"',
    'not_found_handling = "single-page-application"',
    'run_worker_first = ["/api/*"]',
    '',
    '[[d1_databases]]',
    'binding = "DB"',
    'database_name = "logstenia-sync"',
    `database_id = "${databaseId}"`,
    varsBlock,
  ].join('\n');
}

describe('collectProblems', () => {
  it('reports nothing for a filled configuration', () => {
    expect(collectProblems(config())).toEqual([]);
  });

  it('reports the three shipped placeholders of the current wrangler.toml', () => {
    const problems = collectProblems(
      config({
        databaseId: '00000000-0000-0000-0000-000000000000',
        team: 'your-team',
        aud: 'your-access-application-aud',
      }),
    );

    expect(problems.map((problem) => problem.field)).toEqual([
      'database_id',
      'CF_ACCESS_TEAM',
      'CF_ACCESS_AUD',
    ]);
    for (const problem of problems) expect(problem.fix).not.toBe('');
  });

  it('reports a database_id that is absent from the d1 binding', () => {
    const problems = collectProblems(config({ databaseId: '' }));

    expect(problems.map((problem) => problem.field)).toEqual(['database_id']);
  });

  it('rejects a team written as the full cloudflareaccess.com domain', () => {
    const problems = collectProblems(config({ team: 'logstenia.cloudflareaccess.com' }));

    expect(problems.map((problem) => problem.field)).toEqual(['CF_ACCESS_TEAM']);
    expect(problems[0]?.problem).toContain('cloudflareaccess.com');
  });

  it('reports both Access vars when the vars section is missing', () => {
    const problems = collectProblems(config({ vars: false }));

    expect(problems.map((problem) => problem.field)).toEqual(['CF_ACCESS_TEAM', 'CF_ACCESS_AUD']);
  });

  it('rejects an AUD tag too short to be a real audience', () => {
    const problems = collectProblems(config({ aud: 'abc123' }));

    expect(problems.map((problem) => problem.field)).toEqual(['CF_ACCESS_AUD']);
  });

  it('ignores commented-out values', () => {
    const text = config().replace(
      'database_id = "' + VALID_DATABASE_ID + '"',
      '# database_id = "' + VALID_DATABASE_ID + '"',
    );

    expect(collectProblems(text).map((problem) => problem.field)).toEqual(['database_id']);
  });
});
