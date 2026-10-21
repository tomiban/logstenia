---
name: Logtenia
description: Logtenia de calistenia — retícula suiza, telemetría en mono y una sola baliza lima.
colors:
  voltage-lime: "#ccff00"
  ink: "#111111"
  paper: "#f8f9fa"
  surface: "#ffffff"
  foreground: "#191c1d"
  muted-surface: "#f3f4f5"
  muted-ink: "#555555"
  hairline: "#e2e4e8"
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
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "12px 24px"
  button-accent-hover:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.voltage-lime}"
  button-ink:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.voltage-lime}"
    rounded: "{rounded.none}"
    padding: "8px 16px"
  button-outline:
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "12px 20px"
  badge-status:
    backgroundColor: "{colors.voltage-lime}"
    textColor: "{colors.ink}"
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
- **Foreground** (#191c1d): color de texto por defecto del cuerpo.
- **Paper** (#f8f9fa): fondo de la página. Papel técnico, apenas más frío que blanco.
- **Surface** (#ffffff): fondo de tarjetas y controles, un escalón por encima del papel.
- **Muted Surface** (#f3f4f5): rellenos secundarios (raíles, celdas inactivas).
- **Muted Ink** (#555555): texto secundario, labels y metadatos.
- **Hairline** (#e2e4e8): bordes de 1px y reglas. Hace el trabajo que en otros sistemas haría
  una sombra.
- **Alert** (#ba1a1a): solo para error o destructivo. No es parte de la identidad.

### Named Rules
**The Beacon Rule.** El Voltage Lime ocupa ≤10% de cualquier pantalla. Su escasez es el punto:
si dos elementos compiten en lima, uno está mal.

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
- **Heading** (Space Grotesk 700, tracking −0.02em): `h1–h4`; encabezados de tarjeta.
- **Body** (Hanken Grotesk 400): texto corriente y celdas de tabla.
- **Label** (JetBrains Mono 600, 11px, letter-spacing 0.08em, UPPERCASE, muted): etiquetas de
  campo, encabezados de columna, unidades. `.label-caps`.
- **Status** (JetBrains Mono 700, 10px, tracking 0.06em, UPPERCASE): badges y estados. `.label-status`.
- **Metric** (JetBrains Mono 700, tracking −0.05em, tabular-nums): el número héroe. `.metric`.

### Named Rules
**The Tabular Rule.** Todo número que se pueda comparar en columna usa `.tabular`
(`tabular-nums`). Los dígitos nunca deben bailar entre filas.

**The Mono-means-data Rule.** El mono se reserva a números, labels y estados. Nunca se usa para
prosa.

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

## Components

### Buttons
Variantes exportadas por `app/src/components/ui/button.tsx` (class-variance-authority). Cada
variante se aplica con `variant="..."`; el tamaño con `size="..."` (`xs` h-6, `sm` h-8,
`default` h-9, `lg` h-11 touch de 44px, `icon`/`icon-sm`/`icon-lg`).

- **Shape:** rectángulo, radio 0, borde 1px. Sin sombras, `transition-colors` únicamente.
- **accent** (alias `default`): relleno Voltage Lime con texto Ink y borde Ink — la acción
  principal de la pantalla (`Entrenar`, `Siguiente`, `Guardar`, `Crear`, `Agregar`,
  `Iniciar rutina`, `Continuar`, `Usar tiempo`, `Exportar`). Hover invierte: relleno Ink,
  texto lima. Es la única señal lima de la vista (Beacon Rule).
- **ink**: relleno Ink con texto Voltage Lime y borde Ink. Estado activo / selección / nav
  activa. Hover invierte a lima/ink.
- **outline**: fondo transparente, borde Ink, texto Ink. Hover relleno Ink, texto lima.
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
- **Segmented control** (Metrics, rango de tiempo): grupo `divide-x border border-border`,
  cada segmento `label-caps h-11`; activo `bg-primary text-primary-foreground`, inactivo
  `bg-card text-muted-foreground hover:bg-secondary`.
- **Chip remove** (tags): botón `×` dentro del chip, `opacity-60 hover:opacity-100`, sin
  borde propio.
- **Timer control** (Runner, descanso): `Button variant="outline" size="sm"` para ±10s y
  `Button variant="accent" size="lg"` para "saltar descanso".

### Chips / Badges
- **Style:** fondo Voltage Lime + texto Ink para el dato destacado (PR, énfasis activo); versión
  outline con borde hairline y texto muted para el subgrupo.
- **Typography:** `.label-status` (mono 10px uppercase).

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

### Don't:
- **Don't** usar `box-shadow` (ni `shadow-md`, ni glows, ni gradientes decorativos).
- **Don't** redondear esquinas.
- **Don't** introducir una segunda familia tipográfica decorativa: las tres (Space Grotesk,
  Hanken Grotesk, JetBrains Mono) son el sistema.
- **Don't** usar el lima como relleno de grandes superficies, ni en dos elementos que compitan
  en la misma vista.
- **Don't** rellenar con grises intermedios "para suavizar"; elegí tinta o papel, y dejá el gris
  solo para texto muted.
- **Don't** usar color como único portador de significado (el estado también va en texto/forma).
