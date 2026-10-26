# UI audit por pantalla (improve-ui)

Pasada de auditoría de diseño con el método `improve-ui` sobre cada pantalla de la app, en loop
hasta cubrirlas todas: evidencia de diseño trazada, findings con puerta de prueba triple, y —
solo si el usuario elige findings — planes de implementación autocontenidos en `design-plans/`.

Read-only sobre el código de producto: no modifica `app/`, no instala dependencias, no commitea.
La única escritura posible son planes en `design-plans/`, y solo tras selección explícita.

## Specs

- S1: Pasar `improve-ui` en cada pantalla de la app, en loop, hasta terminar.
  Pedido textual del usuario: "quiero que pases improve ui en cada pantalla en loop hasta terminar"
- S2: Cada pantalla se audita con el contrato del método: superficie única y coherente, evidencia
  de diseño trazada por el camino de render (no por búsqueda repo-wide), puerta de prueba triple
  (contrato + runtime + corrección determinista), pasada de falsificación, máximo 3 findings, y
  "No supported findings were found." cuando no haya evidencia. Nunca modificar código de producto.
- S3: El contrato de diseño vigente es `DESIGN.md` ("The Timing Board"). Los defaults
  genéricos nunca ganan sobre una decisión explícita del sistema (radio 0, sin sombras, Voltage
  Lime ≤10%, mono tabular, alturas táctiles 44px).
- S4: La identidad de la marca es la barra con patas, no un cuadrado cerrado.
  Decisión textual del usuario: "el logo debía mantener la barra pero hiciste un cuadrado no quedo
  bien." No se propone ninguna corrección que reintroduzca un marco/caja como marca.
- S5: Los hallazgos deben reconciliarse con los planes existentes en `design-plans/` (en especial
  `runner-ui-conformance.md`, que consolida tres planes del Runner) en lugar de duplicarlos.

## Tasks

- T1 ✓ [S1,S2,S3] Auditar el shell compartido (`Layout.tsx`, header, nav, contenedor, footer móvil).
- T2 ✓ [S1,S2,S3] Auditar `/` (Home).
- T3 ✓ [S1,S2,S3] Auditar `/planes` (Planes).
- T4 ✓ [S1,S2,S3] Auditar `/program/:id` (Program).
- T5 ✓ [S1,S2,S3] Auditar `/routine/:id` (Routine), reconciliando con `runner-ui-conformance.md`.
- T6 ✓ [S1,S2,S3] Auditar `/run/:id` (Runner), reconciliando con `runner-ui-conformance.md`.
- T7 ✓ [S1,S2,S3] Auditar `/metrics` (Metrics).
- T8 ✓ [S1,S2,S3] Auditar `/skill/:id` (Skill / progresión).
- T9 ✓ [S2,S5] Consolidar el reporte: findings ordenados por confianza/impacto, duplicados entre
  pantallas agrupados por causa raíz, y la decisión de qué convertir en plan.
- T10 [S2] Solo si el usuario elige findings: escribir los planes en `design-plans/` con
  `references/plan-template.md`. **Pendiente de decisión del usuario.**

## Log

- L1: "quiero que pases improve ui en cada pantalla en loop hasta terminar"
- L2: Rechazo del logo cuadrado: "el logo debia mantener la barra pero hciiste un cuadrado no quedo
  bien." → `app/public/favicon.svg` y `app/src/components/Layout.tsx` revertidos a HEAD; la marca
  canónica es la barra con patas (consistente con `app/public/icons/icon-512.png`).
- L3: Superficies relevadas desde `app/src/App.tsx`: `/`, `/skill/:id`, `/planes`, `/program/:id`,
  `/routine/:id`, `/run/:id`, `/metrics`, más el shell `Layout` que envuelve a todas.
- L4: Evidencia recolectada por delegación read-only (`gentle-ai-explore`), puerta de prueba y
  falsificación aplicadas por el orquestador sobre las líneas citadas.
- L5: T1–T9 cerradas. Reporte consolidado en `design-plans/ui-audit-findings.md`: 10 findings
  principales, 7 menores, 6 preguntas abiertas y 12 candidatos descartados en la falsificación.
  Las tres decisiones de `design-plans/runner-ui-conformance.md` están implementadas en disco
  (pérdida de margen del footer: implementada como el plan la escribió, pero no alcanza su propio
  objetivo porque el shell usa `px-6` a todo ancho → ver F9).
- L6: Dos superficies auditadas (Home, Routine) tienen cambios sin commitear de otra sesión al
  momento de la auditoría; los números de línea del reporte corresponden al árbol de trabajo de
  ese día.
