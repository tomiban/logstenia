# Critique por página (Impeccable, revisiones ciegas)

Tercera pasada de revisión sobre Logtenia: `/impeccable critique` por superficie, con revisores
**ciegos** — no leyeron `design-plans/` ni `odd/`, así que no saben qué encontró la auditoría de
diseño previa. Su valor es la independencia: donde coinciden, el hallazgo queda confirmado por dos
métodos distintos; donde agregan, traen lo que una auditoría de contrato no puede ver (fricción de
tarea, recuperación de errores, bugs de datos).

- Fecha: 2026-10-26
- Contrato: `DESIGN.md` (leído por cada revisor)
- Método: heurísticas de Nielsen 0–4 cada una (/40), especificidad de diseño, 2–3 personas,
  prioridades P0–P3, y lo que no se puede juzgar sin pantalla renderizada.
- Detector determinista: **no disponible** en este entorno. El binario corre (v4.7.0) pero
  `detect` devuelve 0 hallazgos sobre 36 archivos y 0 bytes sobre la URL viva; sus reglas de
  elemento (`low-contrast`, `tiny-text`) no se ejecutan sin página parseada. Se trata como
  ausente, no como limpio.
- Precedencia aplicada: `DESIGN.md` + `AGENTS.md` > `improve-ui` > `critique` > `audit` >
  `web-design-guidelines`.

## Puntajes

| Superficie | Nielsen /40 | P0 | P1 |
| --- | --- | --- | --- |
| `/metrics` | 20 | 1 | 4 |
| `/` (Home) | 20 | 0 | 7 |
| `/planes` | 16 | 0 | 5 |
| `/skill/:id` | 13 | 1 | 6 |
| `/program/:id` | 15 | 1 | 6 |

## P0 — bugs funcionales que la auditoría de diseño no podía ver

1. **`Metrics.tsx:149-163`** — el error de lectura deja `today === ''`, y `if (loading || !today)`
   devuelve el skeleton antes de cualquier otra rama: la pantalla queda cargando para siempre y el
   banner de error (`:224-231`) es código muerto. `today` debe inicializarse independientemente
   del fetch exitoso.
2. **`Program.tsx:162` + `:299`** — los modelos de benchmark se filtran de "Rutinas" y sólo se
   vuelven a pintar dentro de `anchors.length > 0`. Un benchmark cuyos ejercicios son todos `max`
   (por ejemplo `plans.json:1133-1156`) no produce ni un ancla, así que **queda inalcanzable**: no
   hay ruta en la UI para abrirlo. Fix: fila propia siempre presente para los modelos especiales.
3. **`Skill.tsx:101-108`** — `saveProg` deriva el nivel de la presencia de un tag
   (`principiante`/`intermedio`/`avanzado`) y cae a `beginner` por defecto; después agrega ese
   label a los tags. Editar un programa cuyos tags no traen nivel lo **degrada silenciosamente** a
   principiante y mueve su lugar en la cadena. El nivel tiene que ser un campo explícito del
   formulario, sembrado desde `p.level`.

## P1 transversales (aparecen en 3 o 4 superficies)

- **La affordance de hover/focus de las cards no existe.** `hover:border-ink` está escrito en
  `Planes.tsx:112`, `Program.tsx:400` y `Skill.tsx:271`, pero `Card` pinta `ring-1`, no `border`
  (`ui/card.tsx:13`), así que la clase es inerte; y ningún link de card tiene `focus-visible`.
  Es la navegación principal del producto y hoy no da feedback. Verificado en código.
- **Touch targets por debajo del mínimo del contrato.** Home: checkbox `h-4 w-4` (16px,
  `Home.tsx:299`) y CTAs `size="sm"` = 32px (`:310`, `:324`) en la pantalla de lanzamiento en el
  gimnasio. Planes: kebab `size="icon-sm"` = 28px (`:126`), botón de header 32px (`:74`). Skill:
  32px (`:172`). DESIGN pide 44px para uso en el gimnasio.
- **Validación que falla en silencio.** Nombre vacío hace `return` sin mensaje: `Planes.tsx:33-34`,
  `Skill.tsx:110`. El botón sigue habilitado y no pasa nada.
- **Mutaciones sin manejo de error.** `Planes.tsx:40-60` no tiene un solo `try/catch`, mientras su
  superficie hermana sí tiene `saveError` (`Skill.tsx:90-99`); y `getPlansRefreshError` existe
  (`plans.ts:146-151`) pero nunca se renderiza.
