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

## UI (context menus, 2026-10-21)

- S14: Las acciones de CRUD sobre tarjetas (editar/borrar) se exponen vía menú contextual de shadcn (`ContextMenu`, click derecho / mantener presionado), sin botones directos en la tarjeta.
- S15: La creación se dispara desde un botón "Nuevo" que abre un `DropdownMenu` con las opciones disponibles (no botones directos de creación).
- S16: En la rutina, los ejercicios se pueden reordenar con drag & drop dentro de su bloque; el nuevo orden se persiste.
- S17: El menú contextual del ejercicio incluye "Editar", "Editar video", "Etiquetas" y "Borrar"; el del bloque incluye "Nuevo ejercicio", "Editar bloque", "Borrar bloque".

### Tasks adicionales

- T13 [S14,S15] Migrar Planes/Skill/Program a ContextMenu + botón "Nuevo" con DropdownMenu.
- T14 [S14,S17] Migrar Routine a ContextMenu por bloque/ejercicio, eliminar toggle de edición.
- T15 [S16] Drag & drop de ejercicios + `reorderExercises` en `plans.ts`.
- T16 [S1..S17] Verificación build/test/lint/e2e.

## Log

- L4: Nuevo requisito usuario: "quiero cruds sobre planes modelos rutinas. usa skills de shadcn para acceder a componentes y ejemplos de cruds en las cards. no pongas botones directamente sino aprovecha los menus contextuales que hay en shadcn." Además: ejercicios editables en URL video, renombrar, borrar, reordenar con drag and drop; creación mediante botón que abre menú con opciones; elegir mejor diseño alineado a la UX.
- L5: Implementado: instalado `context-menu` de shadcn; migradas Planes/Skill/Program/Routine a `ContextMenu`; acciones por tarjeta sin botones directos; creación vía botón "Nuevo"/"Acciones" con `DropdownMenu`; drag & drop de ejercicios con `reorderExercises`; menús contextuales de bloque/ejercicio con edición de video, etiquetas y borrado.
- L6: Verificación: `npm test` (84 ok), `npm run build` (ok), `npm run lint` (solo warnings preexistentes), `npm run test:e2e` (28 ok). Smoke test temporal de context menu (crear menú y click derecho) pasó en mobile y desktop y se eliminó.

- L7: Ajuste UX mobile: además del menú contextual (long-press), se agregó un botón “⋯” visible solo en mobile (`sm:hidden`) que abre el mismo menú de acciones por tarjeta/bloque/ejercicio, para mejorar descubribilidad en touch.

- L8: Todos los borrados usan AlertDialog de confirmación (incluido borrar programa, que antes usaba window.confirm).

- L9: Botón “⋯” visible en todos los tamaños (no solo mobile) para descubrir opciones CRUD, además del menú contextual.

- L10: Creación de rutina mejorada: selector de ejercicios existentes o creación nueva en el diálogo, y drag & drop entre bloques además de reordenamiento.

- L11: Mejorada descubribilidad de creación de ejercicios: estado vacío con botón “+ Agregar ejercicio”, opción en menú “Nuevo” y menú contextual del bloque.

- L12: Restaurado modo edición explícito en rutinas: se entra con “Editar rutina” (botón o menú contextual) y solo en ese modo se muestran acciones CRUD/drag & drop.

- L13: Ajuste UX: eliminado botón “Nuevo” del encabezado de rutina; acciones de agregar bloque/ejercicio vía botones “Agregar” dentro de la rutina y bloque, más menú contextual.

- L14: Modo edición ahora ofrece un constructor visual (playground): panel de ejercicios con búsqueda/creación y bloques como zonas de soltar, arrastrando ejercicios al bloque; mantiene edición por tarjeta.

- L15: Eliminados botones redundantes de agregar ejercicio (encabezado de bloque y estado vacío); se mantiene el panel de ejercicios y el menú contextual.

- L16: Simplificado el diálogo “Crear ejercicio”: eliminado el selector confuso; la selección de existentes se hace arrastrando desde el panel.

- L17: El tipo de bloque se normaliza automáticamente según la cantidad de ejercicios (1=single, 2=biseries, 3+=superseries) al crear/mover/borrar ejercicios.
- L17: El tipo de bloque se normaliza automáticamente según la cantidad de ejercicios (1=single, 2=biseries, 3+=superseries) al crear/mover/borrar ejercicios.
- L18: Eliminado el botón “Agregar bloque” redundante del fondo de la página; queda el del panel de ejercicios.
- L19: Polish impeccable: eliminado kicker above heading (back links), detect sin anti-patrones en rutinas/planes/programas.
- L20: Eliminado el badge “Independiente” de programas (deprecado); se mantiene “En cadena”.
