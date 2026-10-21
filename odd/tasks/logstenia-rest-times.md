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
  valores tipeados pendientes antes de pasar al siguiente ejercicio.
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
