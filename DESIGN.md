---
name: Logtenia
description: Logtenia de calistenia — retícula suiza, telemetría en mono y una sola baliza lima.
colors:
  voltage-lime: "#ccff00"
  ink: "#111111"
  on-ink: "#ccff00"
  on-accent: "#111111"
  paper: "#f0f0f0"
  surface: "#ffffff"
  foreground: "#191c1d"
  muted-surface: "#f3f4f5"
  muted-ink: "#555555"
  hairline: "#d0d0d0"
  alert: "#ba1a1a"
typography:
  display:
    fontFamily: "Space Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  heading:
    fontFamily: "Space Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontWeight: 700
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Hanken Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontWeight: 400
  label:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: "14px"
    letterSpacing: "0.08em"
  metric:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontWeight: 700
    letterSpacing: "-0.05em"
    fontFeature: "tabular-nums"
rounded:
  none: "0px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
components:
  button-accent:
    backgroundColor: "{colors.voltage-lime}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.none}"
    padding: "12px 24px"
  button-accent-hover:
    backgroundColor: "transparent"
    borderColor: "{colors.voltage-lime}"
    textColor: "{colors.ink}"
  button-ink:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.on-ink}"
    rounded: "{rounded.none}"
    padding: "8px 16px"
  button-outline:
    textColor: "{colors.ink}"
    borderColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "12px 20px"
  badge-status:
    backgroundColor: "{colors.voltage-lime}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.none}"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.none}"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.none}"
---

# Design System: Logtenia

## Overview

**Creative North Star: "The Timing Board"**

El sistema se lee como el tablero de tiempos de una pista: números que mandan, reglas finas que
ordenan, y una sola luz lima que marca cuándo algo cuenta. No hay decoración compitiendo por la
atención; hay datos y la retícula que los sostiene. Todo es eléctrico y preciso, con una calma
fría de instrumento: el color de fondo es papel técnico, la densidad es alta y cada píxel tiene
una función. Es el estilo suizo aplicado a una telemetría de entrenamiento.

La personalidad vive en el contraste: superficies blancas sobre un papel casi neutro, líneas de
1px en lugar de sombras, tipografía mono para todo lo que es un número. El acento lima aparece
poco y por eso pesa: aparece cuando marcas un récord, cuando un filtro está activo, cuando algo
es "tu mejor". Si el lima estuviera en todos lados, dejaría de significar.

Es una interfaz **Operate**: el visitante entrena y registra, no admira. La expresión va en la
precisión —la alineación, el mono tabular, la retícula—, no en el ornamento.

**Key Characteristics:**
- Retícula suiza: alineación dura, reglas hairline, ritmo de 4/8/16/24.
- Esquinas 0 y bordes de 1px: la forma es rectangular, nunca redondeada.
- Mono tabular para todo número; display y cuerpo en grotescas.
- Una sola baliza (Voltage Lime) reservada para estado, logro y acción.
- Plano por defecto: sin sombras; la profundidad se da por color de fondo y línea.

## Colors

Paleta de instrumento: tinta sobre papel técnico, con una única señal lima.

