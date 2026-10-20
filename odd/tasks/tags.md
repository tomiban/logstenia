# Tags para rutinas y ejercicios

Fundación para clasificar rutinas y ejercicios con etiquetas definidas por el usuario,
persistidas en Dexie, aplicables a futuro para filtrar y agrupar.

## Specs

- S1: Tabla `tags` en Dexie (v3): `{ id, targetType, targetId, tag }`, indexada por
  targetType+targetId y por tag.
- S2: Helpers en `app/src/lib/tags.ts`: getTags, addTag, removeTag, allTags, tagTargets.
- S3: Tipos `tags?: string[]` opcionales en Exercise/Model/Program (datos estáticos).
- S4: UI de etiquetas en la página de Rutina: chips + input para agregar/quitar en la
  rutina y en cada ejercicio.
- S5: UI de etiquetas en la página de Programa.
- S6: Filtro por etiqueta en Home ("Planes iniciados").
- S7: Export/import incluye tags.

## Tasks

- T1 [S1,S2] Dexie v3 tags + helpers + tests. Route: inline.
- T2 [S3] Tipos opcionales tags en types. Route: inline.
- T3 [S4] TagInput component + integración en Routine. Route: inline.
- T4 [S5] Integración en Program. Route: inline.
- T5 [S6] Filtro por tag en Home. Route: inline.
- T6 [S7] Export/import tags. Route: inline.
- T7 Verificación build/tests/lint. Route: inline.

## Log

- L1: Solicitud del usuario: crear tags para rutinas y ejercicios para clasificar a futuro.