# Design Plan: Make runner rest-screen spinner circular

## Metadata
- Created: 2026-10-20
- Surface: Routine runner — rest countdown screen (`/run/:id`)
- Source commit: unavailable (working tree has no commits; branch `feat/logstenia`, all files untracked)
- Design source: `docs/DESIGN.md` — "The Timing Board"
- Governing rule: `docs/DESIGN.md` → Shapes: "No hay píldoras, círculos salvo los indicadores de estado (cuadrados de 8px) y los spinners." Spinners are an explicit exception to the Zero-Radius Rule.

## Goal
Restore the circular shape of the rest-screen spinner, which the global zero-radius override currently forces to a square, contradicting the documented spinner exception.

## Scope (files to modify)
- `app/src/pages/Runner.tsx` — the rest-screen spinner `div` (the `animate-spin` element).
- (Alternative, if preferred by executor) `app/src/index.css` — scope the global `* { border-radius: 0 !important; }` so it does not clobber spinner rounding. Only if the element-level fix is insufficient.

## Out of scope
- Do not change spinner size, color, animation, or border width.
- Do not remove the global zero-radius rule (it enforces the Zero-Radius Rule elsewhere).
- Do not touch other `rounded-*` classes in the codebase.

## Current behavior (evidence)
`app/src/index.css`:
```css
* { box-sizing: border-box; border-radius: 0 !important; }
```
`app/src/pages/Runner.tsx` (rest screen):
```tsx
<div className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-[var(--voltage-lime)] border-r-[var(--voltage-lime)]/50" />
```
- The element declares `rounded-full`, but the global `*` rule uses `!important`, so `border-radius: 0` wins and the spinner renders as a square. This contradicts the documented exception that spinners are circular.

## Required change
Preferred (element-level, minimal blast radius): in `app/src/pages/Runner.tsx`, make the spinner's rounding win over the global override by using Tailwind's important modifier on the utility:
- Change `rounded-full` → `rounded-full!`.

Resulting className:
```
absolute inset-0 animate-spin rounded-full! border-4 border-transparent border-t-[var(--voltage-lime)] border-r-[var(--voltage-lime)]/50
```

Fallback (only if the element-level utility does not override the global `!important` in this Tailwind v4 setup): add a scoped CSS rule in `app/src/index.css`:
```css
.runner-spinner { border-radius: 9999px !important; }
```
and add `runner-spinner` to the spinner element's className. Do not broaden the scope beyond this element.

## Reusable primitives / exemplars
- None. This is a single-element correction; do not introduce a shared spinner primitive from this one instance.

## Acceptance criteria
- The rest-screen spinner renders as a circle (border-radius 9999px / 50%).
- No other element's radius changes.
- `npm run build` and `npm run lint` pass.

## Verification (for executor)
- `cd app && npm run build`
- `cd app && npm run lint`
- Inspect the built CSS / computed style for the spinner element to confirm `border-radius: 9999px` (or 50%) is applied and not overridden to 0.

## Risks / notes
- Tailwind v4 important-modifier syntax (`rounded-full!`) must be verified against the installed Tailwind version; if unsupported, use the CSS fallback. Confirm with `npm run build` (no class errors).
- This plan and the modal/footer plans all edit `Runner.tsx`; apply them in separate commits or reconcile carefully to avoid overlapping hunks.
