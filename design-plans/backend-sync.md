# Plan de diseño: backend de sync multi-dispositivo (Cloudflare Workers + D1)

## Metadatos

- Creado: 2026-10-20
- Branch: `backend`
- Superficie: `app/src/db/`, `app/src/repositories/`, `app/src/features/settings/`, nuevo `worker/`
- Fuente de diseño: `.pi/AGENTS.md`, `PLAN.md` (§6 Persistencia), `app/src/db/open.ts`
- Estado: **propuesta — sin código escrito**
- Decisión de hosting (ver §15): **un solo Worker con static assets + D1**, plan **Free** de
  Workers, hostname `logstenia.<account>.workers.dev`, protegido por **Cloudflare Access**
  (OTP por email).
- Límites verificados (docs de Cloudflare, oct 2026): requests a static assets *gratis e
  ilimitados*, script del Worker 100k requests/día, 10 ms de CPU/request, D1 5M filas
  leídas/día, 100k filas escritas/día, 5 GB de storage, Workers Builds 3.000 min/mes.
  No se pausa por inactividad, no pide tarjeta.

## Objetivo

Persistir los datos de entrenamiento entre dos dispositivos (teléfono y laptop) **sin
perder el offline-first**: Dexie sigue siendo la fuente de verdad local y el backend es un
espejo compartido. Un solo usuario, sin login propio, sin realtime, todo en free tier.

## Fuera de alcance

- Nada de sistema de auth propio, multi-usuario ni compartir datos.
- Nada de analítica ni reportes del lado del servidor (las métricas se calculan en el cliente
  desde Dexie).
- Nada de push en tiempo real (sin WebSocket, sin listeners estilo Firestore, sin polling).
- No se sincroniza `plans.json` (viaja con el build) ni se migra el catálogo de planes al
  servidor.
- No hay UI de resolución de conflictos. Las filas mutables se resuelven por LWW.

## 1. Clasificación de los datos (todo el diseño cuelga de acá)

| Clase | Tablas | Regla de merge | Por qué es seguro |
| --- | --- | --- | --- |
| **Append-only** | `sessions`, `marks` | Unión por id; las filas nunca se editan | Un id nuevo nunca choca con el id de otro dispositivo (UUID). No hace falta merge por campo. |
| **Dormidas** | `progress`, `goals` | Misma regla de unión; se incluyen por compatibilidad futura | Hoy no existe ningún camino de escritura (solo las toca el backup/import JSON). Riesgo cero, beneficio cero hasta que aparezca un escritor. |
| **Mutables** | `settings`, `tags` | Gana la última escritura (LWW) por fila según `updatedAt` | Un solo usuario: dos ediciones contradictorias dentro de la ventana de sync son raras; perder un toggle de ajustes es aceptable. |

Consecuencias:

- `sessions.sets` está **embebido** en la fila de sesión, así que la sesión es la unidad
  atómica. Sin ids por serie y sin merge por serie.
- Las filas de `settings` guardan claves locales del dispositivo (`sync.cursor`,
  `sync.deviceId`, `sync.lastSync`) que **nunca deben salir del dispositivo**. Se excluyen
  con una denylist en los tres caminos hacia afuera: el outbox (push), la aplicación del
  pull y el export JSON de backup (restaurar un backup en otro dispositivo copiaría el
  cursor del dispositivo viejo y saltearía filas del pull). Nunca se guarda una
  credencial: la identidad la aporta Access.
- Los borrados de `tags` tienen que convertirse en lápidas (tombstones); el
  `db.tags.delete(r.id)` actual es un borrado duro y la fila resucitaría en el próximo pull.

## 2. Identidad: autoincrement → UUID

Hoy `sessions`, `progress`, `goals`, `marks` y `tags` usan claves enteras con
`autoIncrement` (`app/src/db/open.ts`). Dos dispositivos generan `id = 7` para filas
distintas de forma independiente.

**Decisión: `id` pasa a ser un string de `crypto.randomUUID()`.** `settings` conserva `key`
como clave primaria (ya es una clave natural estable).

Chequeo previo antes de tocar el esquema (verificar en T1, no asumir):

- `sessions.id` no debe estar referenciado desde otras tablas. Las series están embebidas y
  las métricas se apoyan en `date` / `planId` / `modelId`.
