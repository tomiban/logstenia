# Sincronizar el catálogo de planes por persona

El catálogo (`categorías → programas → modelos → bloques → ejercicios`) hoy vive solo en el
dispositivo: `plansRepository` guarda un documento único en el store `plans` y nada de eso entra
al motor de sync. Se sincroniza **por persona**, con una unidad de merge por categoría.

## Specs

S1. El catálogo se sincroniza por persona, con aislamiento por owner como el resto de las
    entidades. (Usuario, eligiendo la opción: "Por persona (7 filas documento, una por
    categoría)").

S2. La unidad de sync es la **categoría**: `entity: 'plans'`, `id: <categoryId>`, payload
    `Category`, más `updatedAt` / `deletedAt` como cualquier fila sincronizada.

S3. La costura es `plansRepository`, no `plans.ts`: `load()` reconstruye el `PlanData` desde las
    filas y `save(data)` escribe solo las categorías que cambiaron. Las 400 líneas de CRUD del
    árbol en `features/plans/plans.ts` **no se tocan**.

S4. El store `plans` deja de recrearse en cada upgrade de base (`db/open.ts` hoy lo borra para
    forzar el re-seed, lo que destruiría el catálogo editado en cada bump). El contenido actual
    (`{ id: 'root' }`) se migra a filas por categoría en la misma versión.

S5. Toda escritura de planes pasa por el outbox en la misma transacción que la fila, igual que
    las otras seis entidades.

S6. `plans` entra en la allowlist del Worker (`SYNC_ENTITY_NAMES`) y el aislamiento por owner
    aplica sin excepción.

S7. Merge LWW por categoría: dos dispositivos editando categorías distintas convergen; editando
    la misma, gana la última. Sin merge por campo.

S8. `plans.json` sigue siendo el seed cuando no hay filas; si el catálogo local está vacío, se
    siembra y se encola para sync.

## Hallazgos que definen el alcance

- `plansRepository` ya está diseñado como costura de storage ("Implementations: idb (local),
  future: HTTP backend"), así que el cambio grande queda contenido ahí.
- **Riesgo item 1 (datos)**: el store se recrea en cada upgrade. Es un borrado de datos del
  usuario disfrazado de re-seed, y hay que migrarlo, no solo evitar el borrado hacia adelante.

## Tasks

| ID | Specs | Alcance | Ruta | Commit |
| --- | --- | --- | --- | --- |
| T1 | S2, S4 | Store `plans` por categoría: dejar de recrearlo y migrar `{ id: 'root' }` a filas | verify | — (riesgo 1) |
| T2 | S3, S5 | `plansRepository.load/save` por categoría + outbox en la misma transacción | inline | — |
| T3 | S6, S7 | Allowlist del Worker + sync de `plans` con aislamiento | worker | — |
| T4 | S8 | Seed cuando no hay filas + tests de merge por categoría | inline | — |
| T5 | S1-S8 | E2E de dos dispositivos con catálogo y verificación independiente | verify | — |

## Log

L1 (usuario, eligiendo la opción presentada): "Por persona (7 filas documento, una por
categoría)". Descarta compartir el catálogo entre personas, que queda como feature de permisos
aparte.

L2 (hallazgo de exploración): `data/plansRepository.ts` guarda un documento único
`{ id: 'root', data: PlanData }`, y `db/open.ts` borra el store `plans` en cada upgrade de
versión "to force a re-seed". Con CRUD de planes eso destruye ediciones del usuario en cada bump
de esquema; la migración tiene que preservarlas.

L3 (corrección de estimación): la opción se presentó como "~150 líneas". Con la costura en
`plansRepository` el cambio queda en ~250 líneas y toca `db/open.ts`, `db/index.ts` y la
allowlist del Worker; sigue siendo contenido, pero no es un cambio de una sola capa.
