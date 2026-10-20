# Logstenia — Agent & Review Rules

## Project

Web PWA (React + Vite + TypeScript) for launching calisthenics routines from
Pro-gress plans, with an interactive timer, metrics and embedded videos.
Single user, no auth, local data (IndexedDB via Dexie). UI in Spanish.

- `app/` — application (React + Vite + TS).
- `scripts/` — PDF parsing (`parse_pdfs.py`) and data builder (`build_cardio.py`).
- `app/src/data/plans.json` — curated plan data.
- `odd/tasks/logstenia.md` — ODD tracking.
- `PLAN.md` — full specification.

## Stack

- React 19, React Router 7, Vite 8, TypeScript ~6
- Tailwind CSS 4, oxlint, vitest
- Dexie (IndexedDB), vite-plugin-pwa, recharts
- Python 3 (scripts)

## Commands

```bash
cd app
npm install
npm run dev       # http://localhost:5173
npm run build     # tsc -b && vite build
npm run lint      # oxlint
npm test          # vitest run
```

Scripts (from repo root):

```bash
python3 scripts/parse_pdfs.py
python3 scripts/build_cardio.py
```

## Architecture

- Routes: `/`, `/program/:id`, `/routine/:id`, `/run/:id`, `/metrics`,
  `/progress`, `/settings`.
- Data model: `Category → Program → Model → Block → Exercise` (see
  `app/src/types/index.ts`).
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
- `any` type (TS) or missing type hints (Python).
- Empty catch blocks (silent error handling).
- Code duplication (violates DRY).
- `console.log` / `print()` in production code.
- Unused imports or dead code.

### TypeScript / React

REJECT if:
- `import * as React` → use named imports (`import { useState }`).
- `var()` or hex colors in className → use Tailwind utilities.
- `useMemo` / `useCallback` without justification (React 19 Compiler).
- Missing `"use client"` in client components (when applicable).
- Direct DOM manipulation instead of React state.
- Mutating state directly instead of immutable updates.
- Missing dependency arrays in `useEffect` / `useMemo` / `useCallback`.
- `key` using array index for dynamic lists.

PREFER:
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

### Python (scripts)

REJECT if:
- Missing type hints on public functions.
- Bare `except:` without specific exception.
- `print()` instead of `logger`.

### Response Format (GGA)

FIRST LINE must be exactly:
STATUS: PASSED
or
STATUS: FAILED

If FAILED, list: `file:line - rule violated - issue`.

## Testing

- Runner timer logic must be covered by unit tests (`steps.test.ts` pattern).
- Tests assert observable behavior through the public interface.
- Run `npm test` and `npm run build` before declaring done.

## Design System

Visual identity follows `docs/DESIGN.md` ("The Timing Board"): Voltage Lime accent, zero-radius, hairline borders, no shadows, Swiss grid, mono metrics.

## Tooling

- Engram memory: available (`engram`), project `rutinas`.
- CodeGraph: initialized at `.codegraph/` (run `codegraph sync -q .` after edits).
- RDD: enabled globally (`gentle-ai review mode status`).