/**
 * Deploy gate for the sync Worker (`docs/DEPLOY.md`).
 *
 * `wrangler deploy` publishes happily while the D1 binding points at a placeholder id, and
 * nothing in the Access vars says "sample": such a deploy goes green and then answers 401 to
 * every `/api/sync` call forever. This script runs first and refuses to deploy.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CONFIG_FLAG = '--config';
const CONFIG_FILE = fileURLToPath(new URL('../wrangler.toml', import.meta.url));

const PLACEHOLDER_DATABASE_ID = '00000000-0000-0000-0000-000000000000';
const PLACEHOLDER_TEAM = 'your-team';
const PLACEHOLDER_AUD = 'your-access-application-aud';
const MIN_AUD_LENGTH = 16;

export function collectProblems(configText) {
  const values = readValues(configText);
  return [
    ...databaseIdProblems(values.get('d1_databases.database_id') ?? ''),
    ...teamProblems(values.get('vars.CF_ACCESS_TEAM') ?? ''),
    ...audProblems(values.get('vars.CF_ACCESS_AUD') ?? ''),
  ];
}

function databaseIdProblems(databaseId) {
  if (databaseId === '') {
    return [
      {
        field: 'database_id',
        problem: 'missing from the [[d1_databases]] binding',
        fix: 'run `npx wrangler d1 create logstenia-sync` in worker/ and paste the printed database_id',
      },
    ];
  }
  if (databaseId === PLACEHOLDER_DATABASE_ID) {
    return [
      {
        field: 'database_id',
        problem: `still the placeholder ${PLACEHOLDER_DATABASE_ID}`,
        fix: 'run `npx wrangler d1 create logstenia-sync` in worker/ and paste the printed database_id',
      },
    ];
  }
  return [];
}

function teamProblems(team) {
  const fix = 'Zero Trust -> Settings -> Team domain; use the prefix only, without `.cloudflareaccess.com`';
  if (team === '') return [{ field: 'CF_ACCESS_TEAM', problem: 'missing from [vars]', fix }];
  if (team === PLACEHOLDER_TEAM) {
    return [{ field: 'CF_ACCESS_TEAM', problem: `still the placeholder "${PLACEHOLDER_TEAM}"`, fix }];
  }
  if (team.includes('cloudflareaccess.com') || team.includes('/')) {
    return [
      {
        field: 'CF_ACCESS_TEAM',
        problem: `"${team}" is a full domain; the Worker builds https://<team>.cloudflareaccess.com itself`,
        fix,
      },
    ];
  }
  return [];
}

function audProblems(aud) {
  const fix = 'Zero Trust -> Access -> Applications -> your app -> Overview -> Application Audience (AUD) Tag';
  if (aud === '') return [{ field: 'CF_ACCESS_AUD', problem: 'missing from [vars]', fix }];
  if (aud === PLACEHOLDER_AUD) {
    return [{ field: 'CF_ACCESS_AUD', problem: `still the placeholder "${PLACEHOLDER_AUD}"`, fix }];
  }
  if (aud.length < MIN_AUD_LENGTH) {
    return [{ field: 'CF_ACCESS_AUD', problem: `"${aud}" is too short to be an Access AUD tag`, fix }];
  }
  return [];
}

/** Flat `section.key -> value` view; enough for the subset of TOML this config uses. */
function readValues(configText) {
  const values = new Map();
  let section = '';

  for (const rawLine of configText.split(/\r?\n/)) {
    const line = withoutComment(rawLine).trim();
    if (line === '') continue;

    const header = /^\[\[?\s*([^\]]+?)\s*\]\]?$/.exec(line);
    if (header) {
      section = header[1];
      continue;
    }

    const pair = /^([A-Za-z0-9_.-]+)\s*=\s*(.+)$/.exec(line);
    if (pair) values.set(`${section}.${pair[1]}`, unquote(pair[2].trim()));
  }

  return values;
}

function withoutComment(line) {
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"' || char === "'") quoted = !quoted;
    else if (char === '#' && !quoted) return line.slice(0, index);
  }
  return line;
}

function unquote(value) {
  const quoted = /^"(.*)"$/.exec(value) ?? /^'(.*)'$/.exec(value);
  return quoted ? quoted[1] : value;
}

function run(argv) {
  const flagIndex = argv.indexOf(CONFIG_FLAG);
  const configPath =
    flagIndex !== -1 && argv[flagIndex + 1] ? path.resolve(argv[flagIndex + 1]) : CONFIG_FILE;

  let configText;
  try {
    configText = readFileSync(configPath, 'utf8');
  } catch {
    console.error(`preflight: cannot read ${configPath}`);
    return 1;
  }

  const problems = collectProblems(configText);
  if (problems.length === 0) {
    console.log(`preflight: ${configPath} is deployable`);
    return 0;
  }

  console.error(`preflight: refusing to deploy, ${configPath} still needs configuration`);
  for (const { field, problem, fix } of problems) {
    console.error(`  ${field}: ${problem}`);
    console.error(`    fix: ${fix}`);
  }
  return 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(run(process.argv.slice(2)));
}
