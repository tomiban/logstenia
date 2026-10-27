# Logstenia — Agent & Review Rules

## Project

Web PWA (React + Vite + TypeScript) for launching calisthenics routines from
Pro-gress plans, with an interactive timer, metrics and embedded videos.
Single user, no auth, local data (IndexedDB via Dexie). UI in Spanish.

- `app/` — application (React + Vite + TS).
- `app/src/data/plans.json` — curated plan data.
- `app/src/data/exercise-videos.json` — raw video data per exercise (source of `Exercise.video`).
- `odd/tasks/` — per-feature ODD specs and tracking (`logstenia.md` is the project one).
- `design-plans/` — design records for the larger features.

## Stack

- React 19, React Router 7, Vite 8, TypeScript ~6
- Tailwind CSS 4, oxlint, vitest
- Dexie (IndexedDB), vite-plugin-pwa, recharts

## Commands

```bash
cd app
npm install
npm run dev       # http://localhost:5173
npm run build     # tsc -b && vite build
npm run lint      # oxlint
npm test          # vitest run
npm run test:e2e  # playwright test (arranca el dev server solo)
```

No Python/scripts pipeline: the plan data is static JSON committed in the repo.

## Architecture

- Routes: `/`, `/program/:id`, `/routine/:id`, `/run/:id`, `/metrics`,
  `/progress`, `/settings`.
- Data model: `Category → Program → Model → Block → Exercise` (see
  `app/src/types/index.ts`). UI copy names them **categoría → programa → rutina**; "progresión" is
  only the chain concept ("cadena de progresión"), and "modelo"/"plan" stay out of user copy.
- Descansos: salen del bloque (`restBetweenSetsSec` = entre series, `restBetweenExercisesSec` =
  entre ejercicios). `app/src/lib/rest.ts` los resuelve; el runner los informa dentro del
  ejercicio y no permite editarlos.
- Persistence: Dexie tables `sessions`, `progress`, `goals`, `settings`
  (`app/src/db/index.ts`).
- Runner state machine: `idle → countdown(3) → work → rest → done`.
- Theme: light by default, dark toggle in settings.
- Sound: local asset `/public/sounds/` (pokemon item found), configurable.

## Conventions

- Default export for page/component modules as used in `App.tsx` imports.
- Types live in `app/src/types/index.ts`; reuse them, do not redefine.
- Plan data is static JSON; never fetch at runtime.
- IndexedDB access only through `app/src/db/index.ts` (`db`).
- UI copy in Spanish; code, identifiers, comments, commits in English.

## Code Review Rules (GGA)

### General

REJECT if:
- Hardcoded secrets or credentials.
- `any` type (TS) or missing type annotations.
- Empty catch blocks (silent error handling).
- Code duplication (violates DRY).
- `console.log` / `print()` in production code.
- Unused imports or dead code.

### TypeScript / React

REJECT if:
- `import * as React` → use named imports (`import { useState }`).
- `var()` or hex colors in className → use Tailwind utilities.
- `useMemo` / `useCallback` without justification (React 19 Compiler). The project enables the React Compiler (`babel-plugin-react-compiler` via `@rolldown/plugin-babel` in `vite.config.ts`); manual memoization is discouraged — prefer plain expressions/derived values and let the compiler memoize. Any retained `useMemo`/`useCallback` must include a profiling justification in a comment.
- Missing `"use client"` in client components (when applicable).
- Direct DOM manipulation instead of React state.
- Mutating state directly instead of immutable updates.
- Missing dependency arrays in `useEffect` / `useMemo` / `useCallback`.
- `key` using array index for dynamic lists.

PREFER:
- Let the React Compiler handle memoization; write plain derived values instead of `useMemo`/`useCallback`.
- `cn()` for conditional class merging.
- Semantic HTML over divs.
- Named exports over default exports where practical.
- Tailwind utilities; avoid inline styles except dynamic values.

### Dexie / IndexedDB

REJECT if:
- Schema version bump without migration notes.
- Direct IndexedDB access bypassing `db`.
- Storing non-serializable values.
- Missing error handling on DB operations.

### Data files (JSON)

REJECT if:
- `plans.json` / `exercise-videos.json` edited with inconsistent shapes or drifted
  `Exercise.video` projections (`plansVideo.test.ts` pins the consistency).
- Storing non-serializable values.

### Response Format (GGA)

FIRST LINE must be exactly:
STATUS: PASSED
or
STATUS: FAILED

If FAILED, list: `file:line - rule violated - issue`.

## Testing

- Runner timer logic must be covered by unit tests (`steps.test.ts` pattern).
- Tests assert observable behavior through the public interface.
- UI verification goes through Playwright (`app/e2e/`, `npm run test:e2e`; sync specs live in
  `app/e2e-sync/` with their own config): mobile
  and desktop projects, dev server autostarted by the config.
- Run `npm test`, `npm run test:e2e` and `npm run build` before declaring done.

## Design System

Visual identity follows `DESIGN.md` ("The Timing Board"): Voltage Lime accent, zero-radius, hairline borders, no shadows, Swiss grid, mono metrics.

## Tooling

- Engram memory: available (`engram`), project `rutinas`.
- CodeGraph: initialized at `.codegraph/` (run `codegraph sync -q .` after edits).
- RDD: enabled globally (`gentle-ai review mode status`).