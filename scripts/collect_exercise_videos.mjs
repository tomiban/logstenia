#!/usr/bin/env node
/**
 * Collects one video URL per exercise from YouTube with Playwright.
 *
 * Exercises are visited in PDF order (see PDF_ORDER below): every program of the
 * plans.json is mapped to the PDF it was curated from, models/blocks/exercises are
 * walked in document order and only the first appearance of each exercise name is
 * searched.
 *
 * The raw result is written to scripts/output/exercise-videos.json
 * (exercise name -> video). Use scripts/apply_exercise_videos.py to merge it into
 * app/src/data/plans.json.
 *
 * Usage:
 *   node scripts/collect_exercise_videos.mjs [options]
 *
 *   --limit <n>      stop after n new entries (default: all pending)
 *   --only <text>    only exercises whose name contains <text>
 *   --out <path>     output file (default: scripts/output/exercise-videos.json)
 *   --delay <ms>     base delay between searches (default: 900)
 *   --min-score <n>  accept threshold (default: 35)
 *   --refresh        re-search entries already present in the cache
 *   --list           print the PDF-ordered list of exercises and exit
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PLANS = path.join(ROOT, 'app', 'src', 'data', 'plans.json');
const DEFAULT_OUT = path.join(ROOT, 'scripts', 'output', 'exercise-videos.json');

/** PDF order: the order the user asked for ("ve por orde de pdf"). */
const PDF_ORDER = [
  { pdf: 'cardio.pdf', programs: ['cardio-casa'] },
  { pdf: 'Front_Lever-Avanzados-PROGRESS©.pdf', programs: ['front-full'] },
  { pdf: 'pdf-calentamiento-movilidad-v1-progress_compress.pdf', programs: ['movilidad-general'] },
  {
    pdf: 'pdf-div-class-2qs3tf-truncatedtext-module-wrapper-fg1km9p-classtruncatedtext-module-lineclamped-85ulhh-style-max-lines5handstand-workout-movility-v2-progress-p-div_compress.pdf',
    programs: ['handstand-principiante', 'handstand-intermedio', 'handstand-avanzado'],
  },
  { pdf: 'pdf-entrenamiento-de-hefesto-para-principiantes_compress.pdf', programs: ['hefesto-principiantes'] },
  { pdf: 'pdf-programa-avanzado-back-lever-hefesto_compress.pdf', programs: ['backlever-hefesto'] },
  { pdf: 'pdf-rutina-de-front-lever-en-calistenia_compress.pdf', programs: ['front-semi'] },
  {
    pdf: 'pdf-rutinas-de-entrenamiento-para-planche.pdf',
    programs: ['planche-tuck', 'planche-tuckadv', 'planche-straddle', 'planche-full'],
    models: { 'planche-tuck': ['pl-r1', 'pl-r2', 'pl-r3', 'pl-r4', 'pl-r5', 'pl-pro1'] },
  },
  {
    pdf: 'pdf-rutinas-de-fuerza-para-principiantes_compress.pdf',
    programs: ['fuerza-principiantes', 'fuerza-intermedios', 'fuerza-avanzados'],
  },
  {
    pdf: 'pdf-rutinas-de-resistencia-planche_compress.pdf',
    programs: ['planche-tuck'],
    models: { 'planche-tuck': ['res-n1-pr1', 'res-n1-pr2', 'res-n1-pr3'] },
  },
];

const STOPWORDS = new Set([
  'de', 'del', 'la', 'el', 'los', 'las', 'un', 'una', 'unos', 'unas', 'y', 'o', 'u',
  'en', 'con', 'sin', 'por', 'para', 'a', 'al', 'cada', 'x', 'lo', 'le', 'su', 'sus',
  'sobre', 'hacia', 'entre', 'mas', 'mas', 'y', 'a', 'al', 'se', 'es', 'the', 'and',
]);

const FITNESS_RE = /calistenia|calisthenics|fitness|entrenamiento|entren|movilidad|skills|workout|gym|street|musculacion/i;
/** Compilaciones y rutinas: nunca son el video de un ejercicio puntual. */
const REJECT_RE = /\bw\s*\/|worship|\bworkout\b|\brutina\b|\bsesion\b|plan de|follow along|full body|repeticiones|\bintense\b|\bsemana\b|\bdesafio\b|\breto\b|playlist/i;
/** "12 min de ..." indica una compilacion, no una demo del ejercicio. */
const COMPILATION_RE = /(^|\s)\d+\s*(min|minutos?|hours?|horas?)\s+de/i;

const norm = (s) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const tokens = (s) =>
  norm(s)
    .split(' ')
    .filter((t) => t && !STOPWORDS.has(t) && !/^\d+$/.test(t));

/** Searchable form of an exercise name: drop parenthetical qualifiers. */
const searchName = (name) => name.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();

function parseDuration(text) {
  if (!text) return 0;
  const parts = String(text).split(':').map((n) => parseInt(n, 10));
  if (parts.some((n) => Number.isNaN(n))) return 0;
  return parts.reduce((acc, n) => acc * 60 + n, 0);
}

