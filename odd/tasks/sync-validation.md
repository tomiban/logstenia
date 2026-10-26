# Validación del envelope con zod (Worker)

Reemplazar la validación manual del body de `POST /api/sync` por un schema de zod, sin mover el
contrato de la API. Rama: `multi-user` (mismo feature en curso) o `sync-validation` si se corta.

## Specs

S1. El envelope del `POST /api/sync` se declara una sola vez con zod: tipo y validación en el
    mismo lugar, en vez de la interface `Mutation` más el parser a mano.
    (Usuario: "si usa zod")

S2. El contrato de error se preserva **exactamente**: `invalid_json` 400, `invalid_body` 400,
    `invalid_entity` 400, `too_many_mutations` 400, `payload_too_large` 413. Ningún cliente
    existente cambia de comportamiento.

S3. Los campos desconocidos del body se descartan y nunca se escriben, incluido `owner`
    provisto por el cliente.

S4. `updatedAt` conserva la semántica actual: se acepta cualquier string parseable por
    `Date.parse`. No se usa `z.string().datetime()`, que es más estricto y rompería clientes.

S5. `row` se guarda tal cual llega, sin transformación; ausente o `null` se persiste como
    `null`. El payload sigue opaco: zod valida el envelope, no la forma de la entidad.

S6. La validación de query params (`since`, `limit`) no cambia: `parseInteger` se queda como
    está para no alterar `invalid_since` / `invalid_limit`.

S7. La allowlist de entidades sigue siendo la única fuente de `invalid_entity`.

S8. zod entra como dependencia de producción del Worker; `lint`, `typecheck` y la suite siguen
    en verde, y el bundle deployado sigue siendo razonable.

## Tasks

| ID | Specs | Alcance | Ruta | Commit |
| --- | --- | --- | --- | --- |
| T1 | S1, S3-S5 | `worker/src/sync/schema.ts` con el schema + tests de contrato (RED primero) | worker | — |
| T2 | S2, S6, S7 | Cablear el schema en `index.ts`, borrar el parser manual, preservar códigos de error | worker | — |
| T3 | S8 | Verificación independiente (dependencia nueva + contrato) y hook GGA | verify | — |

## Log

L1 (usuario, verbatim): "si usa zod"

L2 (decisión, análisis previo): se ofreció Valibot (~2 KB gzip) por sobre zod (~14 KB), pero el
usuario eligió zod. Se usa el paquete estándar (no `zod/mini`) por DX y mensajes; el costo es
cold start, no CPU.

L3 (alcance): zod valida el **envelope**, no el `row`. El payload sigue opaco por decisión S10
de `multi-user.md`; un `row: null` en fila viva sigue pasando, y eso es explícito.

L4 (presupuesto de bundle, medido con esbuild + gzip sobre `src/index.ts`):

| Variante | Min | Gzip |
| --- | --- | --- |
| Worker sin la ruta de sync (HEAD) | 28 KB | **10.0 KB** |
| `zod` estándar | 467.7 KB | **100.6 KB** |
| `zod/mini` | 41.6 KB | **15.5 KB** |

La estimación inicial de "~14 KB gzip" era del tamaño de la librería sola con un schema mínimo, no
del bundle con el schema real: zod estándar costaba 91 KB de delta. Se migró a `zod/mini` (mismo
paquete, misma API pública de `parsePushBody`) y el costo real queda en **+5.6 KB gzip** sobre HEAD.
Los 11 tests de schema pasaron sin cambios de fuente, que es la prueba de que el contrato no se
movió.

L5 (delta de contrato intencional y aislado): `deviceId: ''` ahora responde `400 invalid_body` en
vez de `200`. El cliente no puede enviarlo (`deviceIdValue()` regenera `dev_<uuid>` cuando el valor
guardado no es un string no vacío) y queda pineado por test.

L6 (verificación independiente, PASSED sin blockers): la verificación corrió un diferencial de 69
casos contra el parser previo sobre el mismo estado de SQLite y confirmó que **el único delta es el
de L5**: status, content-type y cuerpo byte a byte en todo lo demás. También verificó que las cinco
sentencias y el orden de `bind(...)` son runtime-idénticos y que no se perdió ningún predicado de
`owner` en la mudanza a capas.

L7 (delta nuevo, por el hueco del payload opaco): `row` deja de ser `unknown` y tiene que ser un
objeto plano, `null` o ausente. Un string, número, booleano o array responde `invalid_body`. El
payload sigue opaco (no se valida ningún campo) y sigue pasando sin transformar, pero el servidor
deja de replicar basura que del lado cliente produce una fila sin campos (`payloadOf()` devuelve
`{}`). Es el caso de corrupción silenciosa señalado al evaluar el diseño; no compra ninguno de los
costos de tablas tipadas.

L8 (deuda de tests cerrada): el verificador detectó una aserción duplicada en
`schema.test.ts:158-162` (re-parseaba `[]` en vez del caso sin `mutations`) y tres huecos sin pin:
`mutations` no-array, `deletedAt` de tipo inválido, y el passthrough de `row`. Los cuatro quedan
cubiertos.
