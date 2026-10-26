# Design Plan: Runner UI conformance (consolidated)

## Metadata
- Created: 2026-10-20
- Supersedes/consolidates: `runner-modal-no-shadow.md`, `runner-spinner-circular.md`, `runner-footer-overflow.md`
- Surface: Routine runner (`/run/:id`) — `app/src/pages/Runner.tsx`
- Source commit: unavailable (working tree has no commits; branch `feat/logstenia`, all files untracked)
- Design source: `DESIGN.md` — "The Timing Board"
- Governing rules: No-Shadow Rule; spinner exception to Zero-Radius Rule; container padding contract (`Layout.tsx`).

## Goal
Apply three small, independent conformance fixes to the runner in a single reviewable commit, with ordered hunks to avoid conflicts:
1. Remove `shadow-xl` from the pending-sets modal (No-Shadow Rule).
2. Make the rest-screen spinner circular (documented spinner exception).
3. Fix the sticky footer negative margin on mobile (container padding alignment).

## Scope (files to modify)
- `app/src/pages/Runner.tsx` only.

## Out of scope
- No copy, behavior, data, or routing changes.
- No changes to `Layout.tsx`, `index.css` (unless the spinner fallback is required), or other components.
- No new shared primitives.

## Ordered edits (apply in this order)

### Edit A — modal (No-Shadow Rule)
Location: pending-sets modal container.
Old:
```tsx
<div className="w-full max-w-sm space-y-4 border-2 border-[var(--ink)] bg-[var(--surface)] p-6 shadow-xl">
```
New:
```tsx
<div className="w-full max-w-sm space-y-4 border-2 border-[var(--ink)] bg-[var(--surface)] p-6">
```

### Edit B — spinner (circular exception)
Location: rest-screen spinner `div`.
Old:
```tsx
<div className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-[var(--voltage-lime)] border-r-[var(--voltage-lime)]/50" />
```
New:
```tsx
<div className="absolute inset-0 animate-spin rounded-full! border-4 border-transparent border-t-[var(--voltage-lime)] border-r-[var(--voltage-lime)]/50" />
```
Fallback (only if `rounded-full!` does not override the global `* { border-radius: 0 !important }` in this Tailwind v4 setup): add to `app/src/index.css`:
```css
.runner-spinner { border-radius: 9999px !important; }
```
and add `runner-spinner` to the spinner element's className. Do not broaden the scope.

### Edit C — footer (mobile overflow)
Location: sticky bottom action bar.
Old:
```tsx
<div className="sticky bottom-0 -mx-6 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] bg-[var(--background)] px-6 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
```
New:
```tsx
<div className="sticky bottom-0 -mx-4 sm:-mx-6 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] bg-[var(--background)] px-6 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
```

## Reusable primitives / exemplars
- None. All three are element-level conformance corrections.

## Acceptance criteria
- No `shadow*` class remains in `Runner.tsx`.
- Rest-screen spinner computes `border-radius: 9999px` (or 50%), not 0.
- No horizontal overflow on mobile viewports (<640px); footer aligns with container edges.
- `npm run build` and `npm run lint` pass.

## Verification (for executor)
- `cd app && npm run build`
- `cd app && npm run lint`
- `grep -n "shadow" src/pages/Runner.tsx` (expect none)
- Render `/run/:id` at 375px width; confirm no horizontal scrollbar and spinner is circular.

## Risks / notes
- Edits A/B/C touch the same file but distinct lines; apply in order and re-run build after all three.
- If `rounded-full!` is unsupported by the installed Tailwind, use the CSS fallback (Edit B) and note it in the commit.
- Commit message suggestion (Conventional Commits): `fix(runner): remove shadow, round spinner, fix mobile footer overflow`.