- El backup/import JSON de `SettingsMenu.tsx` reescribe filas enteras con `bulkPut`. La
  importación de un backup viejo (ids numéricos) se debe convertir al leer: asignar un UUID
  cuando `typeof id === 'number'`.

## 3. Cambio de esquema local (`idb`, v1003 → v1004)

Campos que se agregan a toda fila sincronizada:

```ts
interface SyncFields {
  updatedAt: string;         // ISO, reloj del cliente, es la clave de LWW
  deletedAt?: string | null; // lápida ISO, null cuando la fila está viva
}
```

Cambios en los stores:

- Los cinco stores con `autoIncrement` se **borran y recrean** con `keyPath: 'id'` y sin
  `autoIncrement` (el mismo patrón de borrar-y-recrear que ya se usa para `plans` en
  `open.ts`). Las filas existentes se re-clavan con UUIDs durante el upgrade.
- Store nuevo `outbox`:
  ```ts
  { seq: number (autoIncrement), entity: string, id: string,
    updatedAt: string, deletedAt: string | null, row: unknown }
  ```
- Estado local del dispositivo: **claves de `settings`**, porque Ajustes ya las lee y la
  denylist del backup queda en un solo lugar. Claves: `sync.cursor`, `sync.deviceId`,
  `sync.lastSync`. (`sync.auth` desapareció: la credencial la administra Access.)

Atomicidad: una escritura tiene que tocar la tabla **y** el outbox en la misma transacción.
El `makeStore` actual abre una transacción de un solo store por llamada, así que la capa de
repositorios necesita un helper `withWrite(entities, fn)` que use
`db.transaction(stores, 'readwrite')` de `idb`.

## 4. Esquema del servidor (D1)

Una tabla genérica de filas en lugar de una tabla por entidad:

```sql
CREATE TABLE rows (
  entity      TEXT    NOT NULL,  -- 'sessions' | 'marks' | 'settings' | 'tags' | ...
  id          TEXT    NOT NULL,
  rev         INTEGER NOT NULL,  -- versión por fila, la asigna el servidor
  updated_at  TEXT    NOT NULL,  -- ISO del cliente (clave de LWW)
  deleted_at  TEXT,
  payload     TEXT    NOT NULL,  -- JSON opaco de la fila completa
  PRIMARY KEY (entity, id)
);
CREATE INDEX rows_rev ON rows (rev);

CREATE TABLE meta (
  key   TEXT PRIMARY KEY,
  value INTEGER NOT NULL
);
INSERT INTO meta (key, value) VALUES ('rev', 0);
```

**Por qué genérica, y qué cuesta.** El servidor nunca interpreta un payload, así que agregar
un campo o una tabla es un cambio solo de cliente: sin deploy del Worker y sin migración de
D1, para siempre. El costo es que el servidor no puede consultar tus datos (ni reportes, ni
SQL sobre tus sesiones). Ese costo es aceptable *porque* las métricas se calculan en el
cliente desde Dexie. Si algún día aparece un requisito de reportes del lado del servidor, ese
es el disparador para pasar a tablas tipadas — no antes.

## 5. Contrato de la API

Un solo Worker sirve el SPA como static assets y es dueño de `/api/*` en el mismo origen, así
que no hay CORS. Límite de body 256 KB, máximo 500 mutaciones por request.

**La auth se delega a Cloudflare Access**, no a un token de la aplicación:

- Una política de Access a nivel Worker protege todo el hostname (assets y `api/*`) antes de
  que el request llegue al script.
- Defensa en profundidad, barata y cacheada: el Worker lee `Cf-Access-Jwt-Assertion`, valida
  la firma contra el JWKS del team (se busca una vez y se cachea con `caches.default`) y
  verifica `aud` + `exp`. Si falla la validación, `401`.
- No hay secreto `SYNC_TOKEN`, así que no hay nada secreto que guardar en el cliente.
- La duración de la sesión es un ajuste de la política de Access; se configura en **1 mes**
  para que el flujo del gimnasio no sea un login por semana.

### `GET /sync?since=<rev>&limit=200`

```json
{
  "rev": 812,
  "more": false,
  "now": "2026-10-20T18:04:11.000Z",
  "changes": [
    { "entity": "sessions", "id": "6f1c…", "rev": 790, "updatedAt": "2026-10-20T17:02:00.000Z",
      "deletedAt": null, "row": { "date": "2026-10-20", "planId": "fuerza", "sets": [] } }
  ]
}
```

