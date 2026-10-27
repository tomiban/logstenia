# Informe de cierre — crítica UX/UI de todas las vistas y pulido

Pasada 4 sobre Logtenia (`/impeccable`). Fecha: 2026-10-26. Rama: `worktree/lucky-valley-af7c`.

## Lo que se pidió

> S1. `quiero que sometas a criticas todas las vistas de mi web. Ux/UI. Con los reportes haz un pulido.`

> S2. `tambien si es conveniente rediseñar`

No era un pedido de opinión: era crítica **aplicada**. El pulido se implementó, se verificó y se
commiteó; el rediseño se usó donde había una composición que perdía contra el contrato.

## Método (por qué esta pasada encuentra cosas que las anteriores no)

1. **Evidencia renderizada.** Capturas reales de Chromium de las siete rutas, con datos sembrados (16
   sesiones, 6 marcas, progreso semanal, tags, mesociclo de 16 días), a **390px y 1440px**, en
   **claro y oscuro**. Las tres pasadas previas leyeron código; ésta juzgó píxeles.
2. **Tres revisores ciegos independientes**, uno por par de superficies, con `DESIGN.md` como único
   contrato y prohibido leer los reportes anteriores: donde coincidieron con mi lectura, el hallazgo
   quedó confirmado por dos métodos.
3. **Pulido delegado** en seis unidades disjuntas (Home, Planes+Program, Routine, Runner, Metrics,
   Skill) más el shell a mi cargo, con superficies de edición cerradas y verificación obligatoria.
4. **Verificación propia**: recaptura de las siete rutas después del pulido, `build`, `lint`, tests
   unitarios y e2e, más el gate de review del repo en cada commit.

## Números

| | Antes | Después |
| --- | --- | --- |
| Commits de la pasada | — | **14** |
| Archivos tocados | — | **38** |
| Líneas | — | **+2050 / −683** |
| Tests unitarios | 301 | **342** |
| Tests e2e (mobile + desktop) | 38 | **40** |
| Warnings de lint | 19 | 19 (todos preexistentes) |
| Hallazgos transversales cerrados | — | 9 (G1-G9) + 7 de verificación (V1-V7) |

## Qué cambió, por superficie

### Shell (transversal)
- **El documento no scrolleaba.** `html, body, #root { height:100%; overflow-x:hidden }` creaba tres
  contenedores anidados: PageDown y `window.scrollY` estaban muertos y la rueda movía `#root`. Ahora
  `overflow-x: clip` + alturas libres, con un test e2e que exige rueda **y** teclado.
- **Ajustes dejó de competir**: era un botón delineado de 44px con "TOMAS" en mayúsculas ocupando
  ~35% del header móvil; ahora es un control fantasma compacto (glifo + nombre) y conserva el nombre
  del perfil como nombre accesible.
- **Sesión guiada**: la nav inferior se oculta en `/run` para que la barra de la sesión sea el único
  chrome fijo.

### `/` Hoy
- Raíl del mesociclo con estados explícitos: en oscuro `bg-primary` resolvía a lima y semanas pasadas
  y actual quedaban lima/lima (la única diferencia era un anillo de 1px).
- Fechas `dd/mm` en lugar de ISO crudo; "series" → **sesiones** (contaba sesiones); dos CTAs
  "Entrenar" con destinos distintos ahora dicen qué hacen; "mejor marca" visible (se calculaba y nunca
  se pintaba); un solo accent por estado; error con descarte y reintento.

### `/planes` y `/program/:id`
- **De cinco señales lima a una**: badge COMPLETADO, "Nueva rutina", "desbloqueado", DESBLOQUEADO y
  "Ir al siguiente nivel" competían. El accent queda para la acción que arranca el trabajo de hoy.
- **Lima ilegible**: `#ccff00` sobre papel medía **1.03:1**. El estado se escribe en tinta y la lima
  queda como marca.
- **Un tercer anuncio del siguiente nivel** eliminado: "FASE 1 DE 3" + "Más difícil: …" + tarjeta
  "SIGUIENTE NIVEL" se fundieron en un bloque `Fase n de m · siguiente: X` con el CTA único.
- Tarjetas de rutina como readout (minutos, intensidad, ejercicios), antes "nombre + 0 min"; kebab y
  CTAs a 44px; vacíos con su acción; "1 progresiones" → plural real.

### `/routine/:id`
- **"Iniciar rutina" estaba al final del documento, detrás de la nav fija**: quien abría la rutina
  para empezarla no veía cómo. Ahora es una barra persistente sobre la nav, único accent.
- Encabezados `BLOQUE 1 · Simple` con pares de telemetría (series / descanso / entre ejercicios) en
  lugar de `SINGLE 4 VUELTA(S) · DESCANSO 2MIN`.
- Etiquetas con label real; "Editar rutina" junto al título a 44px; video a 44px; rutina inexistente
  ofrece volver a Planes.
- **Bonus del gate de review**: la banca de ejercicios (buscador + lista + botón crear) estaba
  duplicada entre el aside de escritorio y la hoja móvil, y el menú de ejercicio escrito dos veces.
  Ahora son dos componentes. Las filas dejaron de keyear por posición.

