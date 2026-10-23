# Plan de diseño: sync multiusuario (owner por fila)

## Metadatos

- Creado: 2026-10-23
- Branch: `multi-user` (a crear cuando se apruebe)
- Superficie: `worker/migrations/`, `worker/src/{index,access}.ts`, `worker/test/`,
  `app/src/repositories/sync/`, `app/src/features/settings/`, `app/e2e-sync/`
- Fuente de diseño: `design-plans/backend-sync.md` (v1, un solo usuario) y
  `odd/tasks/backend-sync.md` (T1–T8, ya implementado y deployado)
- Estado: **propuesta — sin código escrito**

## Objetivo

Que varias personas usen la misma app y el mismo backend, cada una con sus propios datos,
sin multiplicar la infraestructura: un Worker, una D1, una política de Access. El servidor
separa las filas por `owner`, y ese owner sale del JWT que Access ya emite y el Worker ya
verifica.

## Fuera de alcance

- **Compartir** datos entre personas (varios emails viendo el mismo historial). Ese es el
  "Caso A" y hoy se resuelve agregando emails a la política de Access: misma data para
  todos. Con `owner` pasa a ser explícitamente imposible sin una feature aparte.
- Roles, panel de administración, invitaciones desde la app, borrado de cuenta, migración de
  datos entre usuarios.
- Realtime, notificaciones, analítica por usuario.
- Cambios visuales más allá de mostrar la identidad en Ajustes.

## 1. Identidad: de dónde sale el owner

`worker/src/access.ts` ya decodifica el payload del JWT y valida firma contra el JWKS del
team, más `aud` y `exp`. Hoy devuelve un booleano porque hay un solo usuario.

Cambio: pasa a devolver la identidad.

```ts
export interface Identity {
  email: string;
}
export type AccessResult =
  | { ok: true; identity: Identity }
  | { ok: false; reason: 'missing_token' | 'invalid' | 'expired' | 'wrong_audience' | 'no_email' };
```

- El claim es `email` (Access lo emite para OTP por email y para la mayoría de los IdP).
  Normalizar con `email.trim().toLowerCase()` en un único lugar.
- Sin tabla de usuarios: el owner es un string derivado en cada request. La lista de
  admitidos es la **política de Access**, no la base. Esto mantiene el Worker sin estado de
  identidad y sin invitaciones.
- Alternativa descartada: `sub` del JWT. Access no garantiza un `sub` estable entre sesiones
  de OTP por email, así que el owner "se movería" y el usuario perdería su historial.
- Si el JWT válido no trae `email`, la respuesta es `401` (`no_email`): fallar cerrado es
  preferible a escribir filas con owner vacío.

## 2. Esquema del servidor (migración `0002_owner.sql`)

SQLite no permite agregar una columna a la PK, así que la tabla se reconstruye.

```sql
CREATE TABLE rows_v2 (
  owner       TEXT    NOT NULL,
  entity      TEXT    NOT NULL,
  id          TEXT    NOT NULL,
  rev         INTEGER NOT NULL,
  updated_at  TEXT    NOT NULL,
  deleted_at  TEXT,
  payload     TEXT    NOT NULL,
  PRIMARY KEY (owner, entity, id)
);

INSERT INTO rows_v2 (owner, entity, id, rev, updated_at, deleted_at, payload)
  SELECT 'legacy@local', entity, id, rev, updated_at, deleted_at, payload FROM rows;

DROP TABLE rows;
ALTER TABLE rows_v2 RENAME TO rows;

CREATE INDEX rows_owner_rev ON rows (owner, rev);
```

- `meta.rev` sigue **global** y monotónico para todos: alcanza para que cada usuario tenga
  su propio cursor (`since`) sin coordinación entre usuarios.
- `owner` no se devuelve nunca al cliente: no lo necesita y no queremos exponer emails
  ajenos por accidente.
- **Adopción de las filas existentes**: hoy la D1 de producción tiene filas con el usuario
  actual. Si se dejan en `legacy@local`, ese historial deja de verse. La migración debe
  terminar con `UPDATE rows SET owner = '<email>' WHERE owner = 'legacy@local';` con el
  email real del dueño (escrito en la migración o inyectado por un script de deploy). A
  decidir antes de escribir el SQL final (ver §9).

## 3. Contrato de la API (misma forma, distinto alcance)

- `GET /api/sync?since&limit`
  `WHERE owner = ? AND rev > ? ORDER BY rev LIMIT ?`, servido por `rows_owner_rev`.
- `POST /api/sync`
  El lookup existente pasa de pares a **triples** `(owner, entity, id)`. El chunking baja de
  25 pares a **33 triples por statement** (99 parámetros, dentro del límite de 100 de D1).
  El test del chunker tiene que fijar el nuevo tope.
- Upsert `ON CONFLICT (owner, entity, id)`; la comparación LWW y la asignación posicional de
  `rev` no cambian.
- **Sin cambios de forma**: el cliente no manda `owner` (viene del JWT) y no lo recibe en la
  respuesta. Un cliente viejo sigue funcionando, con sus filas bajo `legacy@local`.
- Se agrega un campo opcional `user` al body de `GET /api/sync` con el email del propio
  llamante (ver §4). Es el único cambio de contrato y solo expone la identidad propia.

## 4. Cliente: un dispositivo, una persona (v1)

- El motor no cambia: el scoping es del servidor, y `sync.cursor` sigue siendo por
  dispositivo.
