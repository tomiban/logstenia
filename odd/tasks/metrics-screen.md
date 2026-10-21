# Métricas — rediseño completo de la pantalla

Rediseño integral de la pantalla de métricas de Logstenia: pasa a ser una ruta propia (`/metrics`)
con tab en la navegación, construida sobre el sistema de diseño "The Timing Board" y los principios
de producto (la progresión es el producto, comparar contra uno mismo, local y offline).

## Specs

- S1: "quiero diseñar enteramente toda la pantalla de metricas siguiendo los estandares de diseño y producto."
- S2: Decisión de estructura del usuario: "Ruta propia /metrics con tab en el nav". `/metrics` → Telemetría · Volumen · Marcas (PR) · Metas · Por plan. `/progress` → evolución automática de las sesiones (charts y métricas, sin anotación manual). `/settings` → Sonido · Tema · Datos.
- S2b: Corrección de producto del usuario: "LA IDEA DE PROGRESO NO ES ANOTAR NADA,. DEBE SOR CHARTS Y METRICAS DE MIS REGISTROS COMPARANDO SESIONES GANANCIAS ETC ESO QUIERO PARA SABER COMO VENGO ENTRENANDO" — se elimina el formulario y la tabla semanal S1..S8 de la pantalla; Progreso pasa a derivar todo de los registros.
- S3: La pantalla abre con una franja de telemetría (patrón firma del sistema): 4 lecturas label/número en mono tabular — sesiones, minutos, racha, sesión media — con Δ contra el período anterior de igual longitud.
- S4: Selector de rango: 7 D · 30 D · 90 D · TODO. El estado activo se marca con relleno tinta y texto lima (nunca dos balizas en la misma vista).
- S5: Volumen por semana: últimas 8 semanas en minutos, barras construidas con la retícula suiza (divs, sin librería de charts), números en mono bajo cada columna y resumen accesible.
- S6: Tablero de marcas (PR) por ejercicio, derivado de las series registradas en sesiones y de las marcas explícitas: mejor valor + unidad, Δ contra el récord anterior, fecha, origen y badge lima "PR" solo cuando la marca supera un récord anterior (el primer registro no lleva badge, para no gastar la baliza).
- S7: Metas de los planes con barra de progreso, valor actual editable y estado de logro.
- S8: Distribución de sesiones por plan con barra proporcional y porcentaje.
- S9: Estados vacíos que enseñan la pantalla (qué es cada bloque y cómo llenarlo), no "nada acá".
- S10: Conformidad con `docs/DESIGN.md`: todo número en `.metric` tabular, labels en `.label-caps`, bordes hairline de 1px, radio 0, sin sombras, lima ≤10% de la pantalla, retícula de 12 columnas, touch targets de 44px, copy en español, foco visible, contraste y soporte de tema oscuro.
- S11: El runner persiste la duración real de la sesión, así "minutos" no es siempre 0.
- S12: Build, lint y tests siguen pasando; la pantalla se verifica renderizada a 375px y 1280px.

- S13: La pantalla de Progreso no pide anotar nada: resume "sesiones ganadas" (sesión vs la anterior del mismo plan: más tiempo, o el mismo tiempo con más series), duración por sesión en gráfico, comparación fila a fila con Δ y marcas superadas, y la evolución de cada ejercicio con historial.

## Tasks

- T1 [S3,S4,S5,S6,S7,S8] `app/src/lib/metrics.ts`: derivaciones puras de métricas (rangos, telemetría, volumen semanal, marcas, metas, distribución por plan) + `app/src/lib/metrics.test.ts`. Route: inline. Commit: `feat(metrics): add pure metrics derivations with tests`.
- T2 [S3,S4,S5,S6,S7,S8,S9,S10] `app/src/pages/Metrics.tsx`: pantalla de métricas rediseñada. Route: inline. Commit: `feat(metrics): redesign metrics screen with telemetry, volume and marks`.
- T3 [S2,S10] Split de `/progress` y `/settings`: `app/src/pages/Settings.tsx` nuevo, `app/src/pages/Progress.tsx` reducido al registro semanal, rutas en `app/src/App.tsx` y nav de 5 tabs en `app/src/components/Layout.tsx`; `app/src/lib/stats.ts` eliminado (quedó sin consumidores). Route: inline. Commit: `feat(nav): split metrics, progress and settings into their own routes`.
- T4 [S11] `app/src/pages/Runner.tsx` + `app/src/lib/session.ts`: persistir `durationSec` real con el cálculo de duración cubierto por test unitario. Route: inline. Commit: `fix(runner): persist real session duration`.
- T5 [S12] Verificación: `npm run build`, `npm run lint`, `npm test` y captura renderizada de `/metrics`, `/progress` y `/settings` a 390px, 768px y 1280px, en claro y oscuro. Route: inline. Commit: ninguno (verificación).
- T6 [S2b,S13] `app/src/pages/Progress.tsx` + `app/src/lib/metrics.ts`: reemplazo del registro manual por evolución automática (comparación de sesiones + series por ejercicio). Route: inline. Commit: `feat(progress): replace manual register with session evolution`.

