# Impeccable plays — Refine + Enhance sobre las siete vistas

Rama `feat/impeccable-plays`. Los ocho plays de `impeccable` v4.7.0 aplicados con el mapa que el
usuario aprobó: cada play donde gana su lugar, no las ocho en cada vista. Contrato: `DESIGN.md`.

## Specs

S1. Pedido del usuario, verbatim:

```text
Refine

    animate
    bolder
    colorize
    delight
    layout
    overdrive
    quieter
    typeset quiero que llames a estos skills de impeccable en cada una de mis vistas
```

S2. "cada una de mis vistas" = las siete rutas de `app/src/App.tsx` (`/`, `/planes`,
`/program/:id`, `/routine/:id`, `/run/:id`, `/metrics`, `/skill/:id`) más el shell
(`components/Layout.tsx`, `features/settings/SettingsMenu.tsx`).

S3. Aplicación: mapa aprobado, "Mapa por vista (recomendado)" — cada play en la superficie donde
gana su lugar; `bolder` recibe un target nombrado por vista y `quieter` baja el ruido de esa misma
vista, nunca las dos sobre el mismo elemento.

S4. `overdrive` corre solo en `/run/:id`, dirección aprobada "Runner: secuencia cronometrada":
`countdown → work → rest` como una sola pieza orquestada.

S5. Contrato: el usuario eligió "Revisar conmigo". Si un play exige romper radio 0, cero sombras o
la baliza única ≤10%, se frena y se pregunta antes de tocarlo.

S6. `DESIGN.md` sigue siendo la única fuente de verdad. Sus *Overrides explícitos* (radio 0, cero
sombras, densidad intencional, una sola baliza, tags pastel, sin memoización manual) vencen a los
defaults del `craft-floor` de impeccable.

S7. Cada play deja su verificación exigida por su propio playbook: assessment con evidencia,
tesis antes de editar, y la lista de `Verify` respondida con evidencia renderizada o de código.

## Mapa de plays por vista

| Vista | Plays | Nota |
| --- | --- | --- |
| shell + `/` Home | `layout` · `typeset` · `bolder` (bloque "hoy") · `animate` (mesociclo) · `delight` (marca nueva) | Home es la pantalla de lanzamiento en el gym |
| `/planes` | `layout` (grilla de categorías) · `typeset` · `quieter` (header, kebab) · `animate` (afordancia de card) | |
| `/program/:id` | `bolder` (bloque de progresión) · `layout` (columnas condicionales) · `typeset` (telemetría) · `colorize` (accent único) | |
| `/routine/:id` | `layout` (barra de inicio) · `typeset` (readouts) · `animate` (video/bloques) · `delight` (arranque) | |
| `/run/:id` | `overdrive` · `animate` (secuencia) · `typeset` (número héroe) · `layout` (una mano) · `colorize` (lima solo en la marca) · `quieter` (overlay de descanso) | el pico del producto |
| `/metrics` | `layout` · `typeset` · `animate` (rango del chart) · `quieter` (densidad) · `delight` (racha) | |
| `/skill/:id` | `layout` · `bolder` (cadena de progresión) · `typeset` · `animate` | |

`colorize` está limitado por The Beacon Rule: la lima es la única señal, el resto del color son los
tags pastel ya decididos. Ningún play puede introducir un segundo acento sin decisión explícita.

## Tasks

| ID | Unidad | Plays | Ruta | Commit |
| --- | --- | --- | --- | --- |
| T1 | Lenguaje compartido: tesis de motion, tokens y superficies del navegador (`index.css`) | `animate` | inline (orquestador) | |
| T2 | `/planes` | `layout` · `typeset` · `quieter` · `animate` | worker | |
| T3 | `/skill/:id` | `layout` · `bolder` · `typeset` · `animate` | worker | |
| T4 | `/program/:id` | `bolder` · `layout` · `typeset` · `colorize` | worker | |
| T5 | `/routine/:id` | `layout` · `typeset` · `animate` · `delight` | worker | |
| T6 | `/metrics` | `layout` · `typeset` · `animate` · `quieter` · `delight` | worker | |
| T7 | shell + `/` Home | `layout` · `typeset` · `bolder` · `animate` · `delight` | worker | |
| T8 | `/run/:id` | `overdrive` · `animate` · `typeset` · `layout` · `colorize` · `quieter` | inline (orquestador) | |
| T9 | Cierre: verificación completa, render pass y docs | — | inline | |

Verificación por unidad: `npm test`, `npm run lint`, `npm run build`. E2e y capturas renderizadas
(390/1440, claro/oscuro) los corre el orquestador por ola, nunca dos escritores a la vez sobre el
mismo dev server.

## Log

L1. 2026-10-27 — pedido del usuario, verbatim: ver S1.

L2. 2026-10-27 — decisiones del usuario en el cuestionario previo:
"Mapa por vista (recomendado)", "Runner: secuencia cronometrada", "Revisar conmigo".

L3. 2026-10-27 — reconocimiento: skill `impeccable` v4.7.0 en `.pi/skills/impeccable`, `doctor`
sin drift; detector `detect --scope layout|type` devuelve `[]` sobre `app/src` (sólo tiene reglas de
página parseada, ya documentado en `design-plans/critique-per-page.md`); árbol limpio en `main`.
