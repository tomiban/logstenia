/**
 * Adoption of the existing rows to their real owner (`docs/DEPLOY.md` §2, `multi-user.md` S6).
 *
 * Migration `0002_owner.sql` parks every existing row under the `legacy@local` marker, which
 * no Access identity can ever present. Adopting them by hand with `lower(trim('...'))` is a
 * data-safety defect: SQLite's `lower()` only folds ASCII, while the Worker normalizes with
 * JavaScript `trim().toLowerCase()`. Given `Ñoña@Ejemplo.com` the SQL leaves
 * `Ñoña@ejemplo.com` and the app derives `ñoña@ejemplo.com`: the adopted rows become
 * unreachable for their real owner while `COUNT(*)` still shows one healthy owner. This
 * script normalizes in JavaScript, runs the `UPDATE`, and verifies the result.
 */

import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DATABASE = 'logstenia-sync';
const LEGACY_OWNER = 'legacy@local';
const LOCAL_FLAG = '--local';
const REMOTE_FLAG = '--remote';
const USAGE = 'npm run adopt -- tu@email.com [--local]';

/**
 * Same rule as `normalizeEmail` in `src/access.ts`: one place, no variants. The Unicode form
 * is folded too, or an accented address arrives composed here and decomposed from the JWT
 * and the adopted rows become unreachable.
 */
export function normalizeOwner(raw) {
  return raw.trim().normalize('NFC').toLowerCase();
}

export function buildUpdateCommand(owner) {
  const normalized = normalizeOwner(owner);
  return `UPDATE rows SET owner = ${quote(normalized)} WHERE owner = ${quote(LEGACY_OWNER)}`;
}

export function buildCountCommand() {
  return 'SELECT owner, COUNT(*) AS total FROM rows GROUP BY owner';
}

/**
 * Problems that leave the deploy incomplete: rows still parked on the marker, and owners the
 * Worker could never derive because they are not normalized.
 */
export function checkOwners(rows) {
  const problems = [];

  for (const row of rows) {
    const owner = String(row?.owner ?? '');
    const total = Number(row?.total ?? 0);

    if (owner === LEGACY_OWNER) {
      problems.push({
        owner,
        total,
        problem: `${total} row(s) still owned by ${LEGACY_OWNER}`,
        fix: `run \`${USAGE}\` with the real email for the same database`,
      });
    } else if (owner !== normalizeOwner(owner)) {
      const normalized = normalizeOwner(owner);
      problems.push({
        owner,
        total,
        problem: `${total} row(s) under an owner the Worker can never derive (not normalized)`,
        fix: `UPDATE rows SET owner = ${quote(normalized)} WHERE owner = ${quote(owner)}`,
      });
    }
  }

  return problems;
}

function quote(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

/** The only place that talks to wrangler; tests use the pure pieces only. */
function executeD1(args) {
  return execFileSync('npx', ['wrangler', 'd1', 'execute', ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  });
}

export function parseCountRows(json) {
  const parsed = JSON.parse(json);
  const entries = Array.isArray(parsed) ? parsed : [parsed];
  const rows = [];

  for (const entry of entries) {
    if (entry && Array.isArray(entry.results)) {
      rows.push(...entry.results.filter((row) => row && typeof row === 'object'));
    }
  }

  return rows;
}

function run(argv, execute = executeD1) {
  const scope = argv.includes(LOCAL_FLAG) ? LOCAL_FLAG : REMOTE_FLAG;
  const email = argv.find((argument) => !argument.startsWith('-'));

  if (!email) {
    console.error(`adopt: missing email\n  usage: ${USAGE}`);
    return 1;
  }

  const owner = normalizeOwner(email);
  if (owner === '') {
    console.error(`adopt: the email normalizes to an empty owner\n  usage: ${USAGE}`);
    return 1;
  }
  if (owner === LEGACY_OWNER) {
    console.error(`adopt: ${LEGACY_OWNER} is the marker being replaced, not a real owner`);
    return 1;
  }

  console.log(`adopt: moving ${LEGACY_OWNER} rows to ${owner} on ${DATABASE} ${scope}`);

  try {
    const updateOutput = execute([
      DATABASE,
      scope,
      '--command',
      buildUpdateCommand(owner),
    ]);
    process.stdout.write(updateOutput);

    const rows = parseCountRows(
      execute([DATABASE, scope, '--command', buildCountCommand(), '--json']),
    );

    console.log('adopt: rows per owner');
    for (const row of rows) console.log(`  ${String(row.owner)}: ${String(row.total)}`);
    if (rows.length === 0) {
      console.error('adopt: the count query returned no rows, so nothing was verified');
      return 1;
    }

    const problems = checkOwners(rows);
    if (problems.length === 0) {
      console.log(`adopt: ${DATABASE} ${scope} has no unanswered owner`);
      return 0;
    }

    console.error('adopt: the adoption is not complete');
    for (const { owner: problemOwner, total, problem, fix } of problems) {
      console.error(`  ${problemOwner} (${total}): ${problem}`);
      console.error(`    fix: ${fix}`);
    }
    return 1;
  } catch (error) {
    console.error(`adopt: wrangler d1 execute failed: ${error.message}`);
    return 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(run(process.argv.slice(2)));
}
