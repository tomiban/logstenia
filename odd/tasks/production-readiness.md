# Release 1 a producción (beta cerrada, ≤50 atletas)

Llevar Logstenia a usuarios reales: auth propia sin contraseñas, datos aislados por atleta y la
operación mínima para no romper en silencio. Rama: `production` (a crear desde `multi-user`).

## Specs

S1. El alta es **cerrada**: una cuenta solo existe si su email está en la lista de invitaciones.
    Un pedido de magic link para un email no invitado no envía correo y responde **igual** que un
    email invitado, para no filtrar qué direcciones existen. (Usuario: "Invitación cerrada (beta)")

S2. La autenticación es **sin contraseña**: un link de un solo uso por email, con vencimiento
    corto, y sesión persistente en cookie `httpOnly` + `secure` + `sameSite`. No se implementa
    login con contraseña, ni recuperación de contraseña, ni formulario de registro.
    (Usuario: "DEBE SER UN AUTENTICACION ED 1 SOLA VEZ Y EIVTAR PASSWORDS")

S3. `owner` se sigue derivando del email normalizado (lowercase + forma NFC) en **un solo lugar**,
    reusando `normalizeOwner` tal cual: las filas ya escritas conservan su `owner` sin migración de
    datos. Cambia la fuente de la identidad, no su forma.

S4. Cloudflare Access deja de proteger el hostname y el Worker resuelve identidad **solo** desde
    su propia sesión. El bypass de desarrollo sigue existiendo para loopback y sigue fallando
    cerrado en producción.

S5. El motor de sync **no cambia**: mismo outbox, mismo LWW por `updatedAt`, mismo cursor `rev > since`,
    misma tabla `rows`. Lo único distinto es de dónde sale el `owner`.

S6. Cada atleta tiene su propia base local: ningún query local puede devolver filas de otro atleta,
    y el outbox no puede pushear filas capturadas bajo una identidad distinta de la sesión actual
    (se descartan, nunca se re-atribuyen).

S7. `exerciseId` se genera al crear el ejercicio y **no cambia con el rename**: renombrar no
    huerfana marcas ni progreso. La clave del historial es el id, no el nombre del PDF.

S8. El catálogo es editable y **no recibe actualizaciones oficiales**: `plans.json` es la foto fija
    del alta y ninguna corrección posterior llega a un atleta existente.
    (Usuario: "Editable, sin upgrades")

S9. CI corre worker (lint, typecheck, tests), app (lint, tests, build) y e2e en cada push; el deploy
    a producción está gateado en la rama principal y no puede correr si algo falla.
    (Usuario: "CI + backup programado")

S10. Backup diario automático de D1 a R2, con un restore probado al menos una vez y documentado.

S11. Antes de invitar al primer atleta, los 7 programas están curados y sin placeholders: como no
    hay upgrades, la calidad del catálogo al lanzar es permanente para esa cohorte.
    (Usuario: "Curar los 7 programas antes de invitar")

S12. La purga de los datos de un atleta es manual y por pedido, con procedimiento documentado,
    incluidos los tombstones que el diseño conserva para siempre.
    (Usuario: "Purga manual mía por pedido")

## Tasks

| ID | Specs | Alcance | Ruta | Commit |
| --- | --- | --- | --- | --- |
| T1 | S9 | CI en GitHub Actions: worker + app + e2e, con gate de deploy en main. Primero, para que proteja al resto | ci | — |
| T2 | S1, S2, S3, S4 | Auth propia en D1: `users`/`invites`/`magic_tokens`/`sessions`, Hono + magic link + envío de mail; `owner` desde sesión; retiro de Access | auth | — |
| T3 | S6 | Partición por owner en cliente: base por atleta + guarda anti-contaminación del outbox | app | — |
| T4 | S7 | `exerciseId` generado al crear e inmutable en el rename | app | — |
| T5 | S10 | Backup diario D1 → R2 + restore probado y documentado | ops | — |
| T6 | S12 | Runbook de purga de atleta en `docs/DEPLOY.md` | docs | — |
| T7 | S11 | Curación de los 7 programas (compuerta de lanzamiento, no de código) | content | — |
| T8 | S5, S8 | Verificación independiente: el motor de sync no cambió y el catálogo no se reintroduce como dato compartido | verify | — |

## Log

L1 (usuario, verbatim): "HAZME UN GRILL ME YO ASI DEFINIMOS EL MD"

L2 (grill, alcance): respuesta libre — "DEBE SER UN AUTENTICACION ED 1 SOLA VEZ Y EIVTAR PASSWORDS".
    Se lee como requisito de autenticación, no como recorte de alcance: define S2.

L3 (grill, alta): "Invitación cerrada (beta)" → S1.

L4 (grill, catálogo): "Editable, sin upgrades" → S8.

L5 (grill, escala): "≤50 atletas, todo en free tier".

L6 (grill, auth): "Auth propia en D1 con magic link" → T2. Con auth propia, el techo de 50
    identidades de Access desaparece: el límite pasa a ser la lista de invitaciones, que es tuya.

L7 (grill, curación): "Curar los 7 programas antes de invitar" → S11.

L8 (grill, borrado): "Purga manual mía por pedido" → S12.

L9 (grill, operación): "CI + backup programado" → S9, S10. Sentry queda afuera (L12).

L10 (corrección al análisis previo): había clasificado Access como **bloqueante por costo**
    ($7/usuario). Con ≤50 atletas y alta por invitación, Access entra en el free tier y su
    one-time PIN ya cumplía S2. La decisión del usuario de ir a auth propia se sostiene igual, pero
    por otra razón: control del remitente, de la sesión y de la lista de invitados — no el precio.

L11 (consecuencia de S8, dicha una vez y aceptada): sin upgrades, `plans.json` es permanente por
    cohorte. Una corrección de plan posterior a la beta solo llega a atletas nuevos. Por eso S11 es
    compuerta de lanzamiento y no una tarea más: la deuda de curación se paga antes de invitar, o
    no se puede pagar después.

L12 (lo que NO entra, con su disparador): `payloadVersion` y versión mínima de cliente → antes del
    primer cambio de forma del payload post-release; rate limit por owner → primer abuso o
    acercamiento a las 100k escrituras/día de D1; Sentry → primer bug reportado que no se
    reproduzca; `catalogVersion` y upgrades selectivos → si las correcciones post-beta empiezan a
    importar; tablas tipadas o Postgres → los disparadores ya escritos en `typed-schema.md`.

L13 (estándar elegido para T2): Better Auth con magic link sobre Drizzle + D1, y Resend para el
    envío. Razón: los tokens de un solo uso y las cookies de sesión son donde viven los bugs de
    seguridad (entropía, uso único, vencimiento, fijación de sesión, flags de cookie); escribirlos a
    mano es el atajo más caro. Requiere dominio propio con SPF/DKIM/DMARC, que es trabajo real de
    operación y no de código.

L14 (secuencia obligatoria en T2): retirar Access **después** de que la auth propia esté verificada
    en producción, nunca antes, o el hostname queda inaccesible. El bypass de dev conserva su doble
    condición (flag exacta + loopback) y su test.

L15 (riesgo): T2 item 2 (seguridad: sesiones, tokens, invitaciones). T3 item 1 y 2 (aislamiento de
    datos entre atletas). T4 item 3 (cambia la forma del payload y las referencias del historial).
    T1 y T5 item 5 (delivery).
