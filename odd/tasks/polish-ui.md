# Polish UI

Pasada de polish visual/UX por todas las pantallas y componentes compartidos, alineando con el design system "The Timing Board" (docs/DESIGN.md): tokens, tipografía, espaciado, estados, responsive, accesibilidad.

## Specs

- S1: Todas las pantallas usan tokens Tailwind del design system (no `var(--...)` en className) y tipografía consistente (font-heading, label-caps, metric).
- S2: Estados de carga, vacío y error presentes y consistentes en cada pantalla.
- S3: Responsive: touch targets ≥44px en flujos de gimnasio, grids adaptativos, sin overflow horizontal.
- S4: Accesibilidad: focus visible, labels, roles, contraste en light/dark.
- S5: Build, lint y tests pasan tras cada cambio.

## Tasks

- T1 [S1,S5] Normalizar tokens de color en todos los .tsx/.ts. Route: inline. ✓
- T2 ✓ [S1,S5] Polish componentes UI compartidos (button, card, input, badge, dialog, select, etc.). Route: inline.
- T3 ✓ [S1,S2,S3,S4,S5] Polish Home. Route: inline.
- T4 ✓ [S1,S2,S3,S4,S5] Polish Planes. Route: inline.
- T5 ✓ [S1,S2,S3,S4,S5] Polish Program. Route: inline.
- T6 ✓ [S1,S2,S3,S4,S5] Polish Routine. Route: inline.
- T7 ✓ [S1,S2,S3,S4,S5] Polish Runner. Route: inline.
- T8 ✓ [S1,S2,S3,S4,S5] Polish Metrics. Route: inline.
- T9 ✓ [S1,S2,S3,S4,S5] Polish Skill (progresión). Route: inline.
- T10 ✓ [S1,S2,S3,S4,S5] Polish Settings. Route: inline.
- T11 ✓ [S5] Verificación final: lint, tests, build, e2e. Route: inline.

## Log

- L1: Solicitud del usuario: polish por todas las pantallas de la app, priorizando visual/consistencia con design system.