- El Dexie local (`DB_NAME = 'logstenia'`) **no** se parte por usuario en esta versión.
  Limitación explícita: si dos personas usan el mismo perfil de navegador, la segunda ve los
  datos locales de la primera hasta que el pull los pise (LWW). En la práctica cada teléfono
  y cada laptop tiene un navegador por persona, así que v1 lo acepta.
- Mitigación v2, sin tocar el servidor: nombre de base por owner
  (`logstenia-<hash corto del email>`), que además separa `sync.cursor`, `sync.deviceId` y
  ajustes de cada persona. Queda como tarea futura, no entra acá.
- `user` del `GET /api/sync` se guarda en `sync.user` (clave local-only, ya excluida del
  outbox, del pull y del backup por prefijo `sync.`). Ajustes muestra
  `Sesión: <email>`, cerrando el desvío de S9 que quedó documentado en L11.

## 5. Desarrollo local y e2e con dos identidades

El bypass de loopback no produce JWT, así que en local no hay `email`. Solución acotada y
sin superficie en producción:

- Cuando `isDevAuthBypass` está activo, el owner sale del header `x-dev-owner`
  (default `dev@local`). Ese header **se lee solo en la rama del bypass**, que exige flag
  exacto + host de loopback; en un Worker deployado el header se ignora.
- El e2e de dos dispositivos pasa a dos personas: contexto A con
  `extraHTTPHeaders: { 'x-dev-owner': 'a@local' }`, contexto B con `b@local`. Así se prueba
  también el **aislamiento**: lo que escribe A no le aparece a B.
- Test nuevo además del actual: el mismo owner en dos contextos (A y A') comparte, A y B no.

## 6. Tests

**Worker**

- identidad: JWT válido sin `email` → `401 no_email`; email con mayúsculas y espacios se
  normaliza.
- GET: dos owners con filas propias; cada uno recibe solo las suyas; `now` y paginación
  intactos.
- cursor: dos owners alternando pulls con el mismo `since` no se pisan.
- POST: un owner no puede sobrescribir una fila de otro ni conociendo `(entity, id)`.
- chunker: 500 mutaciones → 16 statements de 33 triples; nunca más de 100 parámetros.
- migración `0002`: fixture con filas previas → todas quedan con el owner de adopción y el
  `rev` original; la PK nueva rechaza duplicados por owner.

**App**

- el motor no cambia de lógica; se agrega que `user` de la respuesta termine en `sync.user`
  y que la línea de sesión muestre el email.
- `exportableSettings` sigue excluyendo `sync.user` (ya cubierto por el prefijo).

**e2e**

- dos owners con aislamiento real (A escribe, B no lo ve; B escribe, A no lo ve).
- mismo owner en dos contextos: se ven.

## 7. Riesgos

- **Datos (item 1)**: la migración reconstruye `rows`. Mitigación: export JSON desde Ajustes
  antes de aplicarla, fixture test de la migración, y adopción explícita de las filas
  existentes en el mismo paso.
- **Contratos (item 3)**: cambian la PK y el chunker; el body/response no. Un cliente viejo
  sigue funcionando, pero sus filas quedan en `legacy@local` si no se adoptan.
- **Privacidad (item 2)**: el aislamiento depende de que Access entregue el JWT correcto. El
  Worker nunca acepta un owner provisto por el cliente, salvo el header de dev bajo loopback.
- **Concurrencia (item 4)**: `meta.rev` global serializa la asignación de revisiones entre
  usuarios; con dos o tres personas es irrelevante, con decenas habría que pasar a `rev` por
  owner. Se documenta como límite conocido.
- **Costo**: Access Free admite hasta 50 usuarios; D1 Free (5M filas leídas/día, 100k
  escritas/día) alcanza de sobra para uso familiar.

## 8. Desglose de tareas (orden ODD)

| Tarea | Alcance | Ruta | Riesgo |
|---|---|---|---|
| T1 | `access.ts` devuelve identidad (`email` + normalización), tests de claim faltante | inline | 3 |
| T2 | `0002_owner.sql` con rebuild + adopción, test de migración con fixture | verify | **1 (datos)** |
| T3 | API scopeada por owner (GET/POST, chunker 33 triples, upsert), tests de aislamiento y cursor | worker | **1, 3** |
| T4 | `user` en la respuesta + `sync.user` + `Sesión: <email>` en Ajustes | inline | — |
| T5 | dev/e2e: header `x-dev-owner` bajo bypass + spec de dos owners y aislamiento | worker | 2 |
| T6 | deploy: migración remota, verificación de que el dueño actual sigue viendo sus filas | inline | **1** |

Cortes de commit: T1+T2 / T3 / T4 / T5 / T6. La migración va sola en su commit para que un
problema de datos sea bisecable.

## 9. Decisiones abiertas (necesarias antes de escribir código)

1. **Filas actuales de la D1**: ¿se adoptan a tu email en la misma migración (recomendado) o
   quedan en `legacy@local` y se re-importan desde el backup JSON?
2. **`owner` = email en claro o hash del email?** El email es simple y legible para depurar;
   el hash no deja el mail en la base. Con una sola D1 privada, el email en claro es
   defendible; el hash agrega una función estable que hay que no romper nunca.
3. **¿Se habilita ya la política de Access con varios emails** (Caso A) o se mantiene
   únicamente tu cuenta hasta que exista el aislamiento?
