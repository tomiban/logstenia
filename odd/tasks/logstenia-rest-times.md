# Logstenia — Descansos por serie y por ejercicio

El runner respeta los descansos configurados de la rutina y los informa dentro del contenedor
del ejercicio: el descanso de cada serie y el descanso al finalizar el ejercicio. Esos tiempos
no se editan en ningún punto de la app.

## Specs

- S1: "cada rutina debe tener por ejercicio y por serie sus tiempos de descanso" — cada
  ejercicio de la rutina informa su descanso por serie y su descanso al finalizar el ejercicio.
- S2: "no puede ser editables solo en el timer propio  del descanso que hay apra agregar qutiar
  o omitir pero debemos respetar esos configurados" — el overlay de descanso no permite editar
  la duración configurada; solo ofrece agregar (+10s), quitar (-10s) u omitir (saltar). El runner
  usa el descanso configurado de la rutina, nunca un valor global editable.
- S3: "en el runner debemos informar el tiempo de descanso pro serie y al finalizar el ejercicio"
  — el runner muestra el descanso de cada serie y el descanso final del ejercicio.
- S4: "en el runnner hay un boton guardar serie que es redundante. la serie se guarda con el boton
  fonrimar y se confirma al dar siguiente para pasar a otro ejercicio" — se elimina "Guardar
  series"; la serie se registra con "confirmar" y al presionar "Siguiente" se confirman los
  valores tipeados pendientes antes de pasar al siguiente ejercicio. Si quedan series sin
  registrar, "Siguiente" abre un modal que informa cuántas se omiten antes de continuar.
- S5: "yo solo quiero esto y asegurarme por ahora que no seane ditables. debias ocultar ese
  seccion con el tiempo de descanso y el toggle para abrir lso sliders. esa data ahora debia
  estar dentro del cotnenedor del ejericio pero sin posibilidad de cambio." — los descansos salen
  solo de los datos del bloque (`restBetweenSetsSec`, `restBetweenExercisesSec`), sin modelo de
  datos nuevo; la sección con el tiempo de descanso y el toggle de los sliders desaparece y esa
  información queda dentro del contenedor del ejercicio, sin posibilidad de cambio.

## Tasks

- T1 [S1,S5] Resolución de descansos: `app/src/lib/rest.ts` (series del bloque, descanso entre
  series, descanso al finalizar el ejercicio) + `app/src/lib/steps.ts` (un paso por ejercicio con
  sus descansos) + tests. Route: inline.
- T2 [S3,S5] Runner: informar el descanso de cada serie y el descanso final dentro del
  contenedor del ejercicio. Route: inline.
- T3 [S2] Runner: respetar los descansos configurados (se van los sliders editables y el toggle;
  el overlay queda en +10s / -10s / omitir). Route: inline.
- T4 [S4] Runner: eliminar "Guardar series"; "Siguiente" confirma lo tipeado y avanza. Route: inline.
- T5 [S1..S5] Verificación (tests, build, lint, e2e) y docs (`PLAN.md`, `AGENTS.md`). Route: inline.
- T6 [S3] Vista de rutina con el detalle por ejercicio. Dropped: el usuario pidió que la
  información viviera en el contenedor del ejercicio del runner; la vista de rutina ya informa el
  descanso del bloque.

## Log

- L1: "cada rutina debe tener por ejercicio y por serie sus tiempos de descanso"
- L2: "cada rutina debe tener por ejercicio y por serie sus tiempos de descanso. no puede ser
  editables solo en el timer propio  del descanso que hay apra agregar qutiar o omitir pero debemos
  respetar esos configurados."
- L3: "en el runner debemos informar el tiempo de descanso pro serie y al finalizar el ejercicio"
- L4: "en el runnner hay un boton guardar serie que es redundante. la serie se guarda con el boton
  fonrimar y se confirma al dar siguiente para pasar a otro ejercicio"
