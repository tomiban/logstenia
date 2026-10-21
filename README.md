# Logstenia

App web (PWA) minimalista para lanzar rutinas de calistenia a partir de los planes
Pro-gress, con timer interactivo, métricas y videos embebidos.

## Estructura

- `app/` — aplicación React + Vite + TypeScript.
- `scripts/` — parsing de PDFs (`parse_pdfs.py`) y builder de datos (`build_cardio.py`).
- `app/src/data/plans.json` — datos curados de los planes (Cardio, Movilidad, Handstand, Hefesto, Back Lever, Front Lever, Planche, Fuerza).
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

## Datos

Los PDFs se extraen con `scripts/parse_pdfs.py` (genera `scripts/output/*.txt`).
`scripts/build_cardio.py` genera `app/src/data/plans.json` con el programa de Cardio
curado. El resto de categorías están como placeholder para curación incremental.

### Videos de ejercicio (thumbnails)

Cada ejercicio tiene asociado un video de YouTube (recolectado con Playwright) para
poder mostrarlo como thumbnail:

```bash
node scripts/collect_exercise_videos.mjs            # recolecta (reanudable, orden de PDF)
node scripts/collect_exercise_videos.mjs --list     # lista los ejercicios en orden de PDF
python3 scripts/apply_exercise_videos.py            # proyecta el dato crudo en plans.json
python3 scripts/apply_exercise_videos.py --check    # verifica sincronía sin escribir
python3 scripts/apply_exercise_videos.py --stats    # cobertura y ejercicios sin video
python3 scripts/set_exercise_video.py --list   # lista ejercicios sin video
python3 scripts/set_exercise_video.py "Nombre" "https://www.youtube.com/watch?v=ID"  # fija/corrige un video a mano
```

El recolector recorre los PDFs en orden (`cardio.pdf` → ... →
`pdf-rutinas-de-resistencia-planche_compress.pdf`), busca un video por nombre de
ejercicio y deja el dato crudo en `scripts/output/exercise-videos.json`. El merge a
`app/src/data/plans.json` es idempotente: el campo `video` de cada ejercicio es siempre
la proyección de ese archivo.

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