- `since` por defecto es `0` (pull completo). Las filas van ordenadas por `rev` y `limit`
  corta la página.
- `more: true` significa que el cliente tiene que volver a llamar con `since` = último `rev`
  recibido.
- `now` le permite al cliente detectar desvío de reloj contra su propio `Date.now()`.

### `POST /sync`

```json
{
  "deviceId": "dev_ab12",
  "mutations": [
    { "entity": "sessions", "id": "6f1c…", "updatedAt": "2026-10-20T17:02:00.000Z",
      "deletedAt": null, "row": { "...": "..." } }
  ]
}
```

```json
{
  "rev": 812,
  "applied": ["sessions/6f1c…"],
  "rejected": [ { "ref": "settings/theme", "reason": "stale_server_newer" } ]
}
```

Algoritmo del servidor, un solo `db.batch()`:

1. `SELECT entity, id, updated_at FROM rows WHERE (entity, id) IN (...)`, troceado: **≤25
   pares por statement** (≤100 parámetros vinculados, que es el límite por query de D1;
   los límites aplican per statement, así que varios SELECT dentro del mismo `batch()`
   siguen siendo un solo subrequest).
2. Por cada mutación: se aplica cuando la fila no existe, o cuando
   `mutation.updatedAt >= existing.updated_at`. Si no, se rechaza como
   `stale_server_newer`. (Empate → gana el cliente; el `>=` mantiene idempotentes los
   reintentos.)
3. Se reservan `n = <cantidad de mutaciones>` revisiones de forma atómica:
   `UPDATE meta SET value = value + n WHERE key = 'rev' RETURNING value;`
   Las revisiones `high-n+1 … high` se asignan **posicionalmente**, así cada fila recibe una
   `rev` distinta (los huecos que dejan las rechazadas son inofensivos) y la paginación por
   cursor con `>` no puede saltear ni duplicar filas.
4. **Un statement por fila**: `INSERT INTO rows … ON CONFLICT (entity, id) DO UPDATE SET …`
   para el subconjunto que se aplica. Un multi-row INSERT a 500 filas serían 2.500
   parámetros y también rompería el límite de 100; 500 statements en un batch caben sin
   problema (el límite de 50 queries/invocation en free cuenta a `batch()` como una).
5. Se devuelven las refs aplicadas, las rechazadas y el `rev` alto nuevo.

Idempotencia: el id de la fila lo genera el cliente, así que reenviar un alta es un upsert y
una mutación repetida o se vuelve a aplicar (payload idéntico, sin efecto) o se rechaza como
vieja. No hace falta idempotency key.

## 6. Algoritmo de merge del cliente

Funciones puras en `app/src/repositories/sync/merge.ts` (testeadas por unidad, sin I/O).

El compare LWW va primero: la lápida entra como caso del compare, no antes de él (un
shortcut de `deletedAt` por delante pisaría una edición local más nueva con una lápida más
vieja).

```
applyPull(localRow, incoming) -> 'insert' | 'update' | 'skip'
  localRow == null                      -> insertar (lápida entrante: lápida sola,
                                          sin payload)
  incoming.updatedAt >  local.updatedAt -> actualizar (lápida entrante: marcar borrada,
                                          conservar payload de localRow)
  else                                  -> saltear (también saltea la lápida más vieja)

applyMutation(localRow, outgoing) -> 'write'   // siempre escribir local primero
```

Las lápidas quedan en Dexie (`deletedAt != null`) y se filtran en todo camino de lectura de
los repositorios. Solo se purgan con una acción manual de "Compactar" (fuera del alcance de
la v1): conservarlas es lo que hace confiable la propagación de borrados.

## 7. Motor de sync

`app/src/repositories/sync/engine.ts`:

- `enqueue` es implícito: el repositorio escribe la fila y su entrada de outbox en la misma
  transacción, **coalesciendo por `(entity, id)`**: si ya hay una entrada pendiente para esa
  fila se reemplaza con la snapshot más nueva (misma transacción). Sin esto, dos edits
  offline de la misma fila enflushean las dos entradas y la vieja puede generar un
  `rejected` falso en `sync.lastConflict`.
