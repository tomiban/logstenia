# UI polish — the rendered critique (pass 4)

Cuarta pasada de revisión sobre Logtenia, y la primera que juzga **píxeles**. Las tres anteriores
(`ui-audit-findings.md`, `critique-per-page.md` y el seguimiento en `odd/`) leyeron código y
declararon lo que no podían juzgar: «proporción real del lima a 390px, contraste de los trazos del
chart en oscuro, solapamiento del header, orden de foco, si el popup trae sombras». Esta pasada
ataca esa lista.

- Fecha: 2026-10-26
- Contrato: `DESIGN.md` + `AGENTS.md`. Sus overrides gobiernan: radio 0, cero sombras, densidad,
  una sola baliza, tags pastel, sin memoización manual.
- Evidencia: capturas reales de Chromium de las siete rutas con datos sembrados (16 sesiones, 6
  marcas, progreso semanal, tags, mesociclo de 16 días), a **390px y 1440px**, en **claro y
  oscuro**, más el código de cada superficie. Las capturas son evidencia de la pasada, no un
  fixture del repo.
- Método: mirada propia sobre el render + tres revisores **ciegos** independientes (no leyeron
  `design-plans/` ni `odd/`), uno por par de superficies.

Severidad: **P0** tarea bloqueada, dato falso o contenido inalcanzable · **P1** cuesta esfuerzo
real o rompe una regla nombrada · **P2** pulido · **P3** detalle.

## Hallazgos transversales

| # | Sev | Evidencia | Problema | Fix |
| --- | --- | --- | --- | --- |
| G1 | P1 | `index.css` (antes: `html, body, #root { height:100%; overflow-x:hidden }`) | Los tres nodos se volvían contenedores de scroll anidados: **el documento no scrolleaba**, así que PageDown y `window.scrollY` estaban muertos. El scroll ocurría dentro de `#root`, invisible para el navegador y para cualquier `scrollTo`. | `overflow-x: clip` (no crea contenedor) y sin alturas fijas; test e2e que exige rueda **y** teclado (falló antes, pasa después). |
| G2 | P1 | `SettingsMenu.tsx` (`outline size="lg"` con el texto `tomas`) | El control de ajustes ocupaba ~35% del header móvil, en mayúsculas mono con borde: se leía como la acción principal del producto y competía con el CTA real de cada pantalla. | Control fantasma compacto (glifo + nombre del perfil, 44px). Rediseño del shell, no del flujo. |
| G3 | P1 | `Program.tsx:194,200,368` — lima sobre papel: **1.03:1** | "desbloqueado", "completado" y el ✓ de anclas cumplidas eran ilegibles en claro. El contrato no lo prohibía: su regla de contraste enumeraba otros tokens. | **The Lime-is-a-fill Rule** en `DESIGN.md`: el lima rellena y marca, nunca es texto sobre papel. Estado en tinta + marca lima al lado. |
| G4 | P1 | `Home.tsx` raíl del mesociclo | En oscuro `bg-primary` resuelve a lima: semanas pasadas y actual quedaban lima/lima y la única diferencia era un anillo de 1px. La semántica se colapsaba justo en el tema donde el lima es más fuerte. | Estados explícitos: pasado `bg-ink`, actual `bg-accent ring-1 ring-ink`, futuro `bg-secondary`. |
| G5 | P1 | `Planes.tsx:159` «1 progresiones», `Metrics.tsx` «MEJOR 1 DÍAS», `Routine.tsx:500,699` «4 VUELTA(S)», `Skill.tsx:298` «1 rutinas» | Concordancias resueltas con plural fijo o con un `(s)` de formulario. Se lee como bug porque lo es. | `pluralForm()` en `lib/format.ts`, con test, aplicado en todos los sitios. |
| G6 | P1 | `Planes:74,159` vs `Skill:243,298` vs `Program:316` | Tres nombres para dos entidades: la misma cosa era «progresiones», «programas» y «rutinas», y «rutina» además nombraba al modelo. | Vocabulario único (L4): categoría → programa → rutina; «progresión» sólo como cadena. |
| G7 | P1 | `Home:220,247`, `Metrics:247,262,270`, `Program:279`, `Routine:500` | Frases de prosa compuestas en mono 11px UPPERCASE: el ojo tiene que deletrear cada metadato. Rompe The Mono-means-data Rule. | La frase en cuerpo (`text-sm text-muted-foreground`); el número en `.metric` con su unidad en `label-caps`. |
| G8 | P2 | `Home:247` (`2026-10-31`), `Metrics:119` (`02/10`), `Home:186` (`lunes, 26 de octubre`) | Tres formatos de fecha, y el ISO crudo mostrado al usuario. | `formatDayMonth()` en `lib/date.ts`, con test; ISO queda en storage. |
| G9 | P2 | `Runner:365` (`-mx-4 sm:-mx-6`) | El gutter del shell es 24px: en móvil la barra quedaba 8px adentro y su `border-t` flotaba. | Barra de sesión a sangre, con la nav fuera del camino. |

