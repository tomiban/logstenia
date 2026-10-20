# Logstenia

Web PWA minimalista para lanzar la rutina de un día asociado a un plan de calistenia (Pro-gress), con timer interactivo, métricas y videos embebidos. Spec completa: `PLAN.md`.

## Specs

- S1: La app lista categorías → programas → niveles/intensidades → modelos (rutina del día), con % de progreso por programa.
- S2: Detalle de rutina muestra bloques (single/biseries/superseries), ejercicios (reps o tiempo, cadencia, sets, descanso), tiempo total y video por ejercicio con toggle.
- S3: Runner full-screen ejecuta la rutina con estados idle→countdown(3)→work→rest→done, controles +15s/-15s/skip/pausa, y biseries/superseries como bloque.
- S4: Ejercicios por tiempo usan countdown automático; por reps, confirmación manual.
- S5: Al finalizar se guarda Session (fecha, plan, modelo, duración real, completado) en IndexedDB.
- S6: Métricas: sesiones completadas, streak, tiempo total, volumen, holds por semana (línea), metas con barra de progreso.
- S7: Progreso semanal S1..S8 por ejercicio estrella, con input de valor.
- S8: Videos embebidos como iframe YouTube con búsqueda por nombre de ejercicio, ocultables.
- S9: Reglas de conexión mostradas como sugerencias/alertas (movilidad antes de fuerza, resistencia alterna con fuerza 48h, no combinar refuerzo handstand con otra rutina).
- S10: Tema light por defecto; sonido "pokemon item found" (asset local) al terminar descanso, configurable.
- S11: Un solo usuario, sin login, datos locales (IndexedDB). Backup JSON fuera del MVP.
- S12: Datos de planes en `src/data/plans.json` generado una vez desde los PDFs mediante script de parsing.

## Tasks

- T1 [S12] F0: setup del repo (Vite+React+TS, ESLint, PWA base, tema light). Route: inline.
- T2 [S12] F1: script de parsing PDF→JSON y validación de muestra. Route: inline.
- T3 [S1,S2] F2: navegación y listado (Home, Programa, Rutina detalle). Route: inline.
- T4 [S3,S4,S5] F3: runner/timer con estados y controles + persistencia de sesión. Route: inline.
- T5 [S8] F4: videos (iframe + toggle). Route: inline.
- T6 [S6,S7] F5-F6: persistencia Dexie + métricas + progreso semanal + metas. Route: inline.
- T7 [S9] F7: reglas de conexión (sugerencias y alertas). Route: inline.
- T8 [S10,S11] F8: PWA (offline, install) + ajustes + polish + accesibilidad. Route: inline.
- T9 [S1..S12] F9: tests + docs (README). Route: inline.

## Log

- L1: Solicitud original del usuario: revisar PDFs de planes de calistenia y armar app para lanzar rutina de un día con timer interactivo, métricas, videos. Plan en PLAN.md.
- L2: Decisiones cerradas: tema light, sonido pokemon item found (asset local), backup JSON fuera del MVP, un solo usuario, español. Branch feat/logstenia creado. Estructura ODD inicializada.
- L3: Verificación de calidad: tests (vitest) 3/3 ok, build (tsc+vite) ok, lint (oxlint) solo warning no bloqueante en Progress.tsx. Corregido bug de orden de hooks en Runner.tsx (early return antes de hooks). Sonido y persistencia de sesión verificados por inspección.
- L4: Lint limpio de errores; Progress.tsx usa useCallback para carga inicial. MVP funcional para Cardio; v2 pendiente (curación de programas, metas, backup).
- L5: Design system minimalista: primitivas `src/ui` (Button, Card, Input, Select, Badge, cn) y tokens en `index.css`. Refactor de Home, Program, Routine, Runner, Metrics, Progress, Settings para usar primitivas. Build/tests/lint OK.
- L6: Optimización: lazy loading de rutas + code splitting (vendor react/router), índices precomputados en plans.ts (evita N+1), useMemo en Progress, bundle inicial reducido a ~99KB (react vendor separado). Imágenes/fonts ya livianas. Lint/tests/build OK.