# Dashboard (Hoy) — mesociclo, marcas y selector por énfasis

Spec: odd/tasks/dashboard.md. Implementa el dashboard "Hoy" adaptado de la referencia
`clean-architecture/calistenia/app/src/Hoy.jsx` al stack de Logtenia (Dexie + plans.json).

## Specs

- S1: La Home muestra un card de Mesociclo con fecha de inicio (input date), semana actual
  (1..4), barra de progreso y días restantes para la descarga; persistido en settings.
- S2: La Home muestra un grid de 7 días de la semana actual con marca de días entrenados
  (desde sesiones Dexie) y marca "M" el primer día del mesociclo.
- S3: Toggle de calentamiento persistido en settings.
- S4: En el primer día del mesociclo se muestra el card "Toma de marcas" con los 6 ejercicios
  ancla; al guardar se registra una marca (tabla marks) con valor y unidad.
- S5: Card "Planes iniciados" con una card por programa con sesiones registradas: nombre,
  nivel, sesiones, modelos completados/total, mejor marca (segundos/reps) y barra de progreso.
- S6: Card de sugerencia del grupo que toca esta semana (rotación por sesiones realizadas),
  con botón Entrenar/Retomar.
- S7: Card "Últimos entrenamientos" con las últimas 5 sesiones (una por día+sesión) y su mejor
  valor.
- S8: Clasificación de énfasis por modelo derivada de los nombres de ejercicios (port de
  clasificar.js), con tests.
- S9: Persistencia de mesociclo y marcas en Dexie (schema v2, tabla marks); migración sin pérdida.
- S10: Import/export de estado extendido para incluir meso y marks (ya cubierto por settings
  + tabla marks; export agrega marks).

## Tasks

- T1 [S8] Añadir `app/src/lib/clasificar.ts` portado y tests. Route: inline.
- T2 [S9] Bump Dexie a v2 con tabla `marks` + migración. Route: inline.
- T3 [S1,S9] Persistencia de mesociclo (`meso.inicio`) y warmup en settings. Route: inline.
- T4 [S4,S9] Persistencia de marcas (tabla marks) + helpers. Route: inline.
- T5 [S1-S7] Reescribir `app/src/pages/Home.tsx` como dashboard adaptado. Route: inline.
- T6 [S5,S8] Tests de clasificación y de helpers de dashboard (ultimasSesiones, gruposPorIntensidad). Route: inline.
- T7 [S10] Extender export/import para incluir marks. Route: inline.
- T8 [S1-S7] Verificación: build, lint, tests. Route: inline.

## Log

- L1: Solicitud del usuario: adaptar dashboard Hoy (referencia clean-architecture) a Logtenia, alcance completo (mesociclo + marcas + énfasis).
- L2: Ajuste: se reemplaza "¿Qué entrenar hoy?" por "Planes iniciados" con progreso por segundos/PRs personales.
- L3: Un plan se considera iniciado solo con sesiones completadas. Planes de progresión superior bloqueados (read-only) hasta cumplir marcas (isUnlocked en Program).