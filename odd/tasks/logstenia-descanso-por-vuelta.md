# Logstenia — Descanso de serie por vuelta en bloques multiejercicio

El descanso de serie de un bloque con más de un ejercicio (biseries/superseries) se dispara por
vuelta completa, no al confirmar una serie de un solo ejercicio. El comportamiento de los bloques
de un ejercicio no cambia.

## Specs

- S1: "en bloques de ejercicios con asm de un ejercicio al confirmar uno se abre el timer pero no
  deberia abrirse hasta que todos esten confirmados" — en un bloque con más de un ejercicio, el
  temporizador de descanso de serie se abre recién cuando todos los ejercicios del bloque
  confirmaron esa vuelta; con la vuelta incompleta no se abre.
- S2: La vuelta se identifica por el índice de serie: S1 de todos los ejercicios del bloque, luego
  S2 de todos, y así. La última vuelta del bloque no abre descanso de serie: el descanso final
  sigue saliendo de "Siguiente" (ver `odd/tasks/logstenia-rest-times.md`, L11 y L13).
- S3: Debe conservarse el comportamiento actual de los bloques de un solo ejercicio (ver
  `odd/tasks/logstenia-rest-times.md`), sin tocar el descanso final ni el modal de series sin
  registrar.

## Tasks

- T1 [S1,S2] Helper puro en `app/src/features/runner/runnerLogic.ts` (`rondaCompleta`,
  `esUltimaVuelta`) + tests unitarios en `runnerLogic.test.ts` (primero en rojo). Route: inline.
  Commit: `7a93888`.
- T2 [S1,S2] Mover el disparo del descanso de serie de `Runner.tsx` (`Paso`) a `useRunner.ts`:
  registra la serie y solo inicia el descanso si la vuelta quedó completa. Route: inline.
  Commit: `7a93888`.
- T3 [S1,S3] e2e en `app/e2e/runner.e2e.ts`: en un modelo de superseries confirmar un ejercicio
  no abre el temporizador y confirmar el último de la vuelta sí; el caso de un solo ejercicio
  sigue en verde. Route: inline. Commit: `7a93888`.
- T4 [S1,S2,S3] Verificación (`npm test`, `npm run test:e2e`, `npm run lint`, `npm run build`).
  Route: inline. Commit: ninguno (verificación).

## Log

- L1: "quiero reportar un bug. en bloques de ejercicios con asm de un ejercicio al confirmar uno se
  abre el timer pero no deberia abrirse hasta que todos esten confirmados"
- L2: Causa raíz encontrada antes de escribir código: `Runner.tsx` (`Paso.confirmarSerie`)
  disparaba el descanso con solo mirar las series del propio ejercicio (`i >= series - 1`), y cada
  ejercicio del bloque se renderiza como su propio `Paso` con el `restAfterSetSec` del bloque. El
  overlay de descanso además tapa la pantalla y marca `bloqueado` a los otros ejercicios del
  bloque, así que la vuelta no se podía completar.
- L3: Alcance medido en `plans.json`: 142 bloques con más de un ejercicio en 60 modelos
  (p. ej. `cardio-r1`: superseries de 4 ejercicios, 3 vueltas, 60s por serie; `pl-r2`: biseries).
  `hef-h1`, usado por los e2e actuales, es de un solo ejercicio por bloque y no está afectado.
- L4: Decisión de diseño (usuario eligió "primero el spec en ODD"): la decisión de descansar vive
  en `useRunner`, no en cada `Paso`; el helper puro recibe los sets registrados (`setsRef.current`,
  que se actualiza de forma síncrona) y las filas por ejercicio.
- L5: El usuario eligió "Primero el spec en ODD": este documento se escribe antes de implementar y
  la implementación va después, inline (unidad de comportamiento única).
- L6: Rojo observado antes de implementar: unitarios fallando por helpers ausentes
  (`rondaCompleta is not a function`), y e2e del caso superseries fallando porque el diálogo
  "Descanso en curso" ya estaba abierto tras confirmar el primer ejercicio.
- L7: Implementación: `rondaCompleta` y `esUltimaVuelta` en `runnerLogic.ts`; `useRunner` expone
  `confirmarSerie`, que registra la serie y solo abre el descanso de serie cuando la vuelta quedó
  completa y no es la última (`setIndex < filas`); `Paso` (`Runner.tsx`) solo registra. Se retiró
  `registrarEx` de la interfaz pública del hook (quedó interna, la usan `confirmarSerie` y
  `confirmarTipeados`).
- L8: Verificación: `npm test` (180 ok, 17 archivos), `npm run test:e2e` (34 ok = 17 × mobile y
  desktop), `npm run lint` (0 errores; solo los warnings preexistentes) y `npm run build`
  (`tsc -b` + vite + PWA ok). Los e2e de un solo ejercicio (`hef-h1`) siguen en verde sin cambios:
  ahí está la prueba de que el comportamiento previo no cambió.
- L9: Sin commits: la rama `backend` tiene trabajo de otras sesiones sin commitear (`PLAN.md`,
  `docs/DEPLOY.md`, `app/vite.config.ts`, `wrangler.toml`) y el usuario no pidió commit.
- L10: Consolidación de ramas pedida por el usuario: `backend` mergeado a `main` (fast-forward a
  `e43eb58`, app 174/174 y worker 33/33 en verde tras `npm install` en ambos paquetes) y esta rama
  rebaseada encima. El único conflicto fue `docs/DEPLOY.md` (§6 y la tabla de problemas, que las
  dos ramas reescribieron): quedó la versión de `main` más la sección "Desarrollo local" y los dos
  diagnósticos de Access de esta rama. El commit `wip(...)` de otra sesión se partió en cuatro
  unidades con su verificación: `7a93888` (T1-T3, 182 líneas), `408117d` (pass de diseño
  claro/oscuro + tokens fijos `on-accent`/`on-ink`, 226), `f3b4642` (proxy `/api` de Vite + doc de
  desarrollo local, 52) y `42d047a` (borrado de `PLAN.md` + referencias en README/AGENTS, 197).
  Límite de slice: `408117d`, con 408 líneas autoradas entre `main` y ese commit.
- L11: Publicación: como la rama ya estaba pusheada, en vez de force-pushear se subió la historia
  dividida como `feature/descanso-por-vuelta-v2`, se mergeó con PR #1 (`--rebase`, así que `main`
  ganó los cinco commits lineales `7a93888`, `408117d`, `f3b4642`, `42d047a`, `cd8d98e`) y después
  se borraron las ramas locales y remotas, incluida `backend`. `main` verificado después del
  merge: 200/200 unit, build ok. Los SHAs de L10 cambiaron por ese rebase; esta entrada tiene los
  definitivos. La revisión nativa del candidato (lineage `review-eb228b4a22c7b5cd`) quedó sin
  veredicto: el relay del host falla con `reviewer-config-invalid` porque no hay modelo asignado al
  lens `review-readability`; el candidato y sus dos slots siguen intactos y reanudables.
