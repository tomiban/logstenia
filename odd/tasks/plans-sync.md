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

L4 (T1+T2, commit `a7cfc88`): `DB_VERSION` 1005. El store deja de recrearse en cada upgrade y en
su lugar migra el documento `{ id: 'root', data }` a una fila por categoría
(`{ id, category, position, updatedAt, deletedAt }`), de forma idempotente: una base que ya tiene
filas por categoría no se re-migra ni duplica, una fila `root` vieja se elimina, y la fila de
versión del catálogo de videos no se toca. `load()` reconstruye el `PlanData` ordenando por
`position` y valida el payload guardado con un guard mínimo antes de entregarlo a la UI;
`save()` diffea por categoría, escribe solo lo que cambió y marca `deletedAt` en las que
desaparecen (la forma que el sync necesita). **`plans.ts` no se tocó.**

Prueba del defecto, sobre un fixture v1003 con el catálogo editado: el código anterior dejaba
**cero filas**; el nuevo conserva las dos categorías con el payload editado y en orden.
Deuda cerrada de paso, exigida por el hook de review: `PlansData.categories` pasó de `any[]` a
`Category[]`.

L5 (T3 en curso): `'plans'` entra en `ENTITY_NAMES` y en la allowlist del Worker, y `save()` rutea
sus escrituras por `withOutboxWrite` para que la fila y su entrada de outbox sean atómicas. La fila
de metadata (`video-catalog-version`) nunca se encola.

L6 (hallazgo de T3, bloqueante para T4): **el seed ahora encola**. Como `save()` es el único camino
de escritura, `seedIfEmpty()` hereda el outbox y un dispositivo nuevo publica sus siete categorías
con `updatedAt` de este momento. Bajo LWW por categoría, eso significa que **estrenar un dispositivo
puede pisar las categorías editadas en el otro**, porque el seed es "más nuevo" que la edición
real. T4 tiene que decidir el orden seed-vs-pull antes de habilitar el seed con sync: la opción
razonable es no encolar el seed y dejar que el pull mande, o sellarlo con el timestamp del catálogo
curado y no con `Date.now()`.

L7 (límite conocido de T3): una categoría que llega por pull se escribe en el store, pero **la UI no
se refresca**: `plans.ts` cachea en memoria y ningún consumidor escucha `onPulledRows` para `plans`.
El dato está en IndexedDB y la pantalla queda vieja hasta recargar. Es de T4.

L8 (decisión para T4, el seed no debe ganar nunca): el seed se sellará con un `updatedAt` **viejo y
constante** (no `Date.now()`). El LWW solo compara contra filas existentes, así que los tres casos
salen bien sin coordinación: servidor vacío → no hay contra qué comparar y el seed se publica (el
catálogo viaja al segundo dispositivo); servidor con la categoría editada → el seed pierde y se
rechaza como `stale_server_newer` (instalar en un dispositivo nuevo no borra lo editado en otro);
dispositivo nuevo sobre servidor poblado → siembra local viejo y el pull gana. La alternativa "no
encolar el seed" falla en el caso base: si nadie lo publica, el segundo dispositivo nunca lo recibe.

L9 (deuda de infraestructura de test, no de producto): el e2e de runner es **no determinístico**
bajo carga. El síntoma es siempre el mismo — la página queda en `Cargando…` (el `Suspense` del chunk
lazy) cuando el `expect` de 5 s vence — y ocurre igual antes y después de los cambios de este
feature (base: 1-3 fallos por corrida; con `--retries=2`: 34/34). El fix de fondo es precargar la
ruta o subir el timeout del chunk, no acumular retries para siempre.

L10 (review nativo de T4, `approved` y burned): el candidato completo (44 archivos, ~3400 líneas) no
entra en el presupuesto del reviewer (`lens_context_budget_exceeded`, que **no** se puede reintentar
ni truncar). Se revisó T4 solo con `baseRef=3d73238` (4 archivos, 287 líneas, tier medium) y el
resto de los commits ya tenía su gate por unidad. Cuatro findings non-blocking, dos reales:

- **R3-a**: al tipar `normalizeBlockType(block: Block)` se quitó el guard `!block`. Ningún caller lo
  alcanza con `null`, pero es robustez perdida a cambio de nada; decidir si se repone.
- **R3-b**: el refresh de catálogo tras un pull traga el error de `load()`. Es el mismo patrón que el
  bug de autosave del runner: una lectura que falla deja estado viejo en silencio. Aplicar el mismo
  criterio (arrancar sin datos y avisar, no quedarse callado).

L11 (limitaciones conocidas del catálogo sincronizado, no bloqueantes):

- **Vaciado que resucita**: `load()` devuelve `null` cuando no quedan filas vivas, así que borrar
  *todas* las categorías hace que el próximo `initPlans()` las re-siembre desde `plans.json`. Falta
  un flag persistido que distinga "nunca sembrado" de "vaciado por el usuario".
- **Posiciones duplicadas**: si dos dispositivos reordenan categorías distintas a la vez, ambos
  `position` pueden colisionar y el orden cae a la estabilidad del sort. Fuera del alcance de S7.
- **Última categoría borrada**: si un pull borra la última, el refresh retorna temprano y la UI queda
  vieja hasta recargar. Deliberado: limpiar el cache haría que el próximo write tombstone todo.

L12 (cierre de los findings del review de T4):

- **R3-a resuelto sin reponer el guard**: `normalizeBlockType(block: Block)` recibe siempre un bloque
  existente (los cinco callers iteran bloques o los reciben ya resueltos), así que un `!block` sería
  código muerto que contradice la firma. Se mantiene el tipo estricto en vez de un guard que no puede
  dispararse.
- **R3-b resuelto**: el refresh tras un pull ya no deja la promesa sin dueño. Si la lectura falla, se
  conserva el catálogo anterior (mismo criterio que la última categoría) y el fallo queda observable en
  `getPlansRefreshError()`, que el próximo pull exitoso limpia.
- **Vaciado que resucita, resuelto**: `plansRepository` persiste un marcador `catalogue-seeded` y
  `seedIfEmpty` no siembra si ya se sembró alguna vez. Un catálogo guardado antes de existir el marcador
  se adopta como sembrado en el próximo init, así que vaciarlo también queda vacío. El marcador es local
  (no viaja por sync): cada dispositivo sabe si alguna vez tuvo catálogo.
