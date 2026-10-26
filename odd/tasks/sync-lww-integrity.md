# Integridad del cursor y del LWW en el sync (Worker)

Cerrar las tres fragilidades del espejo `rows(owner, entity, id, rev, …)` que sí pueden morder:
la ventana de lost-update entre dos transacciones, la amplificación de reintentos y el reloj de
cliente como clave de LWW. Rama: `multi-user` (mismo feature en curso) o `sync-integrity` si se corta.

## Specs

S1. Un push es **una sola transacción**: el lookup de `updated_at` existente, la asignación de
    `rev` y los upserts viajan en el mismo `db.batch`. (Usuario, pregunta que originó esto:
    "esto es correcto? o es fragil?" — hoy `readExistingUpdatedAt` y `writeMutations` son dos
    batches distintos, así que dos pushes concurrentes sobre la misma fila pasan los dos el
    chequeo LWW y el más viejo puede commitear último y ganar con el `rev` más alto, dejando a
    todos los dispositivos convergiendo al valor equivocado.)

S2. El invariante que sostiene el cursor queda escrito donde vive el código: la asignación de
    `rev` no puede separarse de los upserts, porque `rev > since` solo es correcto si el orden de
    asignación coincide con el orden de commit, y eso lo garantiza la transacción única — no el
    esquema. Si esa `UPDATE` se mueve a su propio round trip, un dispositivo puede leer `rev`
    102, adelantar el cursor y no leer nunca la 101 que commitea después, perdiendo la fila para
    siempre y sin error visible.

S3. Si `updatedAt` y el payload de una mutación son idénticos a la fila almacenada, el push no
    escribe y no consume `rev`. Un reintento por respuesta perdida no puede re-broadcastear la
    fila a los demás dispositivos del dueño: la idempotencia tiene que valer también en costo de
    propagación, no solo en contenido.

S4. `updatedAt` de un cliente adelantado no puede ganar todos los conflictos: el servidor lo acota
    a su propio reloj más una tolerancia y persiste el valor acotado. **No se agrega `received_at`**:
    la columna no compra corrección, solo auditoría, y no hay migración de esquema en esta spec.

S5. El acotado reemplaza al rechazo: un `updatedAt` en el futuro se **aplica acotado**, no se
    rechaza. Rechazar cambiaría un conflicto mal resuelto por un dispositivo que deja de
    sincronizar en silencio, que es peor y más difícil de diagnosticar.

S6. El fallback de payload vacío del merge deja de ser silencioso: se cuenta y se expone en
    Ajustes, y `docs/DEPLOY.md` documenta el procedimiento para reparar una fila mala en D1
    (incluido cómo detectarla y qué escribir).

S7. El contrato de la API no cambia: ningún código de error, campo ni orden de respuesta distinto,
    y los tests existentes del Worker y del cliente pasan sin tocarlos — solo se agregan nuevos.

## Tasks

| ID | Specs | Alcance | Ruta | Commit |
| --- | --- | --- | --- | --- |
| T1 | S1, S2 | `sync/service.ts` + `sync/queries.ts`: lookup LWW dentro del batch de asignación y upserts, más el comentario-invariante. Test RED del lost-update (el push viejo gana después del nuevo) | worker | — |
| T2 | S3 | Guarda de no-op en el push, antes de aceptar; test de push duplicado: `rev` sin cambio y nada nuevo en el pull del mismo dueño | worker | — |
| T3 | S4, S5 | Acotado de `updatedAt` contra el reloj del servidor con tolerancia; tests de reloj adelantado y atrasado | worker | — |
| T4 | S6 | Contador del fallback vacío en `repositories/sync/merge.ts` + superficie en Ajustes | app | — |
| T5 | S6 | Runbook de reparación de fila en `docs/DEPLOY.md` | docs | — |
| T6 | S7 | Verificación independiente: diferencial de contrato contra HEAD + suite completa de Worker y app | verify | — |

## Log

L1 (usuario, verbatim): "crea una spec para trabajar esto"

L2 (usuario, verbatim, la pregunta que originó el alcance): "esto es correcto? o es fragil?"

L3 (alcance): entran las tres fragilidades que pueden morder de verdad — lost-update (S1/S2),
amplificación de reintentos (S3) y reloj de cliente (S4/S5). Quedan afuera las que no valen un
cambio de esquema a esta escala: GC de tombstones, sharding del contador global, `WITHOUT ROWID`,
y la fuga de volumen de escritura a través de los huecos de `rev`.

L4 (corrección al análisis previo — `received_at`): había propuesto una columna `received_at` para
desempatar LWW. Al spec'earla se cae: el skew se detecta comparando `updatedAt` contra el reloj del
servidor **en el request**, sin columna, sin migración y sin backfill de las filas existentes. La
columna solo aportaría auditoría posterior, que no es un requisito. Se descarta, y con ella el
riesgo item 1 (migración de esquema) de esta spec.

L5 (corrección al análisis previo — cuarentena): había propuesto "cuarentena de payload" en el
cliente. `sync-validation` L7 ya hizo que el servidor rechace un `row` escalar o array, y
`payloadOf()` ya degrada a `{}` en vez de romper el merge, así que el riesgo residual es una fila
mal formada **por dentro de un objeto válido**. Detectarla exigiría conocimiento de entidad en
`merge.ts`, que el diseño evita a propósito. Lo que falta no es cuarentena sino observabilidad
(S6): que el fallback vacío deje de ser invisible.

L6 (riesgo): item 1 — cambia cómo se escriben las filas y un error se detecta tarde, en datos ya
replicados. item 6 — el harness local es single-threaded: el test de T1 cubre el **orden** de las
sentencias dentro del batch, no el paralelismo real de D1. Por eso T6 corre verificación
independiente y diferencial de contrato; el paralelismo real queda como invariante documentado en
S2, no como test.

L7 (lo que NO entra, para que no se asuma cubierto): partición por owner en el cliente, guarda
anti-contaminación del outbox, `exerciseId` inmutable, merge unit por programa y curación del
catálogo. Son features separadas y siguen pendientes.