- `flush()`: POST con hasta 100 entradas del outbox (ordenadas por `seq`); si sale bien, borra
  esos `seq`; si vuelven `rejected`, también las descarta (la copia del servidor es más
  nueva) y anota `sync.lastConflict` para mostrarlo en Ajustes.
- `pull()`: bucle `GET /sync?since=cursor` mientras `more`, aplicando cambios; persiste
  `sync.cursor` después de cada página (a prueba de crashes: reaplicar una página es
  idempotente).
- `run()` = `flush()` y después `pull()`, protegido por un mutex de vuelo único; una cadena de
  reintentos con backoff exponencial (2 s → tope 60 s) para errores de red/5xx; **sin
  reintento** en 401 (mostrar `token rechazado` en Ajustes y cortar).
- Disparadores: arranque de la app; `window.online`; `visibilitychange → visible`; debounce de
  3 s después de cualquier alta en el outbox; y el botón manual de Ajustes. Sin polling por
  timer.

Modos de falla y qué ve el usuario:

| Situación | Comportamiento |
| --- | --- |
| Sin conexión | Todo funciona; el outbox crece; Ajustes muestra "N cambios pendientes". |
| Sesión de Access vencida | `/api/sync` responde `302` al login en vez de JSON. El motor llama `fetch(..., { redirect: 'manual' })` y trata `opaqueredirect` / no-JSON como `auth_required`: sin reintento, banner persistente "Sesión vencida — tocá para volver a entrar", outbox intacto. |
| JWT inválido / usuario desconocido | `401` → mismo banner, otro copy, no se toca ningún dato. |
| Se agota el límite diario de D1 | 429/5xx → backoff, reintento en el próximo disparador; outbox intacto (sin pérdida). |
| Los dos dispositivos editan `theme` offline | Gana el último que sincroniza; el otro edit se descarta en silencio (limitación documentada). |
| La misma sesión se registra en los dos dispositivos | Quedan dos filas — es correcto, son registros distintos. |
| El reloj del dispositivo está horas corrido | Se compara el `now` de la respuesta con la hora local; Ajustes avisa si el desvío supera 2 min. LWW no es confiable con desvío grande, de ahí el aviso. |

## 8. Completar la capa de repositorios (prerrequisito, no opcional)

`repositories/` hoy cubre solo `sessions` y `settings`, mientras **13 archivos de features
entran a `@/db` directamente**. El motor de sync necesita un único punto de escritura, así que
esto tiene que entrar primero:

- Agregar repositorios de `marks`, `tags`, `goals` y `progress`, más una superficie de consulta
  compartida (`list`, `get`, `put`, `add`, `softDelete`, `listWhere`).
- Reescribir los accesos directos en: `components/Layout.tsx`, `features/home/Home.tsx`,
  `features/metrics/{Metrics.tsx,metrics.ts}`,
  `features/plans/{Program.tsx,meso.ts,progression.ts}`, `features/progress/marks.ts`,
  `features/settings/SettingsMenu.tsx`, `lib/tags.ts`, más `features/runner/{Runner.tsx,
  useRunner.ts}` donde ya usan repositorios.
- **Sin cambio de comportamiento** en este paso. Es un refactor de costura puro y tiene que
  entrar en su propio commit para que una regresión sea bisecable.

## 9. UI de Ajustes (copy en español)

Bloque nuevo "Sincronización" en el popover existente
(`features/settings/SettingsMenu.tsx`):

- **Sin campo de token y sin campo de URL del servidor.** Mismo origen (`/api`) y la identidad
  viene de la sesión de Access. No hay nada secreto en la app.
- Botón "Sincronizar ahora".
- Línea de estado: `Última sincronización: hace 2 h · 3 cambios pendientes · este dispositivo
  (Pixel 8)`.
- Estado de sesión: `Sesión: vos@ejemplo.com` o el banner de sesión vencida.
- Aviso de desvío de reloj (arriba de 2 min) cuando el `now` de la respuesta no coincide con el
  dispositivo.
- Se conserva el export/import JSON (ahora también la vía de escape si el backend muere).

## 10. Deploy

