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
| T3 | `/run/:id` en la misma gramática, conservando `useRunner` y sus tests | S2, S3 | pendiente |
| T4 | Documentar el sistema construido en `DESIGN.md` | S3 | pendiente |

## Delivery slices

- **Slice 1:** T1 + T2, `5d50822` y `12d68bd` — la regla del día y Home en señalética (391 tests).
- **Slice 2:** T3 — `/run/:id` en la misma gramática.

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
