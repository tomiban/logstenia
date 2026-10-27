# Design Plan: Remove box-shadow from runner pending-sets modal

## Metadata
- Created: 2026-10-20
- Surface: Routine runner — pending-sets confirmation modal (`/run/:id`)
- Source commit: unavailable (working tree has no commits; branch `feat/logstenia`, all files untracked)
- Design source: `DESIGN.md` — "The Timing Board"
- Governing rule: "The No-Shadow Rule" — `DESIGN.md` → Elevation & Depth: "Ninguna superficie usa `box-shadow` en reposo."

## Goal
Eliminate the only `box-shadow` in the traced runner surface so the pending-sets modal conforms to the No-Shadow Rule, relying on tonal layering and the hairline border instead.

## Scope (files to modify)
- `app/src/pages/Runner.tsx` — the modal container `div` (pending-sets dialog).

## Out of scope
- Do not change modal copy, button variants, or overlay scrim.
- Do not touch `app/src/ui/Card.tsx` (unused legacy component) or `app/src/App.css` (dead Vite template) — both outside the traced runner path.
- Do not alter any other shadow usage elsewhere; there is none in the traced path.

## Current behavior (evidence)
`app/src/pages/Runner.tsx` (modal block):
```tsx
<div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-4">
  <div className="w-full max-w-sm space-y-4 border-2 border-[var(--ink)] bg-[var(--surface)] p-6 shadow-xl">
    <p className="label-caps text-[var(--foreground)]">series sin registrar</p>
    ...
  </div>
</div>
```
- `shadow-xl` produces a `box-shadow`, which the No-Shadow Rule forbids on any surface at rest.
- The modal already has a 2px ink border and a surface background; depth is communicated by the scrim (`bg-black/60`) plus the border, consistent with the "tonal layers + hairline" vocabulary.

## Required change
In `app/src/pages/Runner.tsx`, edit the modal container className:
- Remove `shadow-xl`.

Resulting className:
```
w-full max-w-sm space-y-4 border-2 border-[var(--ink)] bg-[var(--surface)] p-6
```
(Keep `border-2` as-is for this plan; border weight is a separate concern not covered here.)

## Reusable primitives / exemplars
- No new primitive needed. The existing modal pattern (border + surface + scrim) already expresses elevation per DESIGN.md.

## Acceptance criteria
- The modal container className no longer contains `shadow` or `shadow-xl`.
- `grep -n "shadow" app/src/pages/Runner.tsx` returns no matches.
- `npm run build` and `npm run lint` pass.

## Verification (for executor)
- `cd app && npm run build`
- `cd app && npm run lint`
- `grep -rn "shadow" src/pages/Runner.tsx` (expect none)

## Risks / notes
- Removing the shadow slightly flattens the dialog against the scrim; the ink border + scrim retain separation. If a stronger separation is desired, that is a new design decision and must be a separate plan.
- This plan and the spinner/footer plans all edit `Runner.tsx`; apply them in separate commits or reconcile carefully to avoid overlapping hunks.