```
worker/
  wrangler.toml        # main, assets dir = ../app/dist, run_worker_first ["/api/*"], binding D1
  migrations/0001_init.sql
  src/index.ts         # Hono: GET /api/sync, POST /api/sync, GET /api/health
  src/access.ts        # verificación de Cf-Access-Jwt-Assertion, JWKS cacheado
  test/sync.test.ts    # D1 local vía wrangler dev / miniflare
```

- Un solo Worker, un solo deploy: `wrangler deploy` después de `npm run build` en `app/`.
  Workers Builds (integración con git) puede hacerlo en cada push dentro de los 3.000 min/mes
  gratis.
- `assets.run_worker_first: ["/api/*"]` para que solo las llamadas a la API invoquen el script
  y consuman cuota. Todo lo demás es un request a static assets, gratis e ilimitado. Ojo con
  la advertencia del free tier: un request que matchea `run_worker_first` recibe `429` en vez
  de caer al asset cuando se agota la cuota — irrelevante con ~50 requests de API por día sobre
  100k.
- Ruteo del SPA: `assets.not_found_handling: "single-page-application"`.
- Access: Zero Trust → Access → Applications → política a nivel Worker sobre el hostname
  `workers.dev` (un hostname `pages.dev` no se puede proteger: Access exige una zona activa).
  Duración de sesión 1 mes. El plan Free cubre hasta 50 usuarios; hay uno.
- Desarrollo local: `wrangler dev` (SQLite local + assets) y `VITE_SYNC_URL` sin definir para
  que la app caiga al `/api` relativo.
- Presupuesto de CPU del free tier: parseo de JSON + 3 statements de SQLite + una verificación
  WebCrypto (~1–3 ms).

## 11. Tests

- `merge.test.ts` — LWW puro: gana el más nuevo, se saltea el viejo, empate → cliente,
  propagación de lápidas **y lápida más vieja no pisa una edición local más nueva**, fila
  local ausente (alta viva y lápida sola), unión append-only. **Es la superficie de test de
  verdad.**
- `outbox.test.ts` — la escritura encola en la misma transacción; coalescing de la entrada
  pendiente por `(entity, id)`; un flush fallido conserva las entradas; una mutación
  `rejected` se descarta y se reporta. El export JSON excluye `sync.*`.
- `engine.test.ts` — pull paginado con un `fetch` stubbeado; 401 desactiva el reintento; el
  cursor se persiste después de cada página; vuelo único ante disparadores concurrentes.
- `worker/test/sync.test.ts` — rechazo de auth, rechazo de stale, monotonía de `rev`,
  paginación por cursor nunca saltea una fila, tope de 500 mutaciones, lookup troceado que
  nunca pasa de 100 parámetros por statement.
- `e2e/sync.spec.ts` — dos contextos de navegador de Playwright contra el Worker local: el
  dispositivo A registra una sesión, B la baja; edit offline en B, reconexión, A la ve.
- Chequeo diferencial según `AGENTS.md`: cada comando u opción existente que se toque lleva su
  test de regresión (lectura/escritura de settings, alta de marks, alta/baja de tags, export de
  backup).

## 12. Desglose de tareas (orden ODD)

- [ ] **T1 — Completar repositorios para las 5 tablas restantes + helper `withWrite`.** Sacar
      `@/db` de los 13 archivos de features. Refactor de costura puro, sin cambio de
      comportamiento, commit propio. Ruta: inline. ~350 líneas (mecánicas).
- [ ] **T2 — Funciones puras de `merge.ts` con tests primero (RED).** LWW, lápidas, empates,
      unión append-only. Independiente del esquema: sin DB ni red. Ruta: inline.
- [ ] **T3 — Esquema v1004.** UUIDs, `updatedAt`/`deletedAt`, store `outbox`, test de migración
      sobre una DB de fixture, export JSON ofrecido antes del bump. Ruta: verify. **Riesgo alto
      (datos guardados).** ~200 líneas.
- [ ] **T4 — Motor de sync.** `flush` / `pull` / `run`, mutex de vuelo único, backoff,
      `opaqueredirect` → `auth_required`. Tests con `fetch` stubbeado. Ruta: worker. ~250
      líneas.
- [ ] **T5 — `worker/`.** Hono + D1 + verificación del JWT de Access (JWKS cacheado) + SQL +
      tests del Worker. Ruta: worker. ~300 líneas.
