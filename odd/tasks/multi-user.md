# Multiusuario por owner (sync v2)

Aislar los datos de cada persona en el mismo Worker + D1, con el owner derivado del JWT que
Access ya emite. Diseño de referencia: `design-plans/multi-user.md`. Rama: `multi-user`.

## Specs

S1. Cinco personas, cada una con sus propios datos: lo que escribe una persona no aparece en
    el pull de otra. (Usuario: "5 personas por ahora. cada uno con sus datos.")

S2. El owner sale únicamente del JWT de Access ya verificado; el cliente nunca lo provee. Un
    JWT válido sin `email` responde `401 no_email`. Única excepción: el bypass de loopback de
    desarrollo, que acepta `x-dev-owner` (default `dev@local`) y solo bajo flag exacto
    (`SYNC_DEV_NO_AUTH === "true"`) + host de loopback.

S3. El email se normaliza una sola vez con `trim().toLowerCase()` y en un único lugar; el
    resto del Worker consume la identidad ya normalizada.

S4. `GET /api/sync` → `WHERE owner = ? AND rev > ? ORDER BY rev LIMIT ?`, servido por el
    índice `(owner, rev)`.

S5. `POST /api/sync` → lookup por triples `(owner, entity, id)` con ≤33 triples por statement
    (≤99 parámetros, bajo el límite de 100 de D1), upsert `ON CONFLICT (owner, entity, id)`.
    La comparación LWW y la asignación posicional de `rev` no cambian; `meta.rev` sigue
    global y monotónico para todos.

S6. Migración `0002_owner.sql`: reconstruye `rows` con la PK nueva y deja las filas
    existentes en `legacy@local`; la adopción al email real es `npm run adopt -- <email>`, que
    normaliza con las mismas reglas que la app (JavaScript, no `lower()` de SQLite), escapa
    comillas y termina en error si alguna fila sigue en `legacy@local`. Ninguna fila queda
    huérfana al terminar el deploy.

S7. Sin cambios de forma en el contrato: el cliente no manda ni recibe `owner`. Se agrega
    `user` (el email del propio llamante) a la respuesta del `GET`. Nunca se expone el email
    de otra persona.

S8. Ajustes muestra `Sesión: <email>`; `sync.user` es clave local-only (prefijo `sync.`, ya
    excluida del outbox, del pull y del backup).

S9. `entity` se valida contra la allowlist de las seis entidades sincronizadas; una mutación
    con entidad desconocida se rechaza con `400 invalid_entity` y no se escribe.

S10. Fuera de alcance, por decisión explícita: tablas tipadas y ORM; compartir datos entre
    personas; DB local por usuario (v2 de `design-plans/multi-user.md` §4); endpoints de
    operación (`/api/me`, export, devices, compact) como feature aparte.

## Tasks