function parseViews(text) {
  if (!text) return 0;
  const m = String(text).replace(/\./g, '').match(/([\d\s]+)\s*(mil|k|m)?/i);
  if (!m) return 0;
  let n = parseInt(m[1].replace(/\s/g, ''), 10) || 0;
  const unit = (m[2] || '').toLowerCase();
  if (unit === 'mil' || unit === 'k') n *= 1000;
  else if (unit === 'm') n *= 1000000;
  return n;
}

/** Tokens de la consulta, en orden y sin repetir. */
const queryTokens = (exerciseName) => [...new Set(tokens(exerciseName))];

/** ¿Aparecen los tokens de la consulta como secuencia contigua en el titulo? */
function hasPhrase(titleTokens, qTokens) {
  if (qTokens.length === 0) return false;
  for (let i = 0; i + qTokens.length <= titleTokens.length; i++) {
    let ok = true;
    for (let j = 0; j < qTokens.length; j++) {
      if (titleTokens[i + j] !== qTokens[j]) {
        ok = false;
        break;
      }
    }
    if (ok) return true;
  }
  return false;
}

/**
 * Ranks a search result against the exercise name.
 * Returns null when the result cannot represent this exercise.
 */
function scoreResult(result, exerciseName, usedIds = new Map()) {
  const qTokens = queryTokens(exerciseName);
  if (qTokens.length === 0) return null;

  const titleTokens = tokens(result.title);
  const titleNorm = norm(result.title);
  const channelNorm = norm(result.channel);
  const tSet = new Set(titleTokens);

  if (REJECT_RE.test(titleNorm)) return null;

  const matched = qTokens.filter((t) => tSet.has(t));
  const coverage = matched.length / qTokens.length;
  const phrase = hasPhrase(titleTokens, qTokens);
  if (coverage < 0.4 && !phrase) return null;

  let score = coverage * 55;
  if (phrase) score += 25;
  else if (matched.length >= 2) score += 5;

  if (FITNESS_RE.test(`${titleNorm} ${channelNorm}`)) score += 10;
  if (COMPILATION_RE.test(titleNorm)) score -= 30;

  const views = parseViews(result.views);
  score += Math.min(5, Math.log10(views + 1));

  const dur = parseDuration(result.length);
  if (dur >= 8 && dur <= 300) score += 10;
  else if (dur > 300 && dur <= 900) score += 4;
  else if (dur > 900) score -= 12;
  else if (dur > 0 && dur < 5) score -= 12;

  if (result.isShort) score -= 15;
  if (result.isLive) score -= 20;

  // Un mismo video para dos ejercicios distintos no sirve como thumbnail de ambos.
  if (usedIds.has(result.id)) score -= 15;

  return score;
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  fs.renameSync(tmp, file);
}

/** Exercises in PDF order, first appearance wins. */
function collectOrderedExercises(plans) {
  const programs = new Map();
  for (const c of plans.categories) for (const p of c.programs) programs.set(p.id, p);

  const seen = new Set();
  const ordered = [];

  for (const entry of PDF_ORDER) {
    for (const programId of entry.programs) {
      const program = programs.get(programId);
      if (!program) {
        console.warn(`[warn] program not found: ${programId}`);
        continue;
      }
      const modelFilter = entry.models?.[programId];
      const models = modelFilter
        ? program.models.filter((m) => modelFilter.includes(m.id))
        : program.models;
      for (const model of models) {
        for (const block of model.blocks) {
          for (const ex of block.exercises) {
            if (seen.has(ex.name)) continue;
            seen.add(ex.name);
            ordered.push({ name: ex.name, pdf: entry.pdf, program: programId, model: model.id });
          }
        }
      }
    }
  }

  // Any program not mapped to a PDF (defensive: never silently drop an exercise).
  for (const c of plans.categories) {
    for (const p of c.programs) {
      if (PDF_ORDER.some((e) => e.programs.includes(p.id))) continue;
      for (const m of p.models) {
        for (const b of m.blocks) {
          for (const ex of b.exercises) {
            if (seen.has(ex.name)) continue;
            seen.add(ex.name);
            ordered.push({ name: ex.name, pdf: null, program: p.id, model: m.id });
          }
        }
      }
    }
  }

  return ordered;
}

async function extractResults(page) {
  return page.evaluate(() => {
    const data = window.ytInitialData;
    if (!data) return [];
    const out = [];
    const walk = (node) => {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)) {
        node.forEach(walk);
        return;
      }
      const v = node.videoRenderer;
      if (v && v.videoId) {
        out.push({
          id: v.videoId,
          title: v.title?.runs?.map((r) => r.text).join('') || '',
          channel: v.ownerText?.runs?.map((r) => r.text).join('') || '',
          views: v.viewCountText?.simpleText || '',
          length: v.lengthText?.simpleText || '',
          isShort: Boolean(v.navigationEndpoint?.commandMetadata?.webCommandMetadata?.url?.includes('/shorts/')),
          isLive: Boolean(v.badges?.some?.((b) => JSON.stringify(b).includes('LIVE_NOW'))),
        });
      }
      Object.values(node).forEach(walk);
    };
    walk(data);
    return out;
  });
}

