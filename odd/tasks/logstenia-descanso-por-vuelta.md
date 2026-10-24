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
- T2 [S1,S2] Mover el disparo del descanso de serie de `Runner.tsx` (`Paso`) a `useRunner.ts`:
  registra la serie y solo inicia el descanso si la vuelta quedó completa. Route: inline.
- T3 [S1,S3] e2e en `app/e2e/runner.e2e.ts`: en un modelo de superseries confirmar un ejercicio
  no abre el temporizador y confirmar el último de la vuelta sí; el caso de un solo ejercicio
  sigue en verde. Route: inline.
- T4 [S1,S2,S3] Verificación (`npm test`, `npm run test:e2e`, `npm run lint`, `npm run build`).
  Route: inline.

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
