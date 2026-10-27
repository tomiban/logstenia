# Runner — salir de una sesión empezada

Hoy el runner guarda un borrador (`draft:<modelId>` en `settings`) en cada cambio y lo restaura al
volver a entrar, pero **sin preguntar nada**: si salís a mitad de sesión no hay forma de decir "esto
no lo quiero", y si volvés tampoco hay forma de decir "empecemos de cero". Esta feature pone una
decisión explícita en el medio.

## Specs

- **S1.** Al intentar salir de una sesión **empezada** aparece un modal antes de abandonar la
  pantalla, con dos caminos: guardarla para retomarla, o descartar los valores.
- **S2.** "Guardar para retomarla" conserva el borrador tal como está y, al volver a entrar, la
  sesión se retoma en el mismo punto: paso actual, valores cargados y descanso en curso si lo había.
- **S3.** "Resetear los valores" descarta el borrador y arranca desde cero: paso 1, todas las series
  vacías, sin descanso pendiente.
- **S4.** El modal **no** aparece si no hay nada que perder: sesión sin empezar (sin series
  registradas y sin valores cargados) o sesión ya finalizada.
- **S5.** Cubre las salidas reales: la nav del shell (Hoy / Planes / Métricas), el "volver" interno
  del runner y el cierre o recarga de la pestaña.
- **S6.** Descartar es una acción destructiva: el botón usa el tratamiento destructive del contrato
  (`DESIGN.md`), y cancelar deja al usuario donde estaba sin cambios.

## Tasks

- T1 [S1,S4] Definir "sesión empezada" en `runnerLogic.ts` (¿hay series registradas o valores
  cargados?) y testearlo. Route: inline.
- T2 [S1,S2,S3,S6] Modal de salida con las dos acciones + cancelar; engancharlo al intento de salida
  del shell y al "volver" del runner. Route: subagente (worker) por ser UI con estado.
- T3 [S5] Cubrir cierre/recarga de pestaña (`beforeunload`) sin romper la PWA. Route: inline.
- T4 [S2,S3] Verificar que "guardar" retoma y "resetear" arranca limpio, con e2e en
  `app/e2e/runner.e2e.ts`. Route: inline.

## Contexto técnico

- El borrador vive en `useRunner.ts`: se lee en un efecto al montar (`draftFrom`), se reescribe en
  cada cambio y hoy se restaura **sin validar**: un valor fuera del techo del ejercicio se recorta
  recién al mostrarlo (`clampSeconds`), no al guardarse.
- Ese camino de restauración es el principal sospechoso del "20s fantasma" que reportó el usuario
  (una serie con valor que no cargó): la feature es la ocasión natural para instrumentarlo y dejarlo
  probado.
- No hay navegación protegida hoy: salir y volver es silencioso, y `settingsRepository.delete` ya
  existe para borrar el borrador.

## Log

- L1: `si me salgo de una sesion empezada deberia antes tener un mkodal que me rpegunte si la
  quiero guardar para teomarla o no para resetear los valores.`
- L2: Contexto del pedido — apareció mientras se investigaba una serie con un valor que el usuario
  no había cargado; el borrador silencioso es la causa más probable y esta feature lo vuelve
  explícito.