## Shell y `/` (Home)

| # | Sev | Evidencia | Problema | Fix |
| --- | --- | --- | --- | --- |
| H1 | P1 | `Home.tsx` historial | El contador dice «series» y cuenta **sesiones** (`h.series += 1` por sesión). | «sesiones» con `pluralForm`. |
| H2 | P1 | `Home.tsx` block de entrenamiento | Dos CTAs con el mismo texto «Entrenar» llevan a destinos distintos (`/routine/:id` y `/program/:id`). | Verbos distintos por destino. |
| H3 | P2 | `Home.tsx` empty state | «Elegí un plan para empezar» sin ofrecer el control. | Link a `/planes`, con el vocabulario nuevo. |
| H4 | P2 | `Home.tsx` `best` | `best` se calcula por programa y nunca se renderiza: trabajo pagado sin salida. | Readout «mejor marca» con unidad. |
| H5 | P2 | `Home.tsx` `semana > MESO.total` | El mesociclo terminado sigue pintando una semana «actual». | Todas las semanas como pasadas + el mensaje existente. |
| H6 | P2 | `Home.tsx` banner de error | `role="alert"` sin descarte ni reintento. | Descarte explícito. |
| H7 | P3 | `Home.tsx` tarjeta de entrenamiento | Hasta tres párrafos explicativos a la vez. | Uno por estado. |

## `/planes` y `/program/:id`

| # | Sev | Evidencia | Problema | Fix |
| --- | --- | --- | --- | --- |
| P1 | P1 | `program-mobile-light-p1`, `Program.tsx:163,170,243,283,310` | Hasta cinco señales lima en pantalla (badge COMPLETADO, «Nueva rutina», «desbloqueado», DESBLOQUEADO, «Ir al siguiente nivel») con dos CTAs accent simultáneos. | Un solo accent: la acción que arranca el trabajo de hoy; el resto outline/ghost; badges outline. |
| P2 | P1 | `Program.tsx:339` (`grid sm:grid-cols-2 gap-px bg-border`) | Con objetivos **o** reglas, la grilla deja una columna `#d0d0d0` plana que se lee como contenido faltante. | Columnas condicionales y separador `divide-*` sobre `bg-card`. |
| P3 | P1/P2 | `Program.tsx:177-200,283,306-317` | El mismo destino se anuncia tres veces (fase, «más difícil», tarjeta «siguiente nivel») con tres nombres para un concepto. | Un bloque de progresión: `NIVEL 1 de 3 · SIGUIENTE: X` + el CTA único; «← Más fácil» conserva la navegación inversa. |
| P4 | P2 | `Program.tsx` cards de rutina | Muestran sólo minutos y una rutina nueva dice «0 min»; la intensidad se edita en el diálogo y nunca se ve. | Telemetría: duración / intensidad / ejercicios. |
| P5 | P2 | `Planes.tsx` kebab, CTAs de header | Objetivos de 28px y 32px donde el contrato pide 44px. | `icon-lg` / `size="lg"`. |
| P6 | P2 | `Planes.tsx`, `Program.tsx` | Sin empty state: grilla vacía sin mensaje ni acción. | Mensaje + acción. |
| P7 | P2 | `Program.tsx` diálogo | «Benchmark» en inglés para una rutina que se llama «Toma de marcas». | Copia en español. |
| P8 | P3 | `plans.json` | Categoría «Movilidad & Flexibilidad»: el `&` es de formulario, no de interfaz. | «Movilidad y Flexibilidad». |

