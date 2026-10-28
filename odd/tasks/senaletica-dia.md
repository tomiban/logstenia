# Señalética del día — la decisión y el arranque

Rama `feat/senaletica-dia`. La composición de señalética que el atleta aprobó pasa a ser la
estructura de las dos superficies donde se juega el producto: `/` (qué entrenar hoy y cómo
arrancarlo) y `/run/:id` (la sesión guiada). Contrato de mundo: `DESIGN.md`, sin cambios.

## Specs

S1. Pedido original, verbatim:

```text
design a Calisthenics training app for one athlete. Make what to train today and how to start it clear.
```

S2. Alcance aprobado en la ronda de decisión, verbatim: "Reemplazar la composición de / y
/run/:id" — "La señalética del Logbook pasa a ser la estructura de esas dos pantallas. Se conserva
la lógica, los hooks y los tests del runner; lo de T7/T8 en esas dos vistas queda superado."

S3. `DESIGN.md` sigue siendo la única fuente de verdad: radio 0, cero sombras, una sola baliza
(lima ≤10% de la pantalla), mono tabular para todo dato. La banda usa `--ink`/`--on-ink` y la
acción `--accent`/`--on-accent`, así que funciona igual en claro y oscuro sin tokens nuevos.

S4. Nada de lo que el producto ya hacía se pierde: mesociclo con fecha de inicio, semana de 7
días, programas iniciados con su progreso, calentamiento, últimos entrenamientos y los estados de
error/recarga siguen existiendo, recompuestos en la gramática de señalética.

## Mapa

| Superficie | Composición |
| --- | --- |
| `/` | banda de destino (rutina del día) · acción lima al borde · franja de bloque · puertas numeradas de cada bloque · readout de mesociclo y semana · índice de programas · últimos entrenamientos |
| `/run/:id` | pendiente: misma gramática (banda con el ejercicio, marca de la última vez, series, descanso, barra de acción) sin tocar `useRunner` ni sus tests |

## Tasks

| ID | Unidad | Specs | Commit |
| --- | --- | --- | --- |
| T1 | `hoy.ts` + `hoy.test.ts`: regla del destino del día y dosis de bloque, test-first | S1, S2 | `5d50822` |
| T2 | `/` Home recompuesta en señalética, sin perder ninguna capacidad | S2, S3, S4 | `12d68bd` |
| T3 | `/run/:id` en la misma gramática, conservando `useRunner` y sus tests | S2, S3 | `70a4b3e` |
| T4 | Documentar el sistema construido en `DESIGN.md` | S3 | `e9abba5` |

## Delivery slices

- **Slice 1:** T1 + T2, `5d50822` y `12d68bd` — la regla del día y Home en señalética (391 tests).
- **Slice 2:** T3, `70a4b3e` — `/run/:id` en la misma gramática, con el plato de descanso intacto.
- **Slice 3:** T4 — documentar la gramática en `DESIGN.md`.

## Log

L1. Pedido del usuario, verbatim: ver S1.

L2. Corrección de destino, verbatim: "yo queria que apliques el diseño en el proyecto
@Documentos/rutinas/" — el diseño se construyó primero en otro repo; se porta acá.

L3. Decisión de alcance en el cuestionario previo, verbatim: "Reemplazar la composición de / y
/run/:id".

L4. Base medida antes de tocar: 30 archivos / 381 tests en verde, `oxlint` con 19 advertencias
preexistentes (todas en `features/runner`), `npm run build` en verde.

L5. T1 cerrado con test-first: diez casos sobre `destinoDeHoy` (sin sesiones, siguiente del
programa, ciclado, sesión de hoy fija el modelo, gana el programa de la última sesión, sesión
abandonada no adelanta, programa fuera del catálogo) y tres sobre bloques/dosis.