### `/run/:id`
- **Slider de segundos tope 20s** frente a holds prescritos de 30, 35, 40 y 60s: no podía registrar
  su propio objetivo. Ahora el máximo se deriva del ejercicio.
- **Barra de control**: `sticky bottom-0` flotaba a media pantalla con contenido corto, hacía wrap a
  tres filas en 390px y quedaba debajo de la nav con contenido largo ("Siguiente" inalcanzable).
  Ahora barra fija de una fila, 44px, un solo accent.
- **El diálogo de omisión mentía**: decía "se omiten" mientras "Continuar" registraba los valores ya
  tipeados. Copia que describe lo que pasa y conteo que distingue cargadas de vacías.
- Objetivo como telemetría; "GO!" → "¡YA!"; "Bloque 0" → "Bloque 1"; progreso en tinta para que el
  lima signifique una sola cosa.

### `/metrics`
- **El filtro de rango gobernaba sólo la telemetría superior** mientras el header prometía "últimos
  30 días": ahora todos los bloques se calculan sobre la ventana elegida.
- **"Duración por sesión" graficaba series** cuando no había duraciones: el título se deriva de lo que
  se grafica.
- **`previousIndex` comparaba contra otro plan** aunque la etiqueta decía "del mismo plan": sin
  predecesor del mismo plan, la sesión no es comparable.
- PR sólo en marcas frescas (antes en todas); `0/0` → `—`; charts con `role="img"`, resumen en
  palabras, leyenda y tabla de valores en `<details>` (un teléfono en el gimnasio no tiene hover).
- **Eje X**: `dd/mm` bajo cada barra se pisaba a 390px; ahora el rótulo escalona y los extremos se
  anclan.

### `/skill/:id`
- **Estado sin estructura**: tres programas `BLOQUEADO` y ninguna cadena visible, porque el bloqueo
  salía de `chainFor()` (cadenas estáticas) y el raíl sólo dibujaba cadenas por tags. Ahora el raíl y
  las tarjetas salen del mismo cálculo.
- Raíl compacto (número + nombre + marca de estado con `sr-only`); motivo del bloqueo en una línea
  ("Bloqueado: completá X o superá N marcas"); vocabulario único; borrado que nombra el programa;
  menú de categoría visible de 44px; banners con el token de alerta.

## El contrato se actualizó

- **The Lime-is-a-fill Rule**: el lima rellena, bordea y marca; nunca es color de texto sobre papel.
- **The Mono-means-data Rule** endurecida: una frase en mono obliga a deletrear; la frase va en cuerpo
  y el número en `.metric`.
- **Un accent por vista**, con corolario: los controles de fila (`Usar tiempo`, `Aplicar`,
  `confirmar`, `+ serie`) no son la acción de la pantalla.
- **Vocabulario único**: categoría → programa → rutina; "progresión" sólo como cadena.
- **Escala única de `h1`** y chrome de sesión documentado.

## Verificación

```
npm run build        → limpio (tsc -b + vite build + PWA, 30 entradas precacheadas)
npm run lint         → 0 errores, 19 warnings preexistentes
npm test             → 29 archivos, 342 tests
npx playwright test  → 40 tests, mobile + desktop
```

Más recaptura de las siete rutas en 390px/1440px, claro y oscuro, después del pulido.

## Revisión nativa (RDD)

- Candidato agregado del worktree (63 archivos, 4265 líneas): **rechazado por presupuesto**
  (`lens_context_budget_exceeded`, preflight, sin autoridad y sin nada que reparar). El runtime acota
  sólo el inicio del rango, no el final.
- Tramo revisado y **aprobado**: 1610 líneas en 18 archivos (Planes, Program, Routine, Runner, Skill,
  e2e, docs), lentes legibilidad y confiabilidad, línea `review-6171df46cb0ec603`, autoridad
  consumida (`gentle-ai.review-acknowledged/v1`), cero hallazgos bloqueantes.
- Seis hallazgos advisory; dos cerrados después (`exerciseKey` y los tests de `skipDialogCopy`), cuatro
  siguen como trabajo posterior.

## Pendientes (nada de esto bloquea la entrega)

1. **Entrega en slices**: la mitad inicial de la pasada no puede pasar por review nativa agregada; el
   camino es cortar la rama en PRs por unidad (el límite está escrito en
   `odd/tasks/ui-polish-render-pass.md`).
2. Dos sugerencias de legibilidad: `useRunner.ts:420` y `Runner.tsx:52`.
3. `viewport-fit=cover` + safe-area en la nav móvil: sin dispositivo iOS para verificar.
4. Identidad de ejercicios: "mejor marca" cruza marcas por nombre y progreso por id.
5. Cloudflare Access: preflight, AUD y política sin revisar (quedó una consulta abierta).

## Riesgo

**Item 3** de la lista del contrato: cambia contratos que otros ya consumen — copy de UI que la suite
e2e asertaba, la escala de los `h1`, el vocabulario visible y la regla de que el lima no es color de
texto. Todo con tests actualizados en el mismo cambio, pero quien lea la UI anterior va a notar el
cambio.