### Primary
- **Voltage Lime** (#ccff00): la baliza. Rellena el botón de acción principal, marca el estado
  activo de un filtro/nav, y etiqueta el PR o la métrica destacada. Es la única señal.

### Neutral
- **Ink** (#111111): texto de máxima jerarquía y fondo del estado activo (nav/botón). También es
  el color de foco (`--ring`).
- **On Ink** (Voltage Lime): texto sobre relleno Ink. No se invierte con el tema.
- **On Accent** (#111111): texto sobre relleno Voltage Lime. Fijo en ambos modos: la lima siempre
  lleva tinta encima.
- **Foreground** (#191c1d): color de texto por defecto del cuerpo.
- **Paper** (#f0f0f0): fondo de la página. Papel técnico, apenas más frío que blanco.
- **Surface** (#ffffff): fondo de tarjetas y controles, un escalón por encima del papel.
- **Muted Surface** (#f3f4f5): rellenos secundarios (raíles, celdas inactivas).
- **Muted Ink** (#555555): texto secundario, labels y metadatos.
- **Hairline** (#d0d0d0): bordes de 1px y reglas. Hace el trabajo que en otros sistemas haría
  una sombra.
- **Alert** (#ba1a1a): solo para error o destructivo. No es parte de la identidad.

### Dark mode
El tema oscuro no es un gris apagado: es negro de tablero con la misma baliza lima, que gana
protagonismo porque el negro la hace brillar. Los valores viven en el bloque `.dark` de
`app/src/index.css`.

- **Background** (#111111) y **Card** (#1a1a1a): el papel y la superficie se invierten.
- **Ink** (#f8f9fa): la tinta se invierte. `text-ink`, `border-ink`, `ring-ink` son texto y borde
  claros de máxima jerarquía. Bajo ninguna circunstancia se usa `#111111` como texto sobre fondo
  oscuro.
- **On Ink** (#111111): texto sobre relleno Ink, que en oscuro es papel.
- **On Accent** (#111111): igual que en claro, porque la lima no cambia.
- **Muted Surface** (#2e2e2e): raíles de sliders y cursor de los charts; un escalón sobre la
  tarjeta, no gris claro.
- **Hairline** (#2a2a2a) y **Muted Ink** (#8a8a8a): el borde y el texto secundario suben de tono
  para seguir siendo legibles.
- **Alert** (#ffb4ab): el rojo de texto se aclara; `#ba1a1a` sobre negro no se lee.
- **Primary** (Voltage Lime, texto #111111): el estado activo de un filtro o segmento se rellena
  de lima. En oscuro la lima se permite algo más que en claro: es la sinergia del tema.
- **Regla de contraste:** todo texto semántico (`ink`, `muted`, `foreground`, `destructive`) y el
  texto sobre rellenos (`on-ink`, `on-accent`, `primary-foreground`) debe superar 4.5:1 contra su
  superficie. `app/src/index.css.test.ts` lo verifica con los tokens reales, en ambos modos.

### Named Rules
**The Beacon Rule.** El Voltage Lime ocupa ≤10% de cualquier pantalla y **como máximo dos marcas
por pantalla**: la acción principal y una marca de estado (un PR, un día entrenado, el punto de
descanso). Una tercera marca lima es deriva: se degrada a tinta o a texto muted.

**La banda no lleva baliza.** La banda de destino es una *señal*, no una luz: su kicker y su flecha
se escriben en el color de texto de la banda (papel al 70% en claro, tinta al 70% en oscuro). El
lima queda para lo que el atleta puede tocar o para el estado que acaba de ganar.

**The Lime-is-a-Fill Rule.** El lima rellena, bordea y marca; **nunca es el color del texto sobre
papel o superficie**. `#ccff00` sobre `#f0f0f0` da 1.03:1: no es una preferencia, es ilegible. El
estado se escribe en tinta (`text-ink`/`text-foreground`) y el lima queda como marca al lado
(cuadrado de 8px) o como relleno con `text-on-accent` encima. Los únicos textos lima admitidos son
los que viven sobre el overlay negro del descanso.

**The Ink-or-Paper Rule.** Un elemento es tinta sólida o papel, nunca un gris intermedio de
relleno "para suavizar". El gris intermedio existe solo como texto muted.

## Typography

**Display Font:** Space Grotesk (con `ui-sans-serif, system-ui`)
**Body Font:** Hanken Grotesk (con `ui-sans-serif, system-ui`)
**Label/Mono Font:** JetBrains Mono (con `ui-monospace, monospace`)

**Character:** Grotescas suizas para leer y un mono con acento técnico para medir. La pareja
dice "instrumento": legible en el cuerpo, mecánica y precisa en los números.

### Hierarchy
- **Display** (Space Grotesk 700, ~1.5rem, tracking −0.02em): nombre del ejercicio en la sesión
  guiada y títulos de pantalla.
- **Titular de página** (`.text-2xl`, Space Grotesk 700, tracking −0.02em): el `h1` de las cinco
  superficies de ficha (`/planes`, `/program`, `/routine`, `/metrics`, `/skill`). **Entre esas
  cinco, la escala es la misma**: un titular más grande que otro es deriva, no énfasis.
- **Destino** (dentro de la banda, sólo en las dos superficies de señalética): dos escalones
  medidos, `.banda-titulo` ≈`clamp(2.25rem, 10vw, 3.5rem)` para el nombre de la rutina del día y
  `.banda-titulo-ejercicio` ≈`clamp(2rem, 9vw, 2.75rem)` con `max-width: 18ch` para el ejercicio en
  curso, porque los nombres del plan llegan a 50 caracteres y lo que se registra tiene que quedar en
  el primer viewport.
- **Heading** (Space Grotesk 700, tracking −0.02em): `h1–h4`; encabezados de tarjeta.
- **Body** (Hanken Grotesk 400): texto corriente y celdas de tabla.
- **Label** (JetBrains Mono 600, 11px, letter-spacing 0.08em, UPPERCASE, muted): etiquetas de
  campo, encabezados de columna, unidades. `.label-caps`.
- **Status** (JetBrains Mono 700, 11px, tracking 0.06em, UPPERCASE): badges y estados. `.label-status`.
- **Metric** (JetBrains Mono 700, tracking −0.05em, tabular-nums): el número héroe. `.metric`.

### Named Rules
**The Eleven-Pixel Floor.** Ningún texto con contenido baja de 11px: dosis, descanso, marcas,
puertas, números de serie, etiquetas de navegación y acciones. La densidad se resuelve con jerarquía,
no achicando; el detector marca cualquier texto funcional por debajo del piso.

**The Tabular Rule.** Todo número que se pueda comparar en columna usa `.tabular`
(`tabular-nums`). Los dígitos nunca deben bailar entre filas.

**The Mono-means-data Rule.** El mono se reserva a números, labels y estados. Nunca se usa para
prosa: una frase en `label-caps` obliga a deletrear cada palabra. La frase va en cuerpo
(`text-sm text-muted-foreground`) y el número que contiene, en `.metric`.

## Layout

Contenedor centrado de ancho máximo **1152px** (`max-w-6xl`) con padding lateral de **24px**
(`px-6`) y separación vertical de **16px** (`space-y-4`) entre bloques. Dentro de una tarjeta, el
ritmo es 4/8/16/24; los grupos relacionados van a 8px, los bloques a 16–24px. La densidad es
alta: filas compactas, encabezados de tarjeta con regla inferior.

La intención de marca es una **retícula suiza de 12 columnas**; hoy está expresada solo como
contenedor + grillas puntuales (`md:grid-cols-2`, `grid-cols-7` para la semana). Al construir
pantallas nuevas, extender esa retícula en lugar de inventar columnas ad-hoc.

Responsive: mobile-first. En pantallas ≥768px (`md`) los pares de tarjetas pasan a 2 columnas;
por debajo, todo apila a una. Los controles de dedo (registro de series) usan alturas de 44px
(`h-11`).

## Elevation & Depth

**No hay sombras.** El sistema es plano por defecto y la profundidad se comunica por **capas
tonales** (Paper → Surface → Muted Surface) y por **bordes hairline** de 1px. Un elemento "por
encima" no proyecta sombra: ocupa una superficie más clara o se separa con una regla.

### Named Rules
**The No-Shadow Rule.** Ninguna superficie usa `box-shadow` en reposo. Si un componente de
librería trae sombra (dropdowns, popovers), se anula.

**(No) Elevation vocabulary.** Sin sombras, el vocabulario es: hairline (borde 1px), surface
(fondo), regla (`.rule`, borde inferior 1px).

## Shapes

Rectángulos duros. **Radio 0 en todo el sistema** (`--radius: 0`, y `--radius-*` mapeados a 0),
aplicado incluso globalmente con `* { border-radius: 0 }`. La forma es ortogonal: esquinas a 90°,
bordes de 1px, separación por reglas. No hay píldoras, círculos salvo los indicadores de estado
(cuadrados de 8px) y los spinners.

### Named Rules
**The Zero-Radius Rule.** Ningún contenedor, botón, input, badge o tarjeta lleva esquina
redondeada. Si un componente de librería la trae, se anula.

## Motion

El tablero **acusa recibo, no actúa**. La interfaz es un instrumento: responde, no se luce.
Todo el sistema usa una sola curva y cuatro duraciones, declaradas en `app/src/index.css`:

- **Curva:** `--ease-beat` = `cubic-bezier(0.16, 1, 0.3, 1)` (desaceleración, sin rebote ni elástico).
- **`--dur-tap` (120ms):** feedback inmediato de un control.
- **`--dur-state` (200ms):** cambio de estado corriente — es el default de `transition-*`, así que
  ningún componente necesita declararlo.
- **`--dur-move` (320ms):** movimiento de layout u overlay.
- **`--dur-beat` (520ms):** el único momento autorado de una superficie.

### Named Rules
**The One-Beat Rule.** Cada superficie tiene como máximo un elemento con `.beat`: el momento que
se ganó (una marca nueva, una fase que cambia, una semana que avanza). Si dos elementos laten en la
misma vista, uno está de más. Las transiciones de rutina usan el default y no anuncian nada.

**The No-Choreography Rule.** No hay entrada de página, ni stagger de secciones, ni revelados por
scroll. En modo Operate, hacer esperar al usuario es un defecto, no una decisión.

### The plates (runner)
La sesión guiada es el único lugar donde el tablero **cambia de placa**: cada paso de ejercicio y
el overlay de descanso entran con `.plate-in` (un `clip-path` que barre desde abajo, `--dur-move`),
y los dígitos caen con `.digit-in` (`--dur-tap`) en cada tick. El anillo del descanso no es un
spinner: `.rest-ring` reporta los segundos que quedan (`stroke-dashoffset` en 1s lineal).

### Reduced motion
`prefers-reduced-motion: reduce` no apaga el motion: baja `--dur-move` y `--dur-beat` a 160ms, deja
que `.beat` conserve el cambio de opacity y le quita el desplazamiento, y detiene el pulso de los
skeletons (la forma queda). El spinner de estado sigue girando: informa, no decora.

## Browser surfaces

Lo que no dibujamos también es sistema:

- **Selección:** fondo Ink, texto On Ink.
- **Caret:** Ink.
- **Scrollbar:** thumb Hairline con borde del fondo, track transparente (y `scrollbar-color` en Firefox).
- **Foco:** anillo en `--ring` con `outline-offset: 2px`.
- **Subrayados:** offset `0.2em`, grosor 1px.
- **Números comparables:** `.tabular` (`tabular-nums`) además de `.metric`.

## Components

### Buttons
Variantes exportadas por `app/src/components/ui/button.tsx` (class-variance-authority). Cada
variante se aplica con `variant="..."`; el tamaño con `size="..."` (`xs` h-6, `sm` h-8,
`default` h-9, `lg` h-11 touch de 44px, `icon`/`icon-sm`/`icon-lg`).

- **Shape:** rectángulo, radio 0, borde 1px. Sin sombras, `transition-colors` únicamente.
- **accent** (alias `default`): relleno Voltage Lime con texto On Accent (#111) y borde Ink — la
  acción principal de la pantalla (`Entrenar`, `Siguiente`, `Guardar`, `Crear`, `Agregar`,
  `Iniciar rutina`, `Continuar`, `Exportar`, `saltar descanso`). Hover **invierte a relleno Ink**:
  texto lima en claro, texto tinta sobre papel en oscuro. La baliza no se va, cambia de lugar (del
  relleno a la etiqueta), y el feedback es inequívoco; soltar el relleno y dejar un contorno lima se
  leía como un botón apagado. Es la única señal lima de la vista (Beacon Rule). Los controles que viven **dentro de una fila o de una tarjeta** —`Usar tiempo`,
  `Aplicar`, `confirmar`, `editar`, `+ serie`— no son la acción de la pantalla y van `outline` o
  `ghost`.
- **ink**: relleno Ink con texto On Ink (lima) y borde Ink. Estado activo / selección / nav
  activa. Hover invierte a lima/ink. En oscuro el relleno Ink es papel y el texto tinta.
- **outline**: fondo transparente, borde Ink, texto Ink. Hover relleno Ink, texto On Ink.
  Acciones secundarias delineadas (`Anterior`, `Importar`, controles de timer).
- **ghost**: sin borde ni fondo; texto muted. Acciones terciarias (`Cancelar`, `Reiniciar`,
  `editar`, `volver`, `+ serie`). Hover relleno Muted Surface.
- **secondary**: relleno Muted Surface, texto Foreground. Botón relleno de baja jerarquía.
- **destructive**: texto/borde Alert sobre fondo alert/10. Solo acciones destructivas.
- **link**: texto primary subrayado. Enlaces con aspecto de botón.
- **States:** `label-caps` en los botones de acción de texto; foco visible por `--ring` (Ink);
  deshabilitado con `opacity-50` y `pointer-events-none`.

### Button patterns (raw `<button>`)
Patrones que no usan el componente `Button` pero deben mantenerse consistentes:
- **Row button** (Home, sesiones recientes): `<button>` a ancho completo, `min-h-14`,
  separado por `divide-y`; hover `bg-secondary`. Texto en `text-foreground`, metadatos en
  `label-caps`/`label-status` con `tabular-nums`.
- **Segmented control** (Hoy, planes activos): grupo `divide-x border border-border`,
  cada segmento `label-caps h-11`; activo `bg-primary text-primary-foreground`, inactivo
  `bg-card text-muted-foreground hover:bg-secondary`.
- **Chip remove** (tags): botón `×` dentro del chip, `opacity-60 hover:opacity-100`, sin
  borde propio.
- **Timer control** (Runner, descanso): overlay siempre negro con texto lima (en ambos modos)
  `bg-on-accent text-accent`; `Button variant="outline"` con borde/texto lima para ±10s y
  `Button variant="accent"` para "saltar descanso" (única acción del overlay). Dentro de la sesión
  los accents son dos: la barra de progreso del paso (rieles `secondary`, relleno Voltage Lime) y el
  botón de avance de la barra fija. El cronómetro y sus controles de fila van `outline`.

### Chips / Badges
- **Style:** fondo Voltage Lime + texto On Accent (#111) para el dato destacado (PR, énfasis
  activo); versión outline con borde hairline y texto muted para el subgrupo.
- **Excepción documentada — tags:** los chips de etiqueta definida por el usuario usan una
  paleta pastel de ocho pares (`app/src/lib/tags.ts`, `TAG_PASTELS`) como segundo lenguaje de
  color. Es una decisión de producto del usuario, no una deriva: la Beacon Rule no los alcanza
  porque distinguen categorías, no señalan estado ni acción. Si se agrega un noveno color, tiene
  que entrar en esa tabla y mantener contraste AA sobre su propio fondo.
- **Typography:** `.label-status` (mono 11px uppercase).

### Cards / Containers
- **Corner Style:** 0.
- **Background:** Surface (#ffffff) sobre Paper.
- **Shadow Strategy:** ninguna (ver Elevation & Depth).
- **Border:** `ring-border` — borde de 1px en Hairline; el encabezado se separa con una regla
  inferior (`border-b`).
- **Internal Padding:** `gap` interno 16px; encabezado con `label-caps`.

### Inputs / Fields
- **Style:** fondo Surface, borde hairline 1px, radio 0, altura táctil 44px (`h-11`) en el flujo de
  sesión.
- **Focus:** anillo en Ink (`--ring`).
- **Numbers:** inputs numéricos en mono `.tabular`; el placeholder es la unidad (`reps` / `seg`).

### Navigation
- **Style:** barra superior sticky con borde inferior hairline; nav como grupo de botones
  segmentados (borde 1px, divididos por `divide-x`), no como tabs con sombra.
- **Default:** fondo blanco, texto muted. **Activa:** relleno Ink, texto Voltage Lime. Sin
  subrayados ni píldoras.
- **Alcance:** dos destinos (Hoy, Planes) en la barra superior desde `md`; en mobile no hay barra
  inferior: la marca del header es el link a Hoy y cada pantalla se entra desde la anterior
  (Hoy → Planes, Hoy → Métricas). Si aparecen más destinos, vuelve la barra inferior.
- **Ajustes:** el disparador del header es un control fantasma compacto (glifo + el nombre del
  perfil en `label-caps`, caja táctil de 44px). No es un botón delineado: el header no compite con
  el CTA de la pantalla.
- **Sesión guiada (`/run`):** sin nav de la app a la vista. El runner trae su propia barra de control
  fija (`fixed bottom-0 z-40`) con el único accent de la vista.

### Signature: Telemetry readouts
Los pares label/número que definen el sistema: `.label-caps` arriba, `.metric` abajo, alineados
por retícula y `tabular-nums`. Aparecen en marcas (PR/último/Δ), resumen de grupos, semana y
muestreo de recuperación. Es el componente que más "usa" la identidad — construirlo con el mismo
patrón en toda pantalla.

### Signature: Guided timer
El cronómetro de la sesión: número grande en `.metric` (hasta 4xl), con botones outline/ghost al
lado. Cuenta arriba para isométricos (`Usar` vuelca los segundos a la serie) y cuenta atrás para
el descanso (suena + vibra al llegar a 0).

## Do's and Don'ts

### Do:
- **Do** usar Voltage Lime solo para estado, logro o acción principal; mantenerlo bajo el 10% de
  la pantalla (The Beacon Rule).
- **Do** separar con hairline (`border` de 1px) y reglas, no con sombras.
- **Do** poner todo número comparativo en mono `.tabular`.
- **Do** mantener radio 0 en cualquier componente nuevo, incluyendo los que traiga la librería.
- **Do** usar `label-caps` para etiquetas y `.metric` para el dato, en pares alineados.
- **Do** mantener las alturas táctiles en 44px en las pantallas de uso en el gym.
- **Do** usar la curva y las duraciones del sistema (`--ease-beat`, `--dur-*`); el default ya es
  `--dur-state`, así que el feedback no se declara.
- **Do** gastar `.beat` en un solo elemento por superficie, y en el que se ganó el momento.

### Don't:
- **Don't** usar `box-shadow` (ni `shadow-md`, ni glows, ni gradientes decorativos).
- **Don't** redondear esquinas.
- **Don't** introducir una segunda familia tipográfica decorativa: las tres (Space Grotesk,
  Hanken Grotesk, JetBrains Mono) son el sistema.
- **Don't** usar el lima como relleno de grandes superficies, ni en dos elementos que compitan
  en la misma vista.
- **Don't** rellenar con grises intermedios "para suavizar"; elegí tinta o papel, y dejá el gris
  solo para texto muted.
- **Don't** escribir texto en lima sobre papel o superficie (The Lime-is-a-fill Rule): el estado
  se escribe en tinta y el lima queda como marca.
- **Don't** usar color como único portador de significado (el estado también va en texto/forma).
- **Don't** inventar duraciones, curvas ni entradas de página: una animación de más es deuda, y el
  reveal por scroll no existe en este sistema.
- **Don't** dejar superficies del navegador (selección, caret, scrollbar, foco, subrayado) con su
  default de plataforma.

## Herramientas de diseño y precedencia

Este archivo es la **única fuente de verdad** del sistema. no hay copia paralela que pueda
desincronizarse; `app/src/index.css` es la fuente de verdad de los valores y el frontmatter de
arriba los refleja.

Cuando una herramienta externa de diseño opina sobre esta interfaz, la precedencia es:

1. Este archivo y `AGENTS.md`.
2. `improve-ui` — drift del sistema con puerta de prueba triple; read-only, escribe planes.
3. `impeccable critique` — puntuación heurística; read-only.
4. `impeccable audit` — a11y, performance, responsive y theming; read-only.
5. `web-design-guidelines` — patrones mecánicos de a11y y motion.

Los hallazgos ya auditados viven en `design-plans/ui-audit-findings.md` (código),
`design-plans/critique-per-page.md` (heurísticas por pantalla) y
`design-plans/ui-polish-render-pass.md` (crítica sobre capturas renderizadas, con el pulido
posterior).

### Overrides explícitos

Los defaults genéricos de las herramientas de diseño **no gobiernan** este sistema. En particular:

- **Radio 0 y cero sombras son decisiones, no deuda.** Un checklist que pida "card radii 12–16px" o
  "shadows con offset y blur suave" describe el promedio de la industria, no este tablero: aplican
  The Zero-Radius Rule y The No-Shadow Rule.
- **No hay memoización manual.** El React Compiler resuelve la memoización (ver `AGENTS.md`);
  "missing memoization" no es un hallazgo de performance acá.
- **La densidad es intencional.** Filas compactas y mucha información por pantalla son el modo
  Operate del sistema, no un defecto de jerarquía.
- **Una sola baliza.** Cualquier propuesta de enriquecer la paleta, sumar un segundo acento o
  colorear por categoría choca con The Beacon Rule y requiere decisión explícita del usuario.
- **Los tags pastel son la excepción ya decidida.** El usuario eligió la paleta pastel para las
  etiquetas: no es una violación a reportar ni a "corregir" hacia el chip outline.

## Señalética del día

La gramática compartida por `/` y `/run/:id`: el destino se anuncia, no se elige.

- **Banda de destino** (`.banda`): fondo `--ink`, kicker mono `--on-ink` (fecha o bloque), título
  Space Grotesk 700 con tracking −0.04em, línea de contexto `.banda-sub` (12px mono, corta sólo
  entre segmentos `·`, cada segmento `nowrap`) y **flecha al borde derecho** (`--on-ink`), decorativa.
  Dos escalones de título: `.banda-titulo` para el nombre de la rutina del día y
  `.banda-titulo-ejercicio` (`clamp(2rem, 9vw, 2.75rem)`, `max-width: 18ch`) para el ejercicio de la
  sesión, porque los nombres del plan llegan a 50 caracteres y lo que se está registrando tiene que
  quedar en el primer viewport.
- **Acción** (`.accion`): franja `--accent` con `--on-accent`, título Space Grotesk 700 y metadatos
  mono. En `/` va pegada a la banda y arranca la sesión; en `/run` es `.accion-pie`, fija al pie
  (la ruta es inmersiva: el pie fijo es el único control de la pantalla).
- **Franja** (`.franja`): hairline con dos lecturas mono (`bloque 1 de 5` · `nada registrado hoy`).
- **El borde de la banda en la sesión lo ocupa `Salir`** (`.banda-salir`): en `/run` la flecha
  decorativa no tenía destino y la sesión no ofrecía salida; la acción de avance vive en la barra del
  pie, así que el borde queda para lo único que el atleta puede querer ahí: irse.
- **Fila y puerta** (`.fila`, `.puerta`): el bloque es una puerta numerada, alto mínimo 56px, nombre
  en 15px/600, dosis en mono 11px y la flecha al borde. La fila entera es el objetivo táctil.
- **The Edge-Arrow Rule.** Todo lo que es "siguiente" lleva `→` al borde derecho de su contenedor:
  filas, barra de acción, fila "Después". Nunca en el medio, nunca un icono de librería.

- **Tabs de plan activo** (`.banda-tabs` / `.banda-tab`): cuando hay más de un plan empezado, la
  banda lleva un control segmentado en su pie para cambiar de destino sin bajar a *Programas*. Vive en
  tinta con hairline y mono; la pestaña activa se invierte a papel con texto tinta. **Nunca lima**: el
  lima sigue siendo la acción, y el tab elige, no ejecuta. Etiqueta = nombre de la categoría (con `· N1/N2/N3`
  cuando dos planes activos comparten categoría), objetivo táctil de 44px.

Reglas que la señalética no toca: radio 0, cero sombras, una sola baliza lima (la acción; la marca de
PR y el descanso usan la inversión tinta/lima, no otro acento) y mono tabular para todo número.

## Dos registros, un mundo

La app tiene dos registros de composición, y son una decisión, no una migración a medias:

- **Señalética** (`/`, `/run/:id`): se opera de pie, con una mano, bajo carga. Banda de destino,
  puertas o filas, barra de acción al borde. **Máximo una acción lima.**
- **Ficha** (`/planes`, `/program/:id`, `/routine/:id`, `/metrics`, `/skill/:id`): se explora y se
  lee sentado. Titular de página, tarjetas, lectura densa. La acción principal usa la anatomía de
  `.accion` **en línea** (no fija al pie), para que la intención se reconozca aunque cambie la
  disposición.

Lo que no varía entre registros: radio 0, cero sombras, mono tabular para todo número, una sola
baliza, piso de 11px y objetivos táctiles de 44px como mínimo.

**Una superficie tiene banda o titular de página, nunca las dos.**

### Las tres formas de "serie", por rol

No son deriva: cada una responde a una pregunta distinta y no aparecen juntas en la misma pantalla.

| Forma | Dónde | Responde |
| --- | --- | --- |
| Puntos | tarjetas de rutina en `/routine/:id` | ¿cuántas series tiene el bloque? (vista previa) |
| `S1…Sn` | sesión guiada | ¿en qué serie estoy y qué registré? (entrada) |
| Puertas `01…05` | `/` | ¿por dónde voy y qué sigue? (navegación) |

### La banda y el tema

La banda es **siempre el plano más oscuro del tema**: en claro, `--ink`; en oscuro, `--surface` con
hairline de `--border`, nunca el blanco de la tinta invertida. La inversión de `--ink` es para texto,
no para rellenar una superficie grande. Así la banda conserva su papel de señal en los dos temas.