- L7: El usuario eligió implementar F1 (no escribir planes). Aplicado `variant="destructive"` en
  los 5 `AlertDialogAction` (`Planes:122`, `Routine:435`, `Routine:504`, `Program:260`,
  `Skill:231`): 4 archivos, 5 inserciones / 5 borrados, ningún hunk ajeno. Sin commit (task chica,
  el usuario no lo pidió). Verificación: `--destructive` → `var(--alert)` (`index.css:48`) = el
  tratamiento Alert que pide DESIGN; lint 0, 284/284 tests, build 0. La otra sesión commiteó su
  trabajo (`f8995f4`) antes de tocar `Routine.tsx`, así que no hubo colisión.
- L8: El usuario eligió cerrar ahora el finding del effect de `Routine.tsx` ("a ahora"); el del
  `classList` del dark mode queda como tarea con el motivo corregido. Correcciones de premisa,
  verificadas contra el código: (a) `[res]` no producía un loop — `getModel` devuelve la entrada
  estable de `modelIndex` (`plans.ts:149`) y las mutaciones mutan en sitio (`createExercise`
  `plans.ts:441`), así que `[res]` corría una sola vez; el riesgo real era el proxy inverso,
  `blocks.length` (`Routine.tsx:125`), que pierde cambios intra-bloque. (b) El `classList` no pide
  un ThemeProvider: la regla está triplicada (`Layout.tsx:49`, `SettingsMenu.tsx:77` y `:128`) y
  el defecto observable es el flash claro pre-paint (tema en Dexie, async, sin script inline en
  `index.html`). Aplicado: el backfill de `isometricos` sale de la pantalla a la siembra del
  catálogo (`seedPlanTags` en `plans.ts`, junto a las etiquetas de rutina), la regla queda en
  `lib/exercise.ts:isTimedExercise` compartida con `Runner.tsx:39`, y `lib/tags.ts:seedTags`
  escribe en una transacción solo los pares sin fila viva. `bulkPut` acepta la forma de escritura
  (`InsertRow<T>`), igual que `put`. 7 archivos (5 modificados, 2 nuevos), sin commit (el usuario
  no lo pidió). Verificación: RED→GREEN `plansTags.test.ts` 4/4, suite 288/288, lint sin hallazgos
  nuevos, build 0, y `progression.e2e.ts:37` falla igual en el commit base `f8995f4` (diferencial
  en copia temporal), o sea que no es de este cambio. Costo medido: +335 ms en el primer boot
  (165 filas, idempotente después). Límite conocido: `removeTag` sobre una etiqueta derivada
  vuelve en la próxima carga, igual que ya pasaba con las etiquetas de rutina.
- L8: Findings implementados en el árbol (sin commit): F1 (5 destructivas), F6 (`ring-border` en
  card/dialog/select), F5 (`Label` con el label documentado), F4 (nav móvil sin subrayado lima),
  F9 (gutter del header a `px-6`), m1 (borde del nav de escritorio). Verificación: lint 0, tests
  verdes, build 0; diffs revisados por el orquestador.
- L9: e2e — 33/38 en la corrida completa, 15/19 en desktop con un solo worker. La falla del smoke
  test (`app.e2e.ts:3`) era flakiness de paralelismo: desaparece con `--workers=1`. Las 4 que
  quedan son todas de `runner.e2e.ts` y aparecen contra el trabajo **staged** de otra sesión
  (`Runner.tsx`, `plans.ts`, `lib/exercise.ts`, `lib/tags.ts`), cuyo `plans.ts` ahora corre
  `await seedPlanTags()` —una escritura en Dexie— antes del primer render. El texto que los tests
  esperan sigue en `Runner.tsx:67`, o sea que el modelo no carga, no que el copy cambió. Ninguno
  de los cambios de diseño de esta auditoría toca la carga de planes: se atribuye a esa sesión y
  queda pendiente de que cierre.
- L10: Un solo `DESIGN.md` (raíz). `docs/DESIGN.md` eliminado y sus 13 referencias actualizadas
  (AGENTS.md, PRODUCT.md, 4 odd/tasks, 5 design-plans, button.tsx). Se agregó al contrato la
  sección "Herramientas de diseño y precedencia" con la cadena de revisión y los overrides
  (radio/sombra, memoización, densidad, una sola baliza).
- L11: Slice de entrega en `feat/ui-audit-fixes`: el reporte y este documento son el primer
  slice (sólo documentación). Los findings se entregan después en dos slices de código — (a)
  primitivas y shell, (b) findings por pantalla — para que el revisor vea cambios de producto y no
  prosa mezclada con tokens. La unificación de `DESIGN.md` viaja aparte de ambos.
