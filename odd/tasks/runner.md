# Runner guiado (sesión de entrenamiento)

Adaptación de `clean-architecture/.../Sesion.jsx` al stack Logtenia: runner guiado
paso a paso con registro por serie, descanso entre series/ejercicios, detección de PR y
borrador persistente.

## Specs

- S1: `app/src/lib/sesion.ts` porta `pasosDe`, `clavePaso`, `mismaFila`, `ctxDe` (port de
  sesion.js) con tests.
- S2: `SessionRecord` soporta `sets` (valor por serie) y borrador en settings
  (`borrador:<modelId>`).
- S3: Runner guiado: preview (lista de ejercicios + ajuste de descansos), paso actual con
  input por serie (range para tiempo, stepper para reps), confirmar serie, +/− serie.
- S4: Descanso entre series (auto al confirmar) y entre ejercicios (overlay full-screen
  con countdown + saltar/+10/-10).
- S5: Detección de PR (mejor del día > mejor histórico) y "primera marca".
- S6: Borrador persistente: índice, valores tipeados y descanso se guardan en settings y
  se restauran al volver.
- S7: Resumen final (Fin) con marcas del día y PR destacado.
- S8: Guardado de la sesión en Dexie con sets al finalizar (completed=true).
- S9: Cronómetro para isométricos que vuelca segundos a la serie libre.

## Tasks

- T1 [S1] Port sesion.ts + tests. Route: inline.
- T2 [S2] Borrador + sets en SessionRecord/settings. Route: inline.
- T3 [S3,S9] Reescribir Runner.tsx: preview + paso + inputs + cronómetro. Route: inline.
- T4 [S4] Descanso overlay + auto-avance. Route: inline.
- T5 [S5,S7] PR/primera marca + Fin. Route: inline.
- T6 [S6] Borrador persistente. Route: inline.
- T7 [S8] Guardado de sesión con sets. Route: inline.
- T8 Verificación build/tests/lint. Route: inline.

## Log

- L1: Solicitud del usuario: tomar Sesion.jsx para la sesión de entrenamiento de una rutina.
- L2: Runner reescrito al modelo guiado: preview, paso por ejercicio, registro por serie, descanso overlay, PR/primera marca, borrador persistente, resumen final, guardado de sesión con sets.
- L3: Integrado Cronometro (cuenta arriba con preparación 3-2-1, wake lock, Usar tiempo) y PR conectado al historial de sesiones (db.sessions).
- L4: Sonido de descanso: el overlay de descanso reproduce /sounds/item-found.mp3 + vibración al llegar a 0; desbloquearAudio() en el gesto que inicia el descanso.
- L5: Bugfix: "confirmar" no guardaba el resultado porque setEstado era un wrapper que no propagaba el estado. Refactorizado Paso para usar sets/setSets directos; confirmar ahora persiste la serie en allSets.