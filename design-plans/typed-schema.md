# Plan de diseño: esquema tipado en el servidor (¿migrar a Drizzle y cuándo?)

## Metadatos

- Creado: 2026-10-25
- Estado: **propuesta — sin código escrito**
- Superficie si se ejecuta: `worker/src/sync/`, `worker/migrations/`, `worker/package.json`,
  `app/src/repositories/sync/`, `app/src/data/plansRepository.ts`
- Fuente: `design-plans/backend-sync.md` §4 (el disparador está escrito ahí desde el inicio),
  `design-plans/multi-user.md`, `odd/tasks/{multi-user,sync-validation,sync-layers,plans-sync}.md`

## 0. Requisito — todavía no está definido

Este documento existe para **decidir**, no para ejecutar. La primera línea del proyecto que lo
active tiene que ser el requisito. Los cuatro escenarios posibles y su veredicto:

| Escenario | Veredicto |
| --- | --- |
| "Quiero reportes server-side: progreso por ejercicio, sesiones por semana, comparar meses sin recalcular en el cliente" | **Migrar.** Empezando por `sessions` y `marks` |
| "Quiero que el entrenador arme rutinas y el alumno las reciba" | **No migrar primero.** Es permisos + catálogo compartido; tipar es secundario |
| "Quiero que el servidor no me deje guardar datos corruptos" | **No migrar.** Son cinco líneas de validación de `row` |
| "Quiero estar listo para cuando esto crezca" | **No migrar.** Se paga la coordinación desde hoy sin beneficio |

Si no hay un escenario marcado, este plan queda como referencia y no se ejecuta.

## 1. Lo que hay hoy (medido, no estimado)

- Una tabla genérica `rows(owner, entity, id, rev, updated_at, deleted_at, payload TEXT)` con PK
  `(owner, entity, id)` e índice `(owner, rev)`. Seis entidades, lookup de 33 triples, `rev`
  global y monotónico.
- El servidor nunca interpreta un `payload`: `JSON.parse` solo para devolverlo, `JSON.stringify`
  solo para escribirlo. Consecuencia cobrada: **agregar un campo no cuesta deploy ni migración**.
- Bundle del Worker: 15.5 KB gzip (10 KB sin la ruta de sync).
- Catálogo: 7 categorías → 16 programas → 102 modelos → 419 bloques → 616 ejercicios,
  **225.8 KB** minificado; la categoría más grande (fuerza) pesa **66.2 KB**.
- El hueco conocido: `row` es `unknown` en el schema. Un cliente con un bug puede escribir
  `durationSec: "veinte"` y el servidor lo replica; del otro lado `payloadOf()` escribe una fila
  sin campos, en silencio.

## 2. Qué cuesta migrar, por entidad

No es una decisión única. Cada entidad tiene un costo y un beneficio distintos.

| Entidad | Estructura de dominio | Consultas server-side que habilitaría | Veredicto |
| --- | --- | --- | --- |
| Catálogo (`categories → programs → models → blocks → exercises`) | **Fuerte y estable** | Qué ejercicios se usan más, dificultad por nivel, catálogo compartido | **Candidato natural** |
| `sessions` (+ series embebidas) | Media: la serie es atómica a propósito | Progreso por semana, adherencia, comparación entre personas | **Candidato si hay reportes de progreso** |
| `marks` | Baja (valor + fecha + ejercicio) | Progreso por ejercicio, series temporales | Candidato junto con `sessions` |
| `settings`, `tags`, `goals`, `progress` | Ninguna, son bolsas de campos | Ninguna | **Nunca** |

## 3. Modelo propuesto (solo si la etapa se activa)

**Motor:** Drizzle ORM con el dialecto D1 (`drizzle-orm/d1`), migraciones SQL planas con
`drizzle-kit`. D1 acepta layouts anidados vía `migrations_pattern`, así que las migraciones
generadas conviven con las manuales que ya existen (`0001`, `0002`).

**Catálogo tipado, con owner:**

```sql
CREATE TABLE plans_categories (
  owner       TEXT NOT NULL,
  id          TEXT NOT NULL,
  name        TEXT NOT NULL,
  description TEXT NOT NULL,
  position    INTEGER NOT NULL,       -- el orden hoy implícito en el JSON
  updated_at  TEXT NOT NULL,
  deleted_at  TEXT,
  PRIMARY KEY (owner, id)
);

CREATE TABLE plans_programs (
  owner       TEXT NOT NULL,
  id          TEXT NOT NULL,
  category_id TEXT NOT NULL,
  ...
  PRIMARY KEY (owner, id),
  FOREIGN KEY (owner, category_id) REFERENCES plans_categories (owner, id)
);
-- y models / blocks / exercises en el mismo patrón
```

Tres consecuencias que hay que aceptar antes de escribir esto:

1. **Las FK tienen que incluir `owner`.** Con catálogo por persona, una sesión de A referencia
   planes de A. `FOREIGN KEY (owner, model_id)` no es opcional: sin el owner, la FK permite
   referencias cruzadas entre personas.
2. **El catálogo pasa a ~1.150 filas por persona** (7 + 16 + 102 + 419 + 616), es decir ~5.750
   filas con cinco personas. Hoy son 35 filas (7 por owner). El sync deja de mover un documento
   y empieza a mover filas con dependencias de orden (padre antes que hijo).
