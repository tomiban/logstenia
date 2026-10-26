# ui-polish-render-pass — critique of every view against the rendered app, then the polish

Fourth review pass on Logtenia. The first three read the code; this one adds what the repository
declared "no juzgable sin pantalla renderizada": real Chromium captures of the seven routes at
390px and 1440px, light and dark, with seeded data. The design contract stays `DESIGN.md`.

## Specs

S1. `quiero que sometas a criticas todas las vistas de mi web. Ux/UI. Con los reportes haz un
pulido.` — every view gets a UX/UI critique; the report is the input of a polish that is applied,
not proposed.

S2. `tambien si es conveniente rediseñar` — a structural redesign of a view or shell element is in
scope when it demonstrably beats the current composition. The identity stays: zero radius, no
shadows, one lime beacon, Swiss grid, mono for data. Changing the identity itself is not in scope.

## Tasks

| ID | Spec | Surface | Evidence |
| --- | --- | --- | --- |
| T1 | S1, S2 | shell: scroll architecture, settings trigger, session chrome, copy helpers | `index.css`, `Layout.tsx`, `SettingsMenu.tsx`, `App.tsx`, `lib/{format,labels,date}.ts` + tests, e2e scroll test |
| T2 | S1, S2 | `/` Home | `features/home/Home.tsx`; one accent, honest counts, dark-mode week rail, `formatDayMonth` |
| T3 | S1, S2 | `/planes`, `/program/:id` | `Planes.tsx`, `Program.tsx`, `plans.json`; one beacon, single progression block, telemetry cards |
| T4 | S1, S2 | `/routine/:id` | `Routine.tsx`, `Video.tsx`; launch bar, block telemetry, labelled tags |
| T5 | S1 | `/run/:id` | `Runner.tsx`, `useRunner.ts`, `Cronometro.tsx`, `runnerLogic.ts` + tests; session bar, exact skip dialog, per-exercise slider |
| T6 | S1, S2 | `/metrics` | `Metrics.tsx`, `metrics.ts` + tests; range governs every block, accessible charts, honest title |
| T7 | S1, S2 | `/skill/:id` | `Skill.tsx`, `progression.ts` + tests; the chain that blocks, compact rail |
| T8 | S1 | contract and reports | `DESIGN.md`, `AGENTS.md`, `design-plans/ui-polish-render-pass.md` |
| T9 | S1 | e2e that follows the new copy | `e2e/*.e2e.ts`, `playwright.config.ts` |

All tasks are closed: `npm run build`, `npm run lint`, `npm test` (335 tests) and `npx playwright test`
(40 tests, both projects) are green on the same tree.

## Log

L1. `quiero que sometas a criticas todas las vistas de mi web. Ux/UI. Con los reportes haz un
pulido.`

L2. `tambien si es conveniente rediseñar`

L3. Evidence gathered: seven routes captured in Chromium at 390px and 1440px, light and dark, with
seeded data (16 sessions, 6 marks, weekly progress, tags, a 16-day-old mesocycle). Three blind
reviewers ran against those captures plus the code; their reports converged with the rendered pass
on lime discipline, prose in mono, terminology and tap targets.

L4. Decision — vocabulary. `PRODUCT.md` and the data model already name the entities: `Category`,
`Program`, `Model`. UI copy therefore says **categoría → programa → rutina**; "progresión" is
reserved for the chain concept ("cadena de progresión"), never for a program; "modelo" and "plan"
leave the user-facing copy.

L5. Decision — contrast. Lime measured 1.03:1 as text on paper ("desbloqueado"/"completado"), which
is unreadable rather than a matter of taste. The contract gains **The Lime-is-a-fill Rule**: lime
fills, borders and markers; it never becomes the colour of text on paper or surface. `DESIGN.md`
records the rule and the contrast test covers the tokens it can cover.

L6. Decision — scroll architecture. `html, body, #root { height: 100%; overflow-x: hidden }` turned
all three into nested scroll containers: the document did not scroll at all, so `PageDown` and
`window.scrollY` were dead (proved by a failing e2e assertion, then by a passing one after the
fix). Horizontal clipping moves to `overflow-x: clip` on `html, body`, which does not create a
scroll container.

L7. Decision — chain position reads **"Fase N de M"** on both `/program` and `/skill`, which is the
copy that already existed on the program screen, and "nivel" stays for the difficulty concept ("el
siguiente nivel"). "Nivel N de M" would have collided with the program's own level word
("intermedio") two lines above.

L8. Decision — Beacon Rule on `/`. The warm-up row is an optional extra, so it is `outline`, and
exactly one program row carries the accent (the first one). With no started program the single
accent belongs to "Ver programas".

L9. Decision — `best` on `/` reads marks only. Marks carry the exercise display name and progress
rows carry exercise ids, so the id lookup never matched and silently contributed nothing: a
"mejor marca" that ignored progress. The readout is now honest about what it shows; normalizing the
exercise identity across marks and progress stays open (recorded in `odd/tasks/logstenia.md`).

L10. Verification added findings the reviewers could not see without a browser:
`ValueTick` printed `dd/mm` under every bar and the labels collided at 390px; the stride now aligns to
the last bar and the first/last labels anchor start/end. The chart legend note was still a sentence in
`label-caps` and moved to prose. `PageFallback` gained `role="status" aria-busy`. The seven `h1` had
three different sizes and are now one scale, recorded in `DESIGN.md`. Playwright's default 5s
assertion timeout was failing cold lazy-chunk starts under four parallel workers; the config now
allows 15s.

L11. Decisions closed while reviewing the delegated work: `restLabel` keeps the seconds of a rest that
is not a whole minute (`90` → `1 min 30 s`) so `DESCANSO` and `DESCANSO FINAL` stop showing the same
value; `Usar tiempo` is an in-row control and goes `outline`, leaving the session bar's advance button
as the only accent (recorded in `DESIGN.md`); the typed/empty counting of the skip dialog became
`countPendingSets` in `runnerLogic.ts` with four tests instead of living untested in the hook; the
Skill lock reason is one line (`lockSummary`) because `describeLock` listed every missing anchor.

L12. Open items this pass did not close, on purpose: `viewport-fit=cover` plus safe-area padding on
the mobile nav (unverifiable without an iOS device); normalizing the exercise identity so progress
rows contribute to "mejor marca" (L9); popup shadows from Base UI and the `input type=date` behaviour
on iOS (still no device evidence).

## Delivery slices

The branch `worktree/lucky-valley-af7c` already carried the three previous passes (≈1800 authored
lines over 18 commits) before this one started, so this pass is not one PR. The work units of *this*
pass are, in order, and each is reviewable on its own:

1. `feat(copy)` — the three shared helpers and their tests.
2. `fix(css)` — the scroll architecture, with the e2e that proves it.
3. `fix(shell)` — settings control, session chrome, route fallback.
4. `feat(metrics)` ×2 — the range helper and tests; the screen and the chart tick.
5. `feat(home)` — one primary, honest counts, dark-mode week rail.
6. `feat(plans)` — one beacon, one progression block, telemetry cards.
7. `feat(routine)` — launch bar, block telemetry, plus the pre-existing duplication the gate caught.
8. `feat(runner)` — session bar, honest skip dialog, per-exercise targets.
9. `feat(skill)` — the chain that blocks.
10. `test(e2e)` — the assertions the new copy moved.
11. `docs(design)` — the contract and the reports.

Slice boundary for a PR: from the first `feat(copy)` commit to the `docs(design)` commit. Anything
before it belongs to the previous passes and should be reviewed (or merged) separately.