## `/routine/:id`

| # | Sev | Evidencia | Problema | Fix |
| --- | --- | --- | --- | --- |
| R1 | P1 | `routine-mobile-light-p2`, `Routine.tsx` al final del documento | «Iniciar rutina» —la única acción de la pantalla— vive al final y en 390px queda detrás de la nav inferior fija. Quien abre la rutina para lanzarla no ve cómo lanzarla. | Barra de acción persistente sobre la nav (`fixed bottom-[57px] z-40`), accent, `size="lg"`, con padding reservado. |
| R2 | P1 | `Routine.tsx:500,699` + `fmtRest` | «SINGLE 4 VUELTA(S) · DESCANSO 2MIN»: inglés filtrado, `(s)` de formulario y prosa en mono. | `BLOQUE n` 1-based + `BLOCK_TYPE_LABEL` + pares de telemetría (`pluralForm`, `restLabel`). |
| R3 | P1 | `routine-mobile-light-p1` | El campo de etiquetas encabeza la pantalla sin label y con el peso visual de un buscador. | Label real, chips de las etiquetas existentes, campo secundario. |
| R4 | P2 | `routine-mobile-light-p1` | «Editar rutina» flota bajo las etiquetas; el botón de video es una caja gris de 32px. | Acción secundaria junto al título, `size="lg"`; video con caja táctil de 44px y nombre accesible. |
| R5 | P2 | `Routine.tsx` | «max hold» y otros restos en inglés. | «mantenimiento máx.». |

## `/run/:id`

| # | Sev | Evidencia | Problema | Fix |
| --- | --- | --- | --- | --- |
| N1 | P1 | `Runner.tsx` slider `max={20}` vs `plans.json` (holds de 30, 35, 40 y 60s) | El control de segundos no llega al objetivo prescrito: sólo lo salva el atajo «Usar tiempo». | `max` derivado del objetivo (`max(20, timeSec*2)`). |
| N2 | P1 | `Runner.tsx:365` + `Layout.tsx:101` | La barra `sticky bottom-0` flota a media pantalla con contenido corto, hace wrap a tres filas en 390px y con contenido largo queda debajo de la nav fija (z-30): «Siguiente» inalcanzable. | Barra de sesión `fixed bottom-0 z-40`, `nowrap`, 44px, y la nav inferior oculta en `/run`. |
| N3 | P1 | `Runner.tsx:110,113,129,131,368` | «confirmar/editar» `h-8`, «+/- serie» `h-9`, «Anterior/Siguiente» `h-9`: el flujo de gimnasio pide 44px. | `size="lg"`. |
| N4 | P2 | `Runner.tsx:352-355` + `useRunner` `confirmTypedValues()` | El diálogo dice que las series pendientes «se omiten», pero «Continuar» **registra** los valores ya tipeados. | Copia que describa lo que pasa y conteo coherente. |
| N5 | P2 | `Runner.tsx:64-68` | «OBJETIVO 4-8 REPS · 4 SERIES · DESCANSO POR SERIE 120S · DESCANSO FINAL 120S»: prosa en mono. | Readouts: `OBJETIVO` / `SERIES` / `DESCANSO` con `.metric` y `restLabel`. |
| N6 | P2 | `Cronometro.tsx`, `Runner.tsx:60` | «GO!», badge `{block.type}` crudo y «BLOQUE 0» (índice cero visible). | «¡YA!», `BLOCK_TYPE_LABEL`, «Bloque 1». |
| N7 | P2 | `Runner.tsx:310` | La barra de progreso es lima y el botón primario también. | Progreso en tinta; el lima queda para la acción. |
| N8 | P3 | `Runner.tsx:270` | Banner de error con relleno lima. | Token destructive. |
| N9 | P3 | `Runner.tsx:266` | «Rutina no encontrada.» como párrafo suelto: callejón sin salida. | Superficie de card + vuelta a `/planes`. |

## `/metrics`

