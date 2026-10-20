# Design Plan: Fix runner sticky footer horizontal overflow on mobile

## Metadata
- Created: 2026-10-20
- Surface: Routine runner — sticky bottom action bar (`/run/:id`)
- Source commit: unavailable (working tree has no commits; branch `feat/logstenia`, all files untracked)
- Design source: `docs/DESIGN.md` — "The Timing Board" (Layout: container padding, mobile-first)
- Governing rule: container padding contract — `app/src/components/Layout.tsx` main uses `px-4` on mobile and `sm:px-6` on ≥640px; DESIGN.md specifies 24px (`px-6`) lateral padding.

## Goal
Align the runner's sticky footer negative margin with the actual container padding so it does not overflow horizontally on mobile screens.

## Scope (files to modify)
- `app/src/pages/Runner.tsx` — the sticky bottom action bar `div`.

## Out of scope
- Do not change button labels, order, or variants.
- Do not change the bottom nav (fixed) in `Layout.tsx`.
- Do not adjust container padding globally.

## Current behavior (evidence)
`app/src/components/Layout.tsx`:
```tsx
<main className="mx-auto max-w-6xl space-y-4 px-4 py-6 sm:px-6">
```
`app/src/pages/Runner.tsx` (sticky footer):
```tsx
<div className="sticky bottom-0 -mx-6 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] bg-[var(--background)] px-6 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
```
- On mobile (<640px), the container pads 16px (`px-4`) but the footer pulls back 24px (`-mx-6`), producing 8px of horizontal overflow on each side and a horizontal scrollbar / clipped content.
- On ≥640px, padding is 24px (`sm:px-6`) and `-mx-6` is correct.

## Required change
In `app/src/pages/Runner.tsx`, make the negative margin responsive to match the container:
- Change `-mx-6` → `-mx-4 sm:-mx-6`.

Resulting className:
```
sticky bottom-0 -mx-4 sm:-mx-6 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] bg-[var(--background)] px-6 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]
```
Note: keep `px-6` as the inner padding (content padding inside the footer), which is fine; only the outer negative margin must be responsive. If the executor prefers symmetric responsive padding, use `px-4 sm:px-6` instead, but the single-class change above is sufficient and minimal.

## Reusable primitives / exemplars
- None. This is a one-off responsive alignment fix.

## Acceptance criteria
- No horizontal overflow on mobile viewports (<640px).
- Footer aligns with the main container edges on both mobile and desktop.
- `npm run build` and `npm run lint` pass.

## Verification (for executor)
- `cd app && npm run build`
- `cd app && npm run lint`
- Visual/structural: render `/run/:id` at a 375px-wide viewport and confirm no horizontal scrollbar and footer edges align with card edges above.

## Risks / notes
- The footer is `sticky bottom-0` inside a container with `space-y-4`; ensure the negative margin does not cause the sticky element to overlap the bottom nav. The existing behavior is preserved by only changing the margin value.
- This plan and the modal/spinner plans all edit `Runner.tsx`; apply them in separate commits or reconcile carefully to avoid overlapping hunks.