| ID | Specs | Alcance | Ruta | Commit |
| --- | --- | --- | --- | --- |
| T1 | S2, S3 | `access.ts` devuelve `Identity` con email normalizado + tests de claim faltante y normalización | inline | — |
| T2 | S6 | `0002_owner.sql`: rebuild + adopción, test de migración con fixture sobre SQLite real | verify | — (commit solo) |
| T3 | S4, S5, S9 | API scopeada por owner: GET, chunker de 33 triples, upsert, allowlist; tests de aislamiento y cursor | worker | — |
| T4 | S7, S8 | `user` en la respuesta + `sync.user` + `Sesión: <email>` en Ajustes | inline | — |
| T5 | S2 | dev/e2e: `x-dev-owner` bajo bypass + specs de dos owners (aislamiento A≠B, mismo owner A=A') | worker | — |
| T6 | S1, S6 | deploy: migración remota + verificación de que el dueño actual sigue viendo sus filas | inline | — |

## Log

L1 (usuario, verbatim): "ya que usamos una bd. porque no planteamos mas endpoints pensamos
las tablas para multiusuario y vemos de implementar aloi alternativo al raw sql"

L2 (usuario, verbatim): "a (otra persona —pareja, entrenador— con sus propios datos aislados
b porque vamos a preparar para soportar mas usuarios que van a tener sus datos."

L3 (usuario, verbatim): "5 personas por ahora. cada uno con sus datos."

L4 (decisión, análisis): no tablas tipadas ni ORM. Un ORM no tiene qué modelar sobre un
`payload` opaco, y multi-tenant aislado se resuelve con `owner` en la PK: es una dimensión de
partición, no un modelo de dominio. El problema real del SQL no es que sea raw sino que los
tests no tocan D1 (`FakeD1` matchea strings por prefijo). Follow-up separado:
`@cloudflare/vitest-pool-workers`; Drizzle recién con un requisito de consultas server-side.

L5 (hallazgo, análisis): con datos aislados, el dispositivo compartido sigue siendo un riesgo
(DB local única `logstenia` + `sync.cursor` global del navegador). `design-plans/multi-user.md`
§4 lo difiere a v2 y lo declara limitación aceptada; con cinco personas, una por dispositivo,
se acepta y queda anotado.

L6 (plan §9, pendiente): antes de T2 hay que cerrar tres decisiones — adopción de las filas
existentes, `owner` en claro vs hash, y cuándo habilitar varios emails en la política de
Access.

L7 (usuario, decisiones cerradas 2026-10-25):
1. **Adopción**: se adoptan las filas existentes con el email real, vía `UPDATE` paramétrico
   del deploy (sin PII en el repo) y `COUNT(*)` por owner como verificación. Ajusta S6.
2. **Owner**: email normalizado en claro. Sin hash: la función derivada se congelaría para
   siempre y la API nunca expone el owner de otra persona.
3. **Access**: los cinco emails se habilitan **después** de deployar y verificar el
   aislamiento. Habilitarlos antes deja a las cinco personas escribiendo el mismo conjunto
   de filas (el "Caso A" del plan).

L8 (decisión técnica de implementación): la migración y el aislamiento se verifican contra
**SQLite real** vía `node:sqlite` (Node 26, sin flags) en un adaptador de test con la
interfaz de `D1Database`. El `FakeD1` por prefijos de SQL no puede ejecutar DDL ni PK
compuestas, así que no sirve para probar T2. Los tests existentes se mantienen; se actualizan
al nuevo SQL.

L9 (implementación): el `typecheck` del Worker corre dos configuraciones. `tsconfig.json`
cubre `src` con `types: ["@cloudflare/workers-types"]`, y `tsconfig.test.json` agrega `node`
para los tests que leen las migraciones y usan `node:sqlite`; así `src` no puede importar APIs
de Node por accidente. `@types/node` entra como devDependency del Worker (no afecta el bundle
deployado).

L10 (adopción documentada): `docs/DEPLOY.md` §2 y `worker/README.md` documentan el `UPDATE`
paramétrico de adopción, el backup previo y la verificación con `COUNT(*)` por owner. El orden
queda fijado: migrar y verificar el aislamiento **antes** de habilitar el resto de los emails
en la política de Access.

L11 (verificación independiente, PASSED con hallazgos): el verificador corrió la suite en una
copia scratch (47/47, lint y typecheck limpios) y auditó query por query. Confirmó aislamiento
en las cuatro sentencias, contención del bypass (dos condiciones, `x-dev-owner` solo en la rama
de loopback), normalización en un único lugar y cero regresiones contra el comportamiento
single-user. Hallazgos y destino:

- **F1 (should-fix, corregido)**: `lower()` de SQLite es ASCII-only, así que el `UPDATE`
  documentado normalizaba distinto que la app para un email con acentos (`Ñoña@Ejemplo.com`),
  dejando filas inalcanzables con el `COUNT` aparentando salud. Se reemplaza el SQL a mano por
  `npm run adopt -- tu@email.com`, que normaliza en JS con la misma regla que `access.ts` y
  falla si queda alguna fila en `legacy@local`.
- **F3 (should-fix, corregido)**: quitar el predicado `owner` del lookup dejaba los 54 tests en
  verde. El defecto real es interferencia cross-owner (B recibe `stale_server_newer` por una
  fila de A) y un oráculo de existencia. Se agrega `worker/test/owner-binding.test.ts` con los
  cuatro casos y se prueba que discrimina con una mutación en scratch.
- **F2 (nota)**: re-aplicar `0002` a mano re-parkea todas las filas en `legacy@local`. No es
  alcanzable por `wrangler d1 migrations apply` (ledger), pero queda documentado como borde.
- **F4 (nota)**: la atomicidad de la migración depende de la transacción del runner de D1; el
  archivo no abre una propia. Rollback verificado solo al envolverlo.
- **F5 (nota)**: `FakeD1` reimplementa el scoping, así que la suite de prefijos no puede
  detectar bugs de owner; solo los tests con SQLite real muerden. Refuerza el follow-up de
  migrar cobertura a `SqliteD1`.
- **F6 (nota)**: `legacy@local` y `dev@local` no colisionan con emails reales de un IdP.

L12 (e2e completo): `npm run test:e2e` → 34/34 en verde. Los `ECONNREFUSED` de `/api/sync` en
los logs son esperados: esa suite no levanta el Worker y el engine reintenta en background.