- **Beacon Rule rota en todas.** Lima compitiendo consigo misma: Home cinco señales
  (`:233,277,281,310,324`), Planes nav activo + botón accent (`Layout.tsx:96` + `Planes.tsx:74`),
  Skill un bloque lima por eslabón de cadena (`:247`).
- **Prosa en mono** (`label-caps` para frases): Home `:221,314,331,345`; Metrics `:227-229,423-424,
  454`; Skill `:238,244`; Planes `:71`. Es el mismo F2 del reporte `improve-ui`, ahora confirmado
  por cuatro revisores independientes.
- **Terminología**: el mismo objeto se llama "programas", "rutinas", "progresiones" y "cadena" en
  la misma pantalla (`Skill.tsx:172,236,281,284`; `Planes.tsx:122`). Confirma la pregunta abierta
  Q2 del reporte de auditoría.
- **Paleta pastel de tags** (`lib/tags.ts:100-108`) como segundo lenguaje de color. Confirma Q1.

## Por página

### `/metrics` — 20/40

Especificidad: estructura de dashboard genérico; la expresión sí es del sistema (readouts
`label-caps`+`.metric`, retícula hairline con `gap-px bg-border`, radio 0, sin sombras).

P1: el filtro de rango parece global pero sólo dos bloques lo respetan (`:187-193,236-241`); lima
en cuatro lugares (`:112,367,500,478` + `chart.tsx:63`); gráficos sin nombre accesible ni
equivalente textual y el de evolución esconde el eje de fechas (`:337-360,400-413,467-478`).
P2: un gráfico titulado "Duración" que grafica series cuando no hay duraciones (`:334` vs
`:192-193`); `0/0` sin sesiones comparables (`:320`); KPI en cero duplicando el empty state
(`:262-279,283-330`). P3: los cuatro readouts comparten tamaño (`:85`).

### `/` (Home) — 20/40

Especificidad: sí es este tablero (cards hairline, pares label/metric, `tabular-nums`, riel de
semana como motivo). Lo que la debilita: lima pulverizada y prosa en mono.

P1: el empty state dice "Elegí un plan" sin ofrecer el control (`:314`); **el mismo label
"Entrenar" lleva a dos destinos distintos** — `/routine/:id` en `:310` y `/program/:id` en `:324`;
cinco señales lima (`:233,277,281,310,324`); el contador "series" cuenta sesiones, no series
(`:150-155` · verificado: agrupa por `date|modelId` e incrementa de a uno por sesión); touch
targets de 16px y 32px (`:299,310,324`); la fecha se persiste en cada tecla y vaciarla borra el
ancla del mesociclo (`:210`); los títulos de card son `span` y la página tiene un solo heading
(`:196,257,297,338`).
P2: el mesociclo terminado sigue pintando la barra de semana actual (`:233` vs `:240`); el
historial omite el modelo y muestra ISO (`:359,368`); **`best` se calcula y nunca se renderiza**
(`:114-126` · verificado: sólo aparece en el tipo y el push, no en el JSX); banner de error sin
reintento ni cierre (`:189`); fecha futura clampeada a "semana 1" (`:67`).

### `/planes` — 16/40

Especificidad: cumple radio 0, hairline, sin sombras, un solo relleno lima — pero **le falta la
firma del sistema**: no hay ningún par `.metric`/`.label-caps`, así que estructuralmente es una
grilla de cards genérica.

P1: "Crear" habilitado con nombre vacío y sin mensaje (`:33-34`); tres mutaciones sin `try/catch`
(`:40-60`); kebab de 28px como única acción por card (`:126`); link de card sin foco visible
(`:120`); `hover:border-ink` inerte (`:112` vs `card.tsx:13`).
P2: "N progresiones" cuenta programas (`:122`); lima del nav compitiendo con el botón accent;
`bg-muted/50` en el footer de diálogo rompe Ink-or-Paper (`dialog.tsx:113`,
`alert-dialog.tsx:100`); borrado en cascada sin undo (`:56-60`); dropdown y menú contextual con
las mismas dos acciones (`:127-148`).

### `/skill/:id` — 13/40

Especificidad: la identidad colapsa a tipografía y borde; **sin readout de telemetría** se lee como
un CRUD genérico. La paleta pastel de tags contradice "una sola baliza".

