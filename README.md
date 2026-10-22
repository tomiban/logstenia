# Logstenia

App web (PWA) minimalista para lanzar rutinas de calistenia a partir de los planes
Pro-gress, con timer interactivo, métricas y videos embebidos.

## Estructura

- `app/` — aplicación React + Vite + TypeScript.
- `app/src/data/plans.json` — datos curados de los planes (Cardio, Movilidad, Handstand, Hefesto, Back Lever, Front Lever, Planche, Fuerza).
- `app/src/data/exercise-videos.json` — dato crudo de videos por ejercicio (base de la que se proyecta `Exercise.video`).
- `odd/tasks/logstenia.md` — tracking ODD del proyecto.
- `PLAN.md` — plan de acción.

## Desarrollo

```bash
cd app
npm install
npm run dev       # http://localhost:5173
npm run build     # producción
npm test          # tests (vitest)
```

## Funcionalidades (MVP)

- Navegación por categorías → programas → intensidades → modelos (rutina del día).
- Detalle de rutina con bloques, ejercicios, descansos y tiempo total.
- Runner con timer: countdown automático para ejercicios por tiempo, confirmación
  manual para por reps, controles +15s/-15s/skip/pausa, sonido al terminar descanso.
- Videos embebidos (YouTube, búsqueda por ejercicio) con toggle ocultar.
- Métricas: sesiones, racha, minutos totales, sesiones por plan.
- Progreso semanal S1..S8 por ejercicio.
- Ajustes: sonido, tema claro/oscuro.
- PWA instalable y offline.

## Pendiente (v2)

- Curar el resto de programas (handstand, hefesto, front lever, planche, fuerza).
- Metas trackeables con barra de progreso.
- Backup/importación JSON (disponible en Ajustes).
- Alertas automáticas por calendario (reglas de conexión).