- [ ] **T6 — Ajustes → Sincronización.** Línea de estado, botón de sync manual, estado de
      sesión, aviso de desvío de reloj. Sin campo de token. Ruta: inline.
- [ ] **T7 — Cableado de deploy.** `wrangler.toml`, static assets, política de Access, README.
      Ruta: inline. Necesita que el usuario cree el Worker y la aplicación de Access.
- [ ] **T8 — e2e de dos dispositivos + verificación final.** Dos contextos de Playwright contra
      el Worker local. Ruta: verify.

Cortes de commit: T1 / T2+T3 / T4+T5 / T6+T7 / T8 — cada uno más o menos un commit
reviewable. El review nativo final de RDD corre sobre los commits de unidad de trabajo, no
sobre la branch entera.

## 13. Riesgos

- **Datos (item 1)**: la migración v1004 de Dexie reescribe claves primarias. Se mitiga
  migrando una copia, con un test de migración sobre una DB de fixture, y con el export JSON
  ofrecido en Ajustes como vía de escape antes del bump.
- **Contratos (item 3)**: `SessionRecord.id` cambia de tipo, de `number` a `string`, lo que
  toca el formato del backup. El importador acepta las dos formas.
- **Tests (item 6)**: merge y engine tienen tests unitarios deterministas; el Worker tiene
  tests con D1 local; el e2e de dos dispositivos cubre la integración. Por eso la lógica de
  merge es una función pura y no está escondida dentro del engine.
- **D1 limita a 100 los parámetros vinculados por query**: el lookup `(entity, id) IN (...)`
  se trocea a ≤25 pares por statement y los upserts son un statement por fila, todo dentro
  del mismo `batch()` (verify por test). Nota: con Static Assets el Worker de usuario no
  recibe `ctx.access`, por eso la verificación manual del JWT con JWKS es la única vía
  válida y no solo defensa en profundidad.
- Aceptado y documentado: los conflictos en filas mutables pierden el edit del que pierde; D1
  tiene límites duros en el free tier (con enforcement desde 2026-09-01).

## 14. Limitaciones aceptadas (explícitas, para que no sorprendan)

- Un ajuste editado offline en los dos dispositivos: uno de los dos edits se pierde. No hay
  merge por campo ni UI de conflictos.
- Las lápidas crecen sin límite hasta que se agregue "Compactar".
- El cuerpo del mensaje está limitado a 500 mutaciones: un alta masiva (import de un backup
  grande) se parte en varios requests.
- Si Cloudflare cambia el free tier, el costo de salida es un Worker pago ($5/mes) o migrar el
  adaptador a Turso o a un VPS.

## 15. Registro de decisiones

Cerradas el 2026-10-20:

1. **Auth: Cloudflare Access (OTP por email)**, no un bearer token. Consecuencia: el campo de
   token desaparece del cliente y el Worker no guarda ningún secreto compartido.
2. **Alcance: las seis tablas** (`sessions`, `marks`, `settings`, `tags`, `progress`, `goals`).
   `progress` y `goals` no tienen escritor hoy; sincronizarlas no cuesta nada y mantiene el
   esquema listo para adelante.
3. **Hostname: `logstenia.<account>.workers.dev`**, sin dominio propio, sin costo.

### Consecuencia: Pages → Workers (por esto cambió §10)

Las decisiones 1 y 3 chocaban como estaban planteadas. Las aplicaciones self-hosted de
Cloudflare Access exigen *"an active domain on Cloudflare"* (una zona), y `*.pages.dev` no es
una zona, así que la URL de producción de Pages no se puede proteger con Access: Access solo
protege un dominio propio asociado al proyecto.

Las políticas de Access a nivel Worker sí aceptan un hostname `workers.dev`, y los static
assets de Workers se facturan como *"free and unlimited"* (a diferencia de las Functions, que
consumen la cuota de 100k/día). Desplegar el SPA como static assets de un Worker satisface las
tres decisiones a costo cero y con un solo destino de deploy en lugar de dos.

Sigue abierto (diferido, no bloquea):

- ¿Export completo automático mensual, o solo el export JSON manual?
- Una acción "Compactar lápidas" para purgar filas con `deletedAt` viejas.
- Dominio propio más adelante (un CNAME más una aplicación de Access; sin migrar datos).