P0: degradación silenciosa de nivel (`:101-108`). P1: los labels de nivel se persisten como tags, así
que dos principiantes dibujan una "cadena" (`:246` + `progression.ts:132-148`); editar la categoría
sólo existe como menú contextual sobre el `h1` y no hay borrar, mientras Planes sí tiene kebab
(`:151-158`); un bloque lima por eslabón (`:247`); "Categoría no encontrada." sin salida (`:84`);
nombre vacío sin validación (`:110`). P2: `hover:border-ink` inerte (`:271`); prosa en mono
(`:238,244`); pasteles (`lib/tags.ts:100`); `tagChainsForCategory` + `getProgram` recalculados por
card en el render (`:256-278`); sin `focus-visible` en cards ni cadena (`:260,272`). P3: `p-4`
apilado sobre el `--card-spacing` del Card (`:271`) — la m7 del reporte; empty state sin CTA
(`:236`); botón de 32px (`:172`).

### `/program/:id` — 15/40

Especificidad: a mitad de camino. La identidad aparece en `:276-287` (celdas hairline separadas por
`gap-px bg-border`, `label-caps` sobre `.metric`): eso *es* The Timing Board. Lo que la rompe: un
banner con relleno lima a sangre (`:259`), y tres CTAs `variant="accent"` simultáneos —"Nueva
rutina", "Ir al siguiente nivel", "Registrar marca"— más el banner (`:243,259,283,310`).

P0: el benchmark inalcanzable (`:162` + `:299`). P1: cuatro primarios lima compitiendo (Beacon
Rule); pasteles en los chips de tag (`:57-59`); prosa en mono (`:242,279,290,295`); no-op silencioso
al crear con nombre vacío, `totalTimeMin` sin validar y "Benchmark" sin explicar (`:200,224,236`);
las cards de rutina muestran sólo nombre y minutos (`:319-330`), sin intensidad ni conteo. P2: en
`/program/:id` ningún ítem del nav queda activo y no hay breadcrumb (`:129` + `Layout.tsx:22-27`);
`unlocked = true` por defecto hace que "Empezar plan" se vuelva "Bloqueado" después del
hidratado (`:73,84`); touch targets de 28px y 32px (`:333,243,283,310`); iniciar plan es
irreversible (`:268-276`). P3: el ancla lee "20 reps Dominadas" — valor y unidad antes del sujeto
(`:305-307`); "Rutinas" es un `span` sin `h2` (`:316`).

## Estado (2026-10-26)

Resueltos y commiteados: los tres P0 (métricas ya no queda en su skeleton, el nivel es un campo
explícito del formulario, los benchmarks sin anclas son alcanzables), la affordance de las cards
(hover sobre el ring que la card realmente pinta, más foco visible), los touch targets de gimnasio
a 44px medidos en 390px, el nav inferior con el tratamiento activo documentado, el nav de
escritorio marcando Planes en las rutas de detalle, y las mutaciones de Planes dejando de tragarse
los errores.

Sigue abierto, y es la parte de producto de esta pasada: los gráficos sin nombre accesible ni
equivalente textual, el filtro de rango que sólo respetan dos bloques, el panel "Duración" que
grafica series cuando no hay duraciones, el `0/0` sin sesiones comparables, la falta de ruta de
edición/borrado para los benchmarks, y el recálculo por card en Skill.

## Convergencia con la auditoría de diseño

Coincidencias independientes (suben la confianza a "confirmado por dos métodos"): prosa en mono
(F2), disciplina del lima (F7/F8 y m4/m4b), paleta pastel (Q1), terminología (Q2), doble padding de
card (m7), `hover:border-ink` inerte.

Hallazgos que sólo podía ver esta pasada: los dos P0, los touch targets de Home y Planes, la
validación silenciosa, las mutaciones sin manejo de error, la doble semántica de "Entrenar", el
contador de "series" que cuenta sesiones, y el `best` calculado y nunca mostrado.

## No juzgable sin pantalla renderizada

Proporción real del lima a 390px con varias cadenas; legibilidad de las 12 marcas del eje a
`interval={0}`; contraste de trazos de chart en oscuro sobre `#1a1a1a`; solapamiento de header
sticky con el nav inferior al final de un scroll largo; orden real de foco y anillo `--ring`;
si el popup de Base UI trae sombras que el contrato no anula; comportamiento del input date en iOS.