- L5: "yo solo quiero esto y asegurarme por ahora que no seane ditables. debias ocultar ese
  seccion con el tiempo de descanso y el toggle para abrir lso sliders. esa data ahora debia
  estar dentro del cotnenedor del ejericio pero sin posibilidad de cambio."
- L6: Decisión de diseño: los descansos se leen del bloque (`restBetweenSetsSec` entre series,
  `restBetweenExercisesSec` entre ejercicios). El descanso entre series del bloque es el
  descanso de cada serie; el descanso al finalizar un ejercicio es el descanso entre
  ejercicios del bloque y, para el último ejercicio del bloque, el descanso entre series.
- L7: Se descartan el modelo de datos nuevo (`restAfterSetSec` / `restAfterExerciseSec` por
  ejercicio) y el script `scripts/expand_rests.py`: no hacen falta para lo pedido.
- L8: El panel superior del runner con los sliders editables y su toggle se eliminan; los
  descansos quedan dentro del contenedor del ejercicio (encabezado y cada fila de serie) y el
  overlay de descanso conserva +10s / -10s / "saltar descanso".
- L9: Verificación: `npm test` (75 ok), `npm run build` (ok), `npm run lint` (sin errores) y
  `npm run test:e2e` (18 ok: 9 pruebas × mobile/desktop). La prueba e2e del runner cubre que los
  descansos se informan, que no hay sliders editables y que el descanso de serie y el final
  usan la duración configurada.
- L10: Commits (rama `feat/logstenia`): `13e7d05` feat(app): respect the routine rests in the
  runner and drop the redundant save · `ccbf3bc` docs(app): document the routine rests and the
  runner flow. El commit previo `15aff14` deja el trabajo pendiente de sesiones anteriores
  (CRUD de planes, marcas por id, videos de ejercicio) en un commit aparte para no mezclarlo.
  Nota: el hook de pre-commit (GGA) no puede ejecutarse en este entorno (falta el Claude CLI) y
  el assessment nativo quedó `unassessable`; la verificación es la de L9.
- L11: En el runner, el descanso de serie arranca al confirmar una serie que no es la última y
  el descanso final arranca al confirmar la última serie o al presionar "Siguiente"; el overlay
  aplica el destino configurado tanto al terminar la cuenta regresiva como al omitirlo.
- L12: "no aparece ahora el tempriozadoor de descanso al darle siguiente" — el descanso al
  finalizar el ejercicio no se disparaba al presionar "Siguiente" en rutinas cuyo bloque no
  define descanso entre ejercicios (`restBetweenExercisesSec: 0`, como las superseries de
  cardio): el descanso quedaba en 0 y no se armaba el temporizador.
- L13: Corrección: (a) el descanso al finalizar el ejercicio es el descanso entre ejercicios del
  bloque y, si el bloque no lo define (0 o ausente), el descanso entre series del bloque;
  (b) el temporizador del descanso final se dispara siempre al presionar "Siguiente" (que
  confirma lo tipeado y pasa al ejercicio siguiente) y no al confirmar la última serie, que solo
  registra la serie. Se eliminó el estado `descansoFinalAplicado`.
- L14: Nota de concurrencia: durante la sesión aparecieron archivos de otra sesión de agente
  (`app/src/lib/videos.ts`, `app/src/data/plansVideo.test.ts`,
  `scripts/output/exercise-videos.json`). Los 4 tests que fallan en `npm test` pertenecen a ese
  trabajo en curso (videos por ejercicio) y no a esta feature: `src/lib/rest.test.ts` y
  `src/lib/steps.test.ts` están en verde.
- L15: "si le damos siguiente y no hemos compeltados todas las series que menciona la rutina
  debemos poner un modal diciendo que omitiremos x series"
- L16: El modal "series sin registrar" aparece al presionar "Siguiente" cuando el ejercicio
  tiene series sin registrar: "Quedan N series sin registrar. Si continuás, se omiten." con
  "Cancelar" (quedarse en el ejercicio) y "Continuar" (confirmar lo tipeado, omitir el resto y
  aplicar el descanso final). Toma el foco al abrirse y se cierra con Escape.
