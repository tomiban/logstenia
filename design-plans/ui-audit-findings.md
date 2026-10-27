# UI audit findings — todas las pantallas (`improve-ui`)

Auditoría de diseño con el método `improve-ui` sobre las 8 superficies de la app, más el shell
compartido. Read-only sobre código de producto: acá no se implementó nada.

- Fecha: 2026-10-26
- Superficies: shell (`components/Layout.tsx`), `/`, `/planes`, `/program/:id`, `/routine/:id`,
  `/run/:id`, `/metrics`, `/skill/:id`
- Fuente de diseño: `DESIGN.md` ("The Timing Board")
- Método: puerta de prueba triple (contrato + runtime alcance + corrección determinista) y pasada
  de falsificación sobre cada línea citada. Se descartaron 12 candidatos (§ Descartados).
- Nota de estado: `features/home/Home.tsx` y `features/plans/Routine.tsx` tienen cambios sin
  commitear de otra sesión; se auditaron como estaban en disco el 2026-10-26 y los números de
  línea pueden moverse.

## Design language

- **Superficies auditadas:** las 8 de arriba, trazadas por camino de render (ruta → `Layout` →
  composición → primitivas → tokens), no por búsqueda repo-wide.
- **Fuentes de diseño:** `DESIGN.md`; tokens resueltos en `app/src/index.css` (`@theme`,
  `.dark`, `.metric/.label-caps/.label-status`); contratos de variantes en
  `app/src/components/ui/{button,card,badge,dialog,input,label}.tsx`.
- **Decisiones documentadas que gobiernan:** The Beacon Rule, The Ink-or-Paper Rule, The
  Zero-Radius Rule, The No-Shadow Rule, The Tabular Rule, The Mono-means-data Rule; jerarquía
  Display/Heading/Label/Status/Metric; Layout (1152px, `px-6`, `space-y-4` entre bloques, ritmo
  4/8/16/24); Cards (`ring-border` = Hairline, padding interno 16px); Chips/Badges (lima para el
  dato destacado, outline para el subgrupo); Navigation (segmentado con borde 1px, activa =
  relleno Ink + texto lima, **sin subrayados**).
- **Owners y consumidores:** `index.css` (tokens y utilidades) → `Layout.tsx` (contenedor y nav) →
  primitivas `ui/*` → páginas. Un cambio en `card.tsx`, `dialog.tsx`, `label.tsx` o `select.tsx`
  alcanza las 8 superficies.
- **Excepciones explícitas:** solo una documentada — círculos permitidos para indicadores de 8px
  y spinners (`Runner.tsx:276`, `rounded-full!`).

## Findings