## Log

- L1: "quiero diseñar enteramente toda la pantalla de metricas siguiendo los estandares de diseño y producto." (pedido original del usuario, repetido dos veces).
- L2: Contexto levantado con `impeccable context --target app/src/pages/Progress.tsx` (PRODUCT.md + DESIGN.md "The Timing Board", modo Operate) y `reference/craft-floor.md` + `reference/operate.md`.
- L3: Decisión de estructura tomada por el usuario: ruta propia `/metrics` con tab en el nav; `/progress` conserva el registro semanal; Ajustes sale a `/settings`.
- L4: Hallazgo: `durationSec` se guardaba siempre en 0 en `Runner.tsx`, por lo que "minutos totales" era 0 en todas las pantallas. El diseño de la franja de telemetría exige el dato real → T4 lo arregla antes de la pantalla.
- L5: Hallazgo: las marcas registradas en sesión (`SessionSet`, con `unit`) nunca se mostraban en ninguna pantalla. El tablero de marcas (S6) es elgap real que hoy impide cumplir el principio de producto "la progresión es el producto".
- L6: Implementado T1-T4: `lib/metrics.ts` (27 tests), `pages/Metrics.tsx`, split de `/progress` y `/settings`, nav de 5 tabs y `durationSec` real en el runner.
- L7: Verificación visual con capturas renderizadas (390px, 768px y 1280px, claro y oscuro) contra el sistema de diseño: se corrigieron el badge "PR" (ahora solo cuando hay mejora real), el gris de barras (regla Ink-or-Paper), el ancho de las barras del gráfico y la línea de base.
- L8: Hallazgo de tokens: `--foreground`, `--ink` y `--muted-surface` no se redefinen en `.dark`, así que el texto y las barras quedaban invisibles en tema oscuro. Las pantallas nuevas usan `--text`, `--muted`, `--secondary` y `--border` (tokens que sí se redefinen) y el estado activo del nav y del filtro usa `bg-primary`/`text-primary-foreground`.
- L9: Revisión GGA (proveedor opencode, porque el hook exige Claude CLI y no está instalado) sobre `lib/metrics.ts`: tipos re-declarados, identificadores y comentarios en español, campos muertos, `Delta.dir` sin consumidor y duplicación con `lib/stats.ts`. Todo corregido en el mismo commit; `stats.ts` se eliminó al quedar sin consumidores.
- L10: `durationSec` se calculó en el runner a partir del tiempo transcurrido y el cálculo se extrajo a `lib/session.ts` con test unitario, siguiendo la regla del proyecto de cubrir la lógica del runner con tests.
- L11: El usuario corrigió el producto: "LA IDEA DE PROGRESO NO ES ANOTAR NADA,. DEBE SOR CHARTS Y METRICAS DE MIS REGISTROS COMPARANDO SESIONES GANANCIAS ETC ESO QUIERO PARA SABER COMO VENGO ENTRENANDO". Se reescribió la pantalla de Progreso: el formulario semanal S1..S8 y la tabla de registros salen de la UI (los datos ya guardados no se borran) y entran resumen de sesiones ganadas, gráfico de duración por sesión, comparación fila a fila con Δ y marcas superadas, y evolución por ejercicio.
- L12: `lib/metrics.ts` crece con `compareSessions` (comparación contra la sesión anterior del mismo plan, detección de marcas superadas) y `exerciseSeries` (trayectoria por ejercicio); 37 tests cubren `metrics.ts` y 4 cubren `session.ts`. Un test se verificó por mutación: sin la regla "mismo tiempo + más series = ganada" el test falla.
- L13: La review GGA marcó el uso de `var(--token)` en className (AGENTS.md lo rechaza) y la falta de manejo de error en las llamadas a la base: las pantallas nuevas migraron a las utilidades semánticas (`text-foreground`, `text-muted-foreground`, `bg-card`, `bg-secondary`, `border-border`, `bg-accent`, `bg-primary`) y se registró `--color-ink` en `@theme inline`; cada `await db.*` quedó con try/catch y la importación de backup valida la forma del JSON.
- L14: Commits (rama `feat/logstenia`): `4746ac8` feat(metrics): redesign metrics screen with telemetry, volume and marks · `2ec0b06` feat(progress): replace manual register with session evolution · `29cef52` feat(nav): split metrics, progress and settings into their own routes · `5827786` fix(runner): persist real session duration · `7af7a48` + `58ce641` + `287909f` ajustes de review (barras, reloj de sesión, una sola baliza por vista).
- L15: Verificación final: `tsc -b` limpio, `npm run build` OK, `npm test` 57/57 en 5 archivos, `npm run lint` sin errores (los warnings restantes son preexistentes de Home/Runner/Layout), detector de Impeccable sin hallazgos y capturas renderizadas a 390px, 768px y 1280px en claro y oscuro de `/metrics`, `/progress` y `/settings`. La assessment nativa (`gentle_review assess` sobre 9dc6cb6..HEAD) devolvió riesgo medio con `reviewDue: false` ("under_budget"), así que no se abrió una review nativa.