L6. T2 cerrado: `/` recompuesta. Verificado con 391 tests (31 archivos), lint en 19 (sin
advertencias nuevas), `build` en verde, y captura real a 390×844 claro/oscuro y 1440×900 sobre
datos sembrados (`handstand-intermedio`, dos sesiones completadas → destino "Balance - Nivel 2
(pino en pared)", cinco puertas).

L7. T3 cerrado: `/run/:id` recompuesta sin tocar `useRunner`, `steps.ts`, `rest.ts`, `session.ts`,
`Cronometro.tsx` ni un solo test. Verificado con 391 tests en 31 archivos, lint en 19 (las de
siempre), `build` en verde y capturas reales a 390×844 claro/oscuro, 1440×900 y el plato de descanso
en curso (60s contando, −10/+10, saltar). El paso multi-ejercicio (biserie) conserva su encabezado
propio; el de un solo ejercicio lo delega a la banda para no repetirlo.

L8. T4: la gramática quedó documentada en `DESIGN.md` como sección propia ("Señalética del día"), con
las dos escalas de título, la regla de la flecha al borde y las invariantes que la señalética no toca.

## Contrato cerrado (post-critique)

S5. El atleta decidió, después del critique 23/40: **decidir el contrato antes de tocar código**,
verbatim: "Decidir el contrato antes de tocar código". `DESIGN.md` quedó reconciliado en cinco
puntos, sin cambios de código:

1. **The Beacon Rule con presupuesto:** máximo dos marcas lima por pantalla (la acción principal y
   una marca de estado); la banda **no** lleva baliza — kicker y flecha se escriben en el color de
   texto de la banda.
2. **Jerarquía reconciliada:** el titular de página de 24px rige las cinco superficies de ficha; las
   dos de señalética usan banda con dos escalones (destino 3.5rem / ejercicio 2.75rem). Una
   superficie tiene banda **o** titular, nunca las dos.
3. **Piso de 11px** (The Eleven-Pixel Floor) y `.label-status` pasa de 10 a 11px.
4. **Dos registros declarados** (señalética vs ficha) con las invariantes que no cambian, y el rol
   explícito de las tres formas de "serie" (puntos = vista previa, `S1..Sn` = entrada, puertas =
   navegación).
5. **La banda es siempre el plano más oscuro del tema:** en claro `--ink`, en oscuro `--surface` con
   hairline, nunca el blanco de la tinta invertida.

## Derivados del contrato

Ninguno ejecutado todavía: el atleta pidió cerrar el contrato primero. Orden por severidad del
critique.

| # | Cambio | Origen | Ruta |
| --- | --- | --- | --- |
| D1 | Banda en oscuro: `--surface` + hairline en lugar del blanco invertido | critique P1-2 · contrato §5 | inline |
| D2 | Marca de la última vez en `/run` (`mejor anterior · fecha` + fantasma por serie), usando `r.history` sin tocar `useRunner` | critique P1-1 · S2 | inline |
| D3 | Puertas con destino propio: ancla de bloque, o dejar de numerar | critique P1-3 | inline |
| D4 | Salida de la sesión y cierre que vuelva a `/` | critique P1-4 | inline |
| D5 | Kicker y flecha de la banda a texto al 70% (salen del presupuesto de lima) | contrato §1 | inline |
| D6 | `.label-status` a 11px (nav, badges, `S1..Sn`) | contrato §3 + detector | inline |
| D7 | Acción `Siguiente` de la barra a ≥44px de alto (medido 131×36) | critique P2 · detector | inline |
| D8 | `totalTimeMin` saneado o no exhibido (dice 8 min donde la dosis implica ~15) | critique P2-6 | inline |
| D9 | Mesociclo fuera del primer viewport (revelado, no en medio del entrenamiento) | critique P2-7 | inline |
| D10 | Acción principal de las cinco vistas con la anatomía de `.accion` en línea | contrato §4 | **pendiente** |
| D11 | Un solo indicador de foco (anillo de 2px) también en enlaces | critique menores | inline |
| D12 | El cierre de sesión no corona un conteo | critique journey | inline |

L9. D1-D9 y D12 aplicados en `7e63d56`: banda oscura sobre `--surface`, kicker y flecha fuera del
presupuesto de lima, marca de la última vez en la banda y fantasma `antes N` por serie, `Salir` en el
borde de la sesión, cierre que vuelve a la app, puertas con ancla de bloque (`#bN`, con `scrollIntoView`
por ref en `Routine`), `.label-status` a 11px, acción de la barra a 44px, mesociclo plegado y series
reales en vez de `totalTimeMin`. Verificado con 391 tests, lint 19, build en verde y medición en
navegador: `última vez 8 · 8 · 7`, `antes 8/8/7`, altura de acción 44, kicker `oklab(0.72…)` (neutro),
banda oscura `rgb(26,26,26)`, cero sombras, cero radios, y la puerta `03` aterrizando en `#b3`.

L10. D11 en `pendiente-doc`: los enlaces usaban el outline del navegador (1px auto) mientras los
botones llevaban anillo de 2px; ahora comparten `a:focus-visible { outline: 2px solid var(--ring) }`.

L11. D10 sigue abierto: llevar la anatomía de `.accion` en línea a las cinco superficies de ficha.
Es la única deuda del contrato y la que más reescribe de T2-T7, así que va por ola con un commit por
vista.
