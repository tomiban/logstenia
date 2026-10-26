# Capa de servicio del Worker (Hono estándar)

Separar el Worker en las tres capas que Hono documenta y usa la comunidad: router fino → service
(sesión de dominio) → queries (SQL). Rama: `multi-user`.

## Specs

S1. Se extrae la capa de servicio del Worker. (Usuario: "si")

S2. `owner` es el **primer parámetro obligatorio** de cada query en `sync/queries.ts`: una query
    nueva no se puede escribir sin dueño, así el aislamiento deja de depender de recordar el
    `WHERE`.

S3. `sync/service.ts` contiene la lógica de dominio sin HTTP: `pushMutations(db, owner, mutations)`
    y `pullChanges(db, owner, since, limit)`, incluida la comparación LWW, la asignación posicional
    de `rev` y el batching.

S4. `index.ts` queda como router: status codes, límites de tamaño y cantidad, validación de query
    params (`invalid_since` / `invalid_limit`) y mapeo de errores. Sin SQL.

S5. Los errores de dominio viajan como `HTTPException`; `app.onError` responde JSON en lugar del
    HTML 500 de la plataforma, para que un fallo del servidor no se convierta en un reintento
    infinito del cliente.

S6. El contrato no se mueve: los 70 tests existentes pasan **sin tocarlos** y ningún código ni
    cuerpo de error cambia.

S7. Sin sobre-ingeniería: no se agregan interfaces de repositorio, contenedor de DI, DTOs ni
    entidades. `toChange()` ya es el DTO y el payload sigue opaco.

## Tasks

| ID | Specs | Alcance | Ruta | Commit |
| --- | --- | --- | --- | --- |
| T1 | S2, S3, S7 | `sync/queries.ts` + `sync/service.ts` con owner obligatorio | worker | — |
| T2 | S4, S5 | `index.ts` como router fino + `app.onError` con `HTTPException` | worker | — |
| T3 | S5, S6 | Test de `onError` (DB rota → JSON 500) y suite intacta | worker | — |

## Log

L1 (usuario, verbatim): "si"

L2 (estándar consultado): los artículos de Medium sobre Hono convergen en router fino → service →
db, con schemas zod como fuente única de verdad y errores vía `HTTPException` capturados por
`app.onError`. El mismo material advierte contra "unnecessary layers when not needed" y señala que
con un ORM o un motor SQL directo no hacen falta clases de repositorio.

L3 (alcance): se toma la mitad del estándar (service + queries + onError) y se descarta el exceso
(interfaces, DI, DTOs, entidades) porque el Worker tiene dos endpoints y dos tablas.

L4 (decisión de test): `onError` se verifica con una DB real rota (`DROP TABLE meta`) para probar
que la respuesta es JSON 500 y no el HTML de la plataforma.

L5 (resultado medido): `index.ts` pasó de **305 a 110 líneas**; el resto quedó en `queries.ts` 146,
`service.ts` 106 y `schema.ts` 106. Suite del Worker **72/72**, lint y typecheck limpios, bundle
**15 KB gzip** (sin cambios respecto de zod/mini: mover código entre módulos no cuesta bundle).
Los cinco statements y el orden de `bind(...)` compararon byte a byte contra el `index.ts` previo,
la truncación de 33 triples y la derivación posicional de `rev` se conservaron, y no se perdió
ningún predicado de `owner` en la mudanza. Cambio de contrato: ninguno.

L6 (verificación independiente, PASSED sin blockers): confirmó los dos puntos anteriores con
probes propios y agregó tres precisiones:

- **`onError` con `res` (should-fix)**: un `HTTPException` construido con `{ res }` devolvía
  `{"message":""}` y perdía el payload custom. Se pasa a usar `error.getResponse()` en esa rama.
- **Un `throw` que no sea `Error` todavía escapa como HTML 500**: Hono re-lanza los no-Error y no
  llegan a `onError`. Hoy es inalcanzable porque todos los sitios lanzan `Error`, pero queda como
  nota: el invariante "ningún throw escapa" es del código, no de la plataforma.
- **`owner` primero es convención, no invariante**: las constantes SQL son privadas del módulo (ese
  es el guard real) y `readRev(db)` es la excepción de letra, justificada porque `meta.rev` es
  global por diseño. Anotado para no sobrevender S2.

L7 (bundle, medición del verificador): 16.1 KB gzip contra 10.2 de baseline, frente a los 15.5/10.0
propios. La diferencia es la metodología de gzip; el orden de magnitud y la conclusión no cambian.