| # | Problema | Evidencia | Cambio propuesto | Superficies | Confianza |
| --- | --- | --- | --- | --- | --- |
| F1 | Las 5 confirmaciones de borrado pintan el botón destructivo con el relleno lima del `accent`, y "Cancelar" queda delineado | `AlertDialogAction` no fija `variant` (`ui/alert-dialog.tsx:142-153`; `AlertDialogCancel` sí, `:157`). DESIGN Buttons: "destructive: texto/borde Alert sobre fondo alert/10. **Solo acciones destructivas**" | `variant="destructive"` en las 5 llamadas | `Planes:122`, `Routine:435`, `Routine:504`, `Program:260`, `Skill:231` | Alta |
| F2 | Frases en prosa renderizadas en mono 11px UPPERCASE (`label-caps`): errores, estados vacíos y avisos | DESIGN: "The Mono-means-data Rule. El mono se reserva a números, labels y estados. **Nunca se usa para prosa**"; la misma pantalla ya usa prosa en `text-sm text-muted-foreground` (`Metrics:268`) | clases de body (`text-sm text-muted-foreground`) en esas frases | 13 sitios: `Home:190,314`, `Program:267,285,292,297`, `Routine:125`, `Metrics:230,422`, `Skill:243,249`, `Runner:196,242,270` | Alta |
| F3 | `Input` de registro de series a 36px (`h-9`) en el flujo de gimnasio | DESIGN Inputs: "altura táctil 44px (`h-11`) en el flujo de sesión"; Do: "mantener las alturas táctiles en 44px en las pantallas de uso en el gym"; `Input` base es `h-8` (`ui/input.tsx:12`) | `h-11` en ambos inputs de serie | `Runner:105`, `Runner:99-101` (slider) | Alta |
| F4 | El ítem activo del nav móvil se marca con una barra lima de 8px abajo y no usa relleno Ink con texto lima | DESIGN Navigation: "**Activa:** relleno Ink, texto Voltage Lime. **Sin subrayados** ni píldoras"; el nav de escritorio del mismo archivo sí lo implementa (`Layout:66`) | quitar el span indicador y aplicar el tratamiento activo documentado | `Layout:96` | Alta |
| F5 | La primitiva `Label` no implementa el label documentado: sale Hanken 14px/500 en vez de mono 11px UPPERCASE muted | `ui/label.tsx:11` (`text-sm leading-none font-medium`); DESIGN Label: "JetBrains Mono 600, 11px, letter-spacing 0.08em, UPPERCASE, muted … `.label-caps`" para "etiquetas de campo" | aplicar el estilo `.label-caps` (+ muted) en la base de `Label` | todos los diálogos de `Routine`, `Planes`, `Program`, `Skill` | Alta |
| F6 | Bordes de card, diálogo y select usan `ring-1 ring-foreground/10` (≈#e8e9e9 sobre Surface), no el token Hairline | DESIGN Cards: "Border: `ring-border` — borde de 1px en **Hairline**"; `--color-border` existe (`index.css:83`) | `ring-border` | `ui/card.tsx:14`, `ui/dialog.tsx:56`, `ui/select.tsx:83` → las 8 superficies | Alta |
| F7 | Panel lima a ancho completo con `text-on-accent`, conviviendo en la misma vista con badge lima y botón accent | DESIGN Don't: "usar el lima como relleno de grandes superficies"; Beacon Rule: "si dos elementos compiten en lima, uno está mal" (`:163` badge, `:170` botón, `:266` panel) | superficie de card (`bg-card`, `text-foreground`, conservar `border-ink`) | `Program:266` | Alta |
| F8 | Los eslabones de la cadena de progresión se pintan lima sólido por programa, sumados al botón accent de la vista | Beacon Rule: "El Voltage Lime ocupa ≤10% de cualquier pantalla"; Buttons accent: "Es la única señal lima de la vista" | tratamiento `outline` documentado (`bg-transparent`, `border-ink`, `text-ink`) | `Skill:261` | Media |
| F9 | El gutter lateral del shell es 24px a todo ancho (`Layout:73`), pero dos consumidores asumen 16px: header con `px-3 sm:px-6` y footer del runner con `-mx-4` | DESIGN Layout: "padding lateral de 24px (`px-6`)"; el `border-t` del footer queda 8px adentro del gutter | `px-6` en el header; `-mx-6` a todo ancho en el footer | `Layout:48`, `Runner:365` | Media |
| F10 | Tres raíces de página usan `space-y-6` (24px) contra los 16px documentados y contra el shell | DESIGN Layout: "separación vertical de 16px (`space-y-4`) entre bloques"; `Layout:73` ya lo aplica; `Home:181` y `Planes:54` usan `space-y-4` | `space-y-4` | `Program:152`, `Routine:301`, `Skill:162` | Media |

### Menores (mismo método, menor alcance o menor impacto)

| # | Problema | Evidencia | Cambio propuesto | Superficies |
| --- | --- | --- | --- | --- |
| m1 | El grupo del nav de escritorio no tiene borde de 1px alrededor | DESIGN Navigation: "grupo de botones segmentados (borde 1px, divididos por `divide-x`)"; ejemplar `Metrics:244` | añadir `border border-border` | `Layout:53` |
| m2 | `DialogTitle` a peso 500 mientras Heading es 700 y todos los `h1` van a 700 | DESIGN Heading: "Space Grotesk **700**" | `font-bold` en `DialogTitle` | `ui/dialog.tsx:125` |
| m3 | `font-extrabold` (800) en títulos de pantalla | DESIGN Heading 700; `Home:183`, `Metrics:235`, `Program:161` usan `font-bold` | `font-bold` | `Planes:57`, `Skill:168` |
| m4 | Chips de subgrupo pintados lima o tinta+lima en vez de outline | DESIGN Chips: "versión outline con borde hairline y texto muted **para el subgrupo**" | `Badge variant="outline"` | `Planes:137`, `Skill:293` |
| m5 | El CTA accent reimplementado como `<Link>` hoverea a relleno Ink, no al hover accent documentado | `ui/button.tsx:38`: `hover:bg-transparent hover:text-ink hover:border-accent`; DESIGN Buttons accent | alinear al hover accent (o usar el `Button`) | `Metrics:274` |
| m6 | El sparkline no pasa `cursor` al `Tooltip`, así que recharts dibuja su gris por defecto | DESIGN Dark mode: `--muted-surface` = "cursor de los charts"; los dos bar charts sí lo pasan (`Metrics:347,410`) | `cursor={{ stroke: 'var(--muted-surface)' }}` | `Metrics:471` |
| m7 | Cuerpo de card con `p-4` encima del `py-16` del Card: 32px vertical contra 16px horizontal | DESIGN Cards: "Internal Padding: gap interno 16px"; `CardContent` es el owner (`px-(--card-spacing)`) | usar `CardContent` | `Runner:314`, `Runner:239` |

## Estado de implementación (2026-10-26)

Rama `feat/ui-audit-fixes`. Todos los findings aplicados tienen gate GGA en verde, `npm test`
(301 tests), `npm run build` y `npm run lint` limpios.

**Aplicado**: F1 (destructivas, 5 sitios), F2 (prosa fuera del mono, 17 sitios), F3 (input de
series a 44px), F4 (nav móvil con el tratamiento activo documentado), F5 (`Label` primitivo), F6
(`ring-border` en card/dialog/select), F7 (banner de Program sobre superficie de card), F8 (cadena
de Skill en outline), F9 (gutter del header), F10 en Program y Skill, y los menores m1, m2, m3,
m4, m4b, m5, m6, m7.

**Pendiente**: F10 en `Routine.tsx` y una frase suya en `label-caps`; los dos van con ese archivo,
que el gate rechaza por dead code ajeno (ver abajo).

**Decisiones cerradas**: Q1 — la paleta pastel de tags es una **excepción decidida por el usuario**
y quedó escrita en `DESIGN.md` (chips + overrides). Q4 — el `max-w-full` anulaba el tope de 1152px:
medido en navegador, computaba `max-width: 100%` y renderizaba 1440px; ahora computa 1152px.

**Preguntas que siguen abiertas**: Q2 (terminología "progresiones" vs "programas"), Q3 (el trigger
de ajustes dice `tomas`), Q5 (contraste de `text-accent` sobre papel), Q6 (grilla de Planes).

**Bloqueo conocido**: `app/src/features/plans/Routine.tsx` tiene dos cambios propios de esta rama
(F1 y F10) sin commitear porque el gate detecta un menú inalcanzable escrito por otra sesión
(`:504`, un bloque `{editing && …}` anidado dentro de la rama `{!editing && …}`). Esa corrección le
corresponde a quien escribió ese código.

## Improve first

**F1 — las cinco confirmaciones destructivas.** Es el único hallazgo donde la consecuencia es una
acción irreversible disfrazada de acción principal: hoy "Borrar" es el elemento lima más fuerte de
su diálogo y "Cancelar" el secundario. La evidencia es exacta (DESIGN asigna Alert a destructivo),
la corrección es una prop que ya existe en el API del `Button`, y son 5 sitios en 4 pantallas: un
solo commit cerrable.

> **Estado: F1 implementado el 2026-10-26** en el árbol de trabajo (sin commitear). 5 inserciones
> de `variant="destructive"` en `Planes:122`, `Routine:435`, `Routine:504`, `Program:260`,
> `Skill:231`. `AlertDialogCancel` conserva su default `outline`. Verificado: `--destructive`
> resuelve a `var(--alert)` (`index.css:48`) ⇒ `#ba1a1a` claro / `#ffb4ab` oscuro, así que
> `bg-destructive/10 text-destructive` es exactamente el "texto/borde Alert sobre fondo alert/10"
> que pide DESIGN. lint 0, 284/284 tests, build 0.
> Residual: la primitiva usa `border-destructive/40` (borde al 40%), no Alert pleno; se corrige en
> `button.tsx` si algún día se toca la primitiva.

## Preguntas abiertas (no son findings: la evidencia admite más de una corrección)

- **Q1 — Paleta pastel de tags.** `lib/tags.ts:69-78` define 8 pares de color hardcodeados que se
  aplican con `style` inline (`tags-input.tsx:64` y, duplicado a mano, `Program.tsx:47`). DESIGN
  declara la lima como "la única señal" y no documenta tags. O se registran los pasteles como
  excepción aceptada en `DESIGN.md`, o el chip pasa al outline documentado. Elegir el camino es
  decisión de producto.
- **Q2 — "progresiones" vs "programas".** La misma pantalla dice "Sin progresiones curadas aún."
  y "Progresión (más fácil → más difícil)" (`Skill:236,252`) mientras el botón crea "Nuevo
  programa" (`Skill:175`), y `Planes:58,137` usa "progresiones" para contar programas. El modelo
  de datos nombra la entidad `Program`. Falta decidir el término de UI.
- **Q3 — El trigger de ajustes dice `tomas`** (`SettingsMenu.tsx:202`) mientras el diálogo se llama
  "Ajustes". El comentario del archivo declara que el nombre del perfil es el ancla: corregirlo a
  "Ajustes" sería inventar intención de producto.
- **Q4 — `Layout.tsx:73` declara `max-w-6xl` y `max-w-full`** en el mismo elemento. Cuál gana
  depende del orden del CSS generado; no se pudo probar sin build, y si gana `max-w-full` el tope
  de 1152px documentado no existe. Requiere verificación empírica, no es un finding de diseño.
- **Q5 — `text-accent` lima sobre papel** para "completado"/"desbloqueado" (`Program:194,200`):
  probable bajo contraste, pero la regla de 4.5:1 de DESIGN enumera otros tokens, no `text-accent`,
  y hay al menos dos correcciones compatibles.
- **Q6 — Grilla de Planes** (`gap-3 sm:grid-cols-2 lg:grid-cols-3`, `:127`): la regla de Layout
  habla de "los pares de tarjetas", no de una grilla de administración 2/3 columnas.

## Probado conforme (no tocar)

Radio 0 en todo el árbol (incluidas primitivas de librería, vía `* { border-radius: 0 !important }`);
cero `box-shadow` en el camino de render, con sombras de librería anuladas; telemetry readouts
`.label-caps` + `.metric` + `tabular-nums` (`Metrics:85-92`); segmented control de Metrics
(`Metrics:246`); inversión de tema oscuro en el nav (`Layout:58`); `env(safe-area-inset-bottom)` en
el footer del runner (`Runner:365`); skip link (`Layout:44`); hover accent del primitivo
(`button.tsx:33-34`); excepción documentada del spinner circular.

## Descartados en la falsificación (12)

`bg-accent/10` en la celda de hoy (la regla habla de grandes superficies); `tracking-tight` vs
−0.02em (delta 0.12px, sin token); `sm:grid-cols-2` en Planes (la regla no gobierna esa grilla);
badge `completado` lima (dato destacado sancionado); overlay negro+lima del descanso (patrón
documentado); `hover:border-ink` (énfasis hairline, no sombra); nav inferior fijo (no prohibido);
`bg-secondary` en encabezados de bloque (capa tonal documentada); scrim `bg-black/10`; `lg` de 44px
en botones (ya cumple); bg del header (`bg-background` vs "fondo blanco": prosa ambigua);
encabezados de sección en `label-caps` (permitido: "encabezado con `label-caps`").