async function search(page, query) {
  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&sp=EgIQAQ%3D%3D&hl=es&gl=ES`;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForTimeout(600);
      const consent = page.locator('form[action*="consent"] button');
      if (await consent.count()) {
        await consent.first().click().catch(() => {});
        await page.waitForTimeout(1500);
      }
      const results = await extractResults(page);
      if (results.length) return results;
    } catch (err) {
      console.warn(`[warn] search failed (${attempt}/3): ${err.message}`);
    }
  }
  return [];
}

async function main() {
  const args = process.argv.slice(2);
  const opt = (flag, def) => {
    const i = args.indexOf(flag);
    return i >= 0 && args[i + 1] ? args[i + 1] : def;
  };
  const limit = Number(opt('--limit', '0')) || 0;
  const only = opt('--only', '');
  const outFile = path.resolve(ROOT, opt('--out', DEFAULT_OUT));
  const delay = Number(opt('--delay', '900')) || 900;
  const minScore = Number(opt('--min-score', '35')) || 35;
  const refresh = args.includes('--refresh');

  const plans = readJson(PLANS, null);
  if (!plans) {
    console.error(`cannot read ${PLANS}`);
    process.exit(1);
  }

  const ordered = collectOrderedExercises(plans);

  if (args.includes('--list')) {
    ordered.forEach((e, i) => console.log(`${String(i + 1).padStart(3)}  ${e.pdf ?? '(sin pdf)'}  ${e.name}`));
    return;
  }

  const cache = readJson(outFile, {});
  const pending = ordered.filter(
    (e) =>
      (refresh || !(e.name in cache)) &&
      (!only || e.name.toLowerCase().includes(only.toLowerCase()))
  );

  console.log(
    `exercises: ${ordered.length} unique | cached: ${Object.keys(cache).length} | pending: ${pending.length} | min-score: ${minScore}`
  );
  if (!pending.length) {
    console.log('nothing to do');
    return;
  }

  const require = createRequire(path.join(ROOT, 'app', 'package.json'));
  const { chromium } = require('playwright');

  const browser = await chromium.launch();
  const context = await browser.newContext({
    locale: 'es-ES',
    userAgent:
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  let done = 0;
  let hits = 0;
  // Ids ya usados por otro ejercicio (cache +collected) para no repetir thumbnail.
  const usedIds = new Map();
  for (const [name, record] of Object.entries(cache)) {
    if (record && record.id) usedIds.set(record.id, name);
  }

  for (const exercise of pending) {
    if (limit && done >= limit) break;
    done += 1;

    const queries = [
      `${searchName(exercise.name)} calistenia`,
      searchName(exercise.name),
      `${tokens(exercise.name).slice(0, 4).join(' ')} calistenia`,
    ];

    let best = null;
    for (const query of queries) {
      const results = await search(page, query);
      if (!results.length) continue;
      const ranked = results
        .map((r) => ({ ...r, score: scoreResult(r, exercise.name, usedIds) }))
        .filter((r) => r.score !== null)
        .sort((a, b) => b.score - a.score);
      if (ranked.length && (!best || ranked[0].score > best.score)) best = { ...ranked[0], query };
      if (best && best.score >= minScore) break;
    }

    if (best && best.score >= minScore) {
      hits += 1;
      usedIds.set(best.id, exercise.name);
      cache[exercise.name] = {
        id: best.id,
        title: best.title,
        channel: best.channel,
        url: `https://www.youtube.com/watch?v=${best.id}`,
        thumbnail: `https://i.ytimg.com/vi/${best.id}/hqdefault.jpg`,
        query: best.query,
        score: Math.round(best.score * 10) / 10,
        source: 'youtube-search',
        pdf: exercise.pdf,
        program: exercise.program,
        model: exercise.model,
      };
      console.log(`[${done}/${pending.length}] ${exercise.name} -> ${best.id} (${best.score}) ${best.title}`);
    } else {
      cache[exercise.name] = {
        id: null,
        title: null,
        channel: null,
        url: null,
        thumbnail: null,
        query: best?.query ?? null,
        score: best ? Math.round(best.score * 10) / 10 : null,
        source: 'youtube-search',
        status: 'no-match',
        pdf: exercise.pdf,
        program: exercise.program,
        model: exercise.model,
      };
      console.log(`[${done}/${pending.length}] ${exercise.name} -> NO MATCH (best ${best?.score ?? 'n/a'})`);
    }

    if (done % 5 === 0 || done === pending.length) writeJson(outFile, cache);
    await page.waitForTimeout(delay + Math.floor(Math.random() * 400));
  }

  writeJson(outFile, cache);
  await browser.close();
  console.log(`done: ${done} processed, ${hits} matched -> ${path.relative(ROOT, outFile)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
