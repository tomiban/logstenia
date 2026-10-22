# Logstenia Program Links

Relación configurable entre programas por dificultad (más fácil / más difícil), con desbloqueo del programa más difícil al completar el anterior.

## Specs

- S1: `Program` puede tener `easierProgramId` y `harderProgramId` opcionales, formando cadenas de progresión configurables.
- S2: Al crear un programa se puede elegir relación con otro programa de la misma categoría: sin relación, más difícil que…, o más fácil que….
- S3: Al editar un programa se puede cambiar o quitar esa relación; los enlaces se mantienen consistentes en ambos extremos.
- S4: Borrar un programa limpia las referencias de progresión hacia él.
- S5: Un programa más difícil ligado dinámicamente se desbloquea cuando el más fácil está completado (todas sus rutinas con sesión completada; si no tiene rutinas, cuando está iniciado).
- S6: La relación se muestra en la tarjeta del programa y en su detalle.
- S7: Las cadenas dinámicas se exponen vía `chainFor` cuando tienen más de un paso.

## Tasks

- T1 [S1] Agregar campos opcionales a `Program`.
- T2 [S2,S3] CRUD de relación en `plans.ts` (`setProgramRelation`, `unlinkProgram`).
- T3 [S5] Cadenas dinámicas y desbloqueo por finalización en `progression.ts`.
- T4 [S2,S3,S6] UI en `Skill.tsx` (creación/edición + badges).
- T5 [S6] UI en `Program.tsx` (enlaces más fácil/más difícil).
- T6 [S1..S7] Verificación build/test/lint/e2e.

## Log

- L1: Solicitud original del usuario: al crear un nuevo plan poder linkearlo con un programa más fácil o más difícil (o no), e identificar esa relación entre programas.
- L2: Implementación inicial: campos opcionales, relación configurable, desbloqueo por finalización del anterior, badges/enlaces en UI. Build, tests (84), lint y e2e (28) OK.
- L3: Refactor UX: inserción visual por slots en la cadena, cadena visual con flechas y badges de nivel, programas independientes separados. Reconexión de huecos al desvincular. Build, tests (84), lint y e2e (28) OK.
- L4: Cambio a jerarquía basada en etiquetas: programas que comparten una etiqueta forman una cadena ordenada por nivel (principiante→intermedio→avanzado); desbloqueo por finalización del anterior. UI de etiquetas en crear/editar. Build, tests (84), e2e (28) OK.