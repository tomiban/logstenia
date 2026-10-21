# Logstenia Plans CRUD + IDs

Refactor para que los ejercicios tengan id propio, las marcas/anclas se consulten por id (no por nombre), y los planes sean editables (CRUD) persistidos en la BD local (idb), sin backend.

## Specs

- S1: Cada ejercicio en `plans.json` tiene un `id` estable (slug del nombre + modelo).
- S2: `MarkRecord` guarda `exerciseId` (además de `exercise` para display). Las consultas de marcas por ejercicio usan `exerciseId`.
- S3: Las anclas (`ANCLAS`) referencian ejercicios por `exerciseId` (con `ejercicio` como display).
- S4: Los planes (categorías → programas → modelos → bloques → ejercicios) se persisten en un store `plans` de idb. CRUD completo: crear/leer/actualizar/eliminar categoría, programa, modelo, bloque, ejercicio.
- S5: Seed inicial: si la BD no tiene planes, se importan desde `plans.json` (con ids).
- S6: Migración única: marcas existentes sin `exerciseId` se resuelven por nombre → id al primer arranque.
- S7: Borrado de plan/ejercicio no borra historial (marcas/sesiones); se mantiene por id. Si el ejercicio ya no existe, la marca queda huérfana pero consultable.
- S8: `plans.ts` lee de la BD, no del JSON estático (el JSON queda como seed).

## Tasks

- T1 [S1] Fase 1: agregar `id` a cada ejercicio en `plans.json` mediante script.
- T2 [S2,S6] Fase 1: actualizar `MarkRecord` (exerciseId) y migración de marcas existentes.
- T3 [S3] Fase 1: actualizar anclas y `anchorProgress` para usar `exerciseId`.
- T4 [S4,S5] Fase 2: crear store `plans` en idb + seed desde JSON + API CRUD en `plans.ts`.
- T5 [S8] Fase 2: refactorizar `plans.ts` y consumidores para leer de BD.
- T6 [S7] Fase 2: manejo de borrado sin cascada + huérfanos.
- T7 [S1..S8] Verificación: build, tests, lint, codegraph.

## Log

- L1: Solicitud original: consultas por id (no por nombre) y CRUD sobre planes, sin backend. Estrategia: soft delete descartado, hard delete sin cascada.

## UI (nuevo requisito 2026-10-21)

- S9: Se puede crear/editar/borrar categorías desde la pantalla Planes.
- S10: Se puede crear/editar/borrar programas desde la pantalla de categoría (Skill).
- S11: Se puede crear/editar/borrar rutinas (modelos) desde la pantalla de programa.
- S12: Se puede crear/editar/borrar bloques y ejercicios desde la pantalla de rutina (modo edición).
- S13: Borrado duro sin cascada; sesiones/marcas quedan huérfanas pero consultables.

### Tasks adicionales

- T8 [S9] UI CRUD de categorías (Planes.tsx).
- T9 [S10] UI CRUD de programas (Skill.tsx).
- T10 [S11] UI CRUD de rutinas (Program.tsx).
- T11 [S12] UI CRUD de bloques/ejercicios (Routine.tsx) + modo edición.
- T12 [S1..S13] Verificación build/test/lint/e2e.

## Log

- L2: Nuevo requisito usuario: "quiero poder crear y editar planes programas y rutinas." Implementado CRUD UI con botones en pantallas existentes, borrado duro sin cascada. Reactividad vía usePlans (version counter).

## Log

- L3: Modernización UX/UI con shadcn/ui: Dialog para crear/editar, AlertDialog para borrado, Select/Textarea/Label, DropdownMenu (⋯) para acciones por entidad. Etiquetas de ejercicios movidas a submenu dentro del dropdown.