| # | Sev | Evidencia | Problema | Fix |
| --- | --- | --- | --- | --- |
| M1 | P1 | `Metrics.tsx` + `metrics.ts` | El filtro de rango miente: el header promete «últimos 30 días» y sólo la telemetría superior lo respeta; el resto ignora la selección. | Todos los bloques se calculan sobre la ventana (`windowsFor`/`inWindow`), con tests de ventana. |
| M2 | P1 | `Metrics.tsx` panel «Duración por sesión» | Sin `durationSec` el panel grafica **series** y sigue titulándose «Duración». | Título derivado de la medida real. |
| M3 | P1 | `metrics.ts` `previousIndex` | La etiqueta dice «vs la sesión anterior del mismo plan» pero, sin historial del plan, compara contra otro plan: «4/12 sesiones ganadas» cuenta comparaciones que el texto niega. | `null` sin historial del mismo plan, con test. |
| M4 | P2 | `Metrics.tsx` badge PR + `isFresh` sin usar | El badge PR se pinta en **toda** marca (el delta es siempre positivo por construcción) y `isFresh` se calcula y no se usa: la baliza deja de significar «esto cuenta». | PR sólo en marcas frescas. |
| M5 | P2 | `chart.tsx`, `Metrics.tsx` | Ningún chart tiene nombre accesible, y los cuadraditos bajo el eje (lima = sesión ganada, tinta = semana actual) no tienen leyenda: significado sólo por color, contra el contrato. | `role="img"` + `aria-label` con la tendencia, leyenda `label-caps` y equivalente textual en `<details>`. |
| M6 | P3 | `Metrics.tsx:322,335` | «MEJOR 1 DÍAS», «vs 30 d previos», «+12 VS 30 D PREVIOS». | `pluralForm` y prosa; números en `.metric`. |
| M7 | P3 | `Metrics.tsx` sesiones ganadas | «0/0» cuando no hay comparables: denominador imposible. | `—` + «sin sesiones comparables». |

## `/skill/:id`

| # | Sev | Evidencia | Problema | Fix |
| --- | --- | --- | --- | --- |
| S1 | P1 | `skill-mobile-light-p1` + `progression.ts` | Hay tres programas `BLOQUEADO` y **ninguna** estructura visible que los ordene: el bloqueo sale de `chainFor()` (cadenas estáticas incluidas) pero el raíl sólo dibuja cadenas por tags. | Posición en `chainFor()` por programa y el motivo del bloqueo en palabras. |
| S2 | P1 | `Skill.tsx:243` | «Sin progresiones curadas aún» contra todo el resto, que dice «programa». | Vocabulario único. |
| S3 | P2 | `Skill.tsx:230-241` | «¿Borrar programa?» sin nombrar el programa, aunque `deletingProg.name` está a mano. | Nombre en título y descripción. |
| S4 | P2 | `Skill.tsx:151-158` | Editar categoría sólo existe como menú contextual sobre el `h1`: invisible en un teléfono. | Afordancia visible de 44px. |
| S5 | P2 | `Skill.tsx` banners | Errores pintados con `border-ink`. | Token destructive + `role="alert"`. |
| S6 | P2 | `Skill.tsx:256-278` | `tagChainsForCategory`/`getProgram` se recalculan por card: N programas cuestan N barridos del catálogo. | Dato derivado una vez por render. |
| S7 | P2 | `Skill.tsx:247` | Un bloque lima por eslabón de la cadena compite con el accent. | Tratamiento outline: la cadena es estructura, no señal. |

## Hallazgos que aparecieron al verificar el pulido