3. **Cada cambio de forma del catálogo es una migración de D1 + deploy coordinado.** El catálogo
   cambió 16 veces en el historial reciente. Ese es el precio real.

**`sessions` tipado, si llega esa etapa:**

```sql
CREATE TABLE sessions (
  owner        TEXT NOT NULL,
  id           TEXT NOT NULL,
  date         TEXT NOT NULL,
  plan_id      TEXT NOT NULL,
  model_id     TEXT NOT NULL,
  duration_sec INTEGER NOT NULL,
  completed    INTEGER NOT NULL,
  PRIMARY KEY (owner, id)
);
CREATE TABLE session_sets (
  owner      TEXT NOT NULL,
  session_id TEXT NOT NULL,
  position   INTEGER NOT NULL,
  exercise   TEXT NOT NULL,
  value      TEXT NOT NULL,
  unit       TEXT NOT NULL,
  bloque_orden INTEGER NOT NULL,
  orden      INTEGER NOT NULL,
  PRIMARY KEY (owner, session_id, position),
  FOREIGN KEY (owner, session_id) REFERENCES sessions (owner, id)
);
```

Acá hay una pérdida de propiedad que hoy es gratis: **la sesión deja de ser una escritura
atómica**. Guardar una sesión con 12 series son 1 + 12 filas y un merge por fila; si dos
dispositivos editan la misma sesión, el LWW por serie puede producir una sesión mezclada. Hoy no
puede pasar.

## 4. Lo que se rompe

1. **El motor genérico.** `service.ts` y `queries.ts` dejan de ser "una tabla, tres funciones":
   necesitan un mapa entidad↔tabla y un merge por entidad. El engine del cliente igual.
2. **El contrato de la API** (item 3): `entity/id/payload` deja de ser suficiente. O se agrega una
   capa de recursos tipados, o el POST traduce entidades a filas relacionales.
3. **Los clientes existentes.** Un cliente viejo contra un servidor tipado no puede sincronizar.
   Necesita versión de API o convivencia.
4. **Los tests del Worker.** `FakeD1` no puede ejecutar DDL ni joins; toda la cobertura tendría
   que pasar a `SqliteD1` (que ya existe y ya cubre migración, aislamiento y owner-binding).
5. **`plans.json` como seed.** Con tablas tipadas el seed se vuelve una migración de datos, no un
   JSON que viaja en el build.

## 5. Estrategia por etapas (si se ejecuta)

- **Etapa 0 — requisito.** Una línea escrita en `## 0`. Sin esto no hay etapa 1.
- **Etapa 1 — catálogo.** La única entidad con estructura de dominio fuerte y estable. Habilitaría
  reportes por ejercicio y, más adelante, catálogo compartido. Es la que mejor paga.
- **Etapa 2 — `sessions` + `marks`.** Solo con un requisito de reportes de progreso. Asume la
  pérdida de atomicidad descrita arriba.
- **Etapa 3 — nunca.** `settings`, `tags`, `goals`, `progress` no ganan nada y sí pagan
  coordinación.

**Alternativa intermedia, si el requisito es solo consultar:** escribir las tablas tipadas
**además** del espejo, y poblarlas en el mismo `batch()` del upsert. El payload sigue siendo la
fuente de verdad del sync y las columnas son una proyección de lectura. Duplica escritura y crea
coherencia que hay que mantener, pero **no rompe el motor, ni el contrato, ni los clientes**.
Vale la pena evaluarla antes que la migración completa porque resuelve el 80% del valor (consultar)
con una fracción del costo (coordinar).

## 6. Migración de datos (si hay datos vivos)

1. Contar filas y `rev` por owner antes de tocar nada.
2. Ventana con doble escritura: el POST escribe el payload **y** las filas tipadas.
3. Backfill desde `payload` con un script idempotente, verificado por conteo por entidad.
4. Corte: el GET sigue leyendo del payload durante una versión completa del cliente.
5. Recién después, el payload se vuelve derivado (o se deja de escribir).

Con cinco usuarios y pocos meses de datos, esto es barato **hoy**. Con un año de sesiones reales,
es un proyecto en sí mismo.

## 7. Riesgos

- **Datos (item 1)**: backfill y corte con dos clientes conviviendo. Mitigación: doble escritura,
  conteos por entidad, y el export JSON como vía de escape.
- **Contratos (item 3)**: la API deja de ser genérica; un cliente viejo no sincroniza.
- **Concurrencia (item 4)**: el merge por serie rompe la atomicidad de la sesión.
- **Entorno (item 5)**: entra `drizzle-orm` y `drizzle-kit`; las migraciones pasan a generarse.
- **Costo de iteración**: el catálogo deja de evolucionar con un deploy de cliente.

## 8. Lo que NO recomiendo

- Migrar las seis entidades juntas.
- Migrar sin requisito escrito.
- Empezar por `sessions`, que es la que más propiedad pierde.
- Usar la migración como excusa para reescribir el motor de sync "de paso".

## 9. Decisiones abiertas

1. ¿Cuál de los cuatro escenarios de §0 es el requisito real?
2. ¿Migración completa o la alternativa intermedia de §5 (proyección de solo lectura)?
3. Si se migra el catálogo: ¿sigue siendo por persona o pasa a compartido entre las cinco?
   (Son decisiones distintas: la primera no habilita compartir.)
4. ¿Cuándo? Antes del deploy del multiusuario, con datos en cero, es el momento más barato; después
   del primer año de datos es otro proyecto.