| # | Sev | Evidencia | Problema | Fix |
| --- | --- | --- | --- | --- |
| V1 | P1 | `ui/chart.tsx` `ValueTick`, captura final de `/metrics` a 390px | El eje X imprimía `dd/mm` bajo **cada** barra: con 12 barras los rótulos se pisaban ("02/1005/1008/10…"). Justo lo que la pasada anterior declaró «no juzgable». | El rótulo de fecha va en un paso alineado a la última barra (el valor se imprime siempre), y la primera y la última se anclan `start`/`end` para no colgarse del área de trazado. |
| V2 | P2 | captura final de `/metrics` | La nota de la leyenda seguía siendo una frase en `label-caps` («sin cuadrado = sin sesión previa del mismo plan»). | Las marcas quedan en `label-caps`; la nota pasa a `text-xs` de cuerpo. |
| V3 | P2 | `Home`, `Program`, `Routine`, `Planes`, `Metrics`, `Skill` | Los siete `h1` de pantalla usaban tres escalas distintas (`text-lg`, `text-2xl`, `text-3xl`): el mismo rol con tres tamaños. | Una sola escala (`text-2xl`) y la regla escrita en `DESIGN.md`. |
| V4 | P2 | captura de `/skill/:id` antes de compactar | El raíl de progresión duplicaba nivel y estado en cada nodo, envolvía a dos líneas y empujaba la primera tarjeta accionable fuera del primer viewport. | Nodo de una línea: número + nombre + marca de estado (cuadro lleno = completado, contorno = bloqueado) con el estado también en `sr-only`. |
| V5 | P2 | `Skill.tsx` | El motivo del bloqueo era `describeLock()` completo: cinco criterios en una tarjeta de grilla. | Una línea: «Bloqueado: completá X o superá N marcas». Los criterios siguen en `/program`. |
| V6 | P2 | `Runner.tsx` fila de serie | El input de reps medía 96px y dejaba media fila muerta a la derecha en 390px. | El input crece (`flex-1`) y el objetivo táctil pasa a ser la fila. |
| V7 | P3 | `App.tsx` `PageFallback` | El fallback de la ruta era texto suelto, sin `role="status"` ni `aria-busy`. | Estado accesible en el fallback. |

## Rediseños aplicados (S2)

1. **El shell deja de competir.** Ajustes pasa a control fantasma compacto y la nav inferior se
   oculta durante la sesión guiada. El header queda con un solo peso: la marca; la acción vive en
   cada pantalla.
2. **`/routine` con barra de acción persistente.** La acción que define la pantalla («Iniciar
   rutina») pasa de estar al final del documento, detrás de la nav, a una barra fija en zona de
   pulgar. Cero scroll para empezar.
3. **`/run` como sesión inmersiva.** Una sola barra de control fija, sin wrap, con la nav fuera del
   camino, y el progreso en tinta para que el lima signifique una cosa sola: la acción.
4. **`/program` con un solo anuncio de progresión.** Los tres anuncios redundantes del siguiente
   nivel se funden en un bloque `NIVEL n de m` con el CTA único; el primer viewport recupera
   frecuencia, objetivos y reglas.
5. **`/skill` ordena lo que bloquea.** El estado de bloqueo deja de ser un chip aislado: cada
   programa muestra su lugar en la cadena y el motivo en palabras.

## No juzgable sin más contexto

- Popups de Base UI (sombras de librería) y comportamiento del `input type=date` en iOS: siguen sin
  verificación en dispositivo real.
- Orden real de tabulación dentro de los diálogos y menús contextuales: revisado en código, no
  medido.
- ~~Saturación del eje X de los gráficos a 390px con 12 marcas~~ — **medido en esta pasada**: los
  rótulos se pisaban; ver V1.
- Rendimiento del catálogo con cientos de programas: fuera de esta pasada (no se midió).

## Estado de implementación

Aplicado y verificado el 2026-10-26 sobre la misma rama:

- `npm run build` (tsc -b + vite build + PWA): limpio.
- `npm run lint` (oxlint): 0 errores; quedan 19 warnings, todos preexistentes (refs y
  exhaustive-deps en `useRunner`, primitivas de librería).
- `npm test`: 29 archivos, **335 tests** en verde (eran 301 al empezar: 34 casos nuevos para
  `pluralForm`, `restLabel`, `formatDayMonth`, `countPendingSets`, `progressionChainsForCategory` y el
  recorte por rango de las métricas).
- `npx playwright test`: **40 tests** en verde en `mobile` y `desktop`, incluido el nuevo test que
  exige que el documento scrollee con rueda **y** con teclado.
- Capturas de verificación después del pulido: las siete rutas otra vez en 390px y 1440px, claro y
  oscuro. Las que dirigieron los últimos arreglos (V1, V2, V4) son las de `/metrics` y `/skill`.

Riesgo del cambio, por la lista del contrato: **ítem 3** — cambia contratos que otros ya consumen:
copy y nombres de UI que la suite e2e asertaba (`descanso por serie 90s`, `Finalizar entrenamiento`,
`Quedan N series sin registrar`), la escala de los `h1` y la regla de que el lima no es color de
texto. Todo está cubierto por tests actualizados en el mismo cambio, pero un lector de la UI anterior
va a notar el cambio de vocabulario.
