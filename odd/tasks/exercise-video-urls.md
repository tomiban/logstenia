# Exercise video URLs (thumbnails)

Recolectar con Playwright la URL de un video por cada ejercicio de los PDFs de Pro-gress y
asociarla en el JSON de planes para poder usarla como thumbnail. Rama: `feat/logstenia`.
Delivery: work-unit commits. Runner: `npm test` (vitest) + `npm run build` (tsc+vite).

## Specs

- S1: "quiero que vayas recolectando las url de cada ejercicio con playwright" — cada ejercicio de
  `app/src/data/plans.json` (423 nombres únicos, 616 instancias) queda con la URL de un video
 collected con Playwright. Recorrido en orden de PDF:
  1. `cardio.pdf` → `cardio-casa`
  2. `Front_Lever-Avanzados-PROGRESS©.pdf` → `front-full`
  3. `pdf-calentamiento-movilidad-v1-progress_compress.pdf` → `movilidad-general`
  4. `pdf-div-class-2qs3tf-truncatedtext-module-wrapper-fg1km9p-classtruncatedtext-module-lineclamped-85ulhh-style-max-lines5handstand-workout-movility-v2-progress-p-div_compress.pdf` → `handstand-principiante`, `handstand-intermedio`, `handstand-avanzado`
  5. `pdf-entrenamiento-de-hefesto-para-principiantes_compress.pdf` → `hefesto-principiantes`
  6. `pdf-programa-avanzado-back-lever-hefesto_compress.pdf` → `backlever-hefesto`
  7. `pdf-rutina-de-front-lever-en-calistenia_compress.pdf` → `front-semi`
  8. `pdf-rutinas-de-entrenamiento-para-planche.pdf` → `planche-tuck` (modelos `pl-*`), `planche-tuckadv`, `planche-straddle`, `planche-full`
  9. `pdf-rutinas-de-fuerza-para-principiantes_compress.pdf` → `fuerza-principiantes`, `fuerza-intermedios`, `fuerza-avanzados`
  10. `pdf-rutinas-de-resistencia-planche_compress.pdf` → `planche-tuck` (modelos `res-n1-pr*`)
- S2: "lo asocies en el json" — la URL queda asociada a su ejercicio dentro de
  `app/src/data/plans.json` (campo `video` en cada ejercicio).
- S3: "porque quiero poner como thumbnail" — la asociación incluye una URL de imagen directa
  (`thumbnail`, `https://i.ytimg.com/vi/<id>/hqdefault.jpg`) usable como thumbnail y la URL del
  video (`url`).
- S4: "ve por orde de pdf" — el recorrido de recolección respeta el orden de PDF y de bloque del
  PDF, y el proceso es reproducible y reanudable (no duplica ni pierde lo ya recolectado).
- S5: La app puede consumir el dato: `Exercise` en `app/src/types/index.ts` tipa el campo `video`.
- S6: La recolección es auditable: queda el dato crudo en `scripts/output/exercise-videos.json`
  (nombre del ejercicio → video elegido) y un merge idempotente a `plans.json`.

## Tasks

- T1 [S1,S4] `scripts/collect_exercise_videos.mjs`: recolector Playwright (YouTube search) en
  orden de PDF, con cache reanudable y scoring de candidatos. Route: inline.
- T2 [S6] `scripts/apply_exercise_videos.py`: merge idempotente del dato crudo a `plans.json`
  (`--check` para verificar sin escribir). Route: inline.
- T3 [S5] Tipos `ExerciseVideo` + `Exercise.video` y test del matching nombre→ejercicio. Route: inline.
- T4 [S1] Ejecutar la recolección completa (background) → `scripts/output/exercise-videos.json`. Route: inline.
- T5 [S2,S3] Aplicar el merge a `plans.json` y medir cobertura. Route: inline.
- T6 [S2,S3,S5] Verificación: JSON válido, `npm test`, `npm run build`, `npm run lint`. Route: inline.

## Log

- L1: "quiero que vayas recolectando las url de cada ejercicio con playwright y loasocies en el json oporque quiero poner como thumbnail. ve por orde de pdf" (pedido original, 2026-10-21).
- L2: Fuente de las URLs: YouTube. El sitio original `pro-gress.es` (Shopify, enlaces dentro de
  los PDFs) ya no existe: hoy es Webflow sin biblioteca de ejercicios
  (`/collections/programas/products/*` → 404). YouTube es la única fuente viva con demo por
  ejercicio y thumbnail hotlinkeable (`i.ytimg.com`). Verificado: la búsqueda de YouTube con
  Playwright responde sin bloqueo antibot y devuelve `videoId`, título, canal y duración.
- L3: Alcance de esta unidad: datos (JSON + tipos) e infraestructura de recolección. El uso
  visual del thumbnail en la UI queda para la unidad siguiente (decisión de producto abierta).
- L4: `plans.json` ya tiene cambios sin commitear de la unidad previa (`logstenia-plans-crud`).
  Por eso el dato crudo vive en `scripts/output/exercise-videos.json` y el merge a `plans.json`
  es un script idempotente: nada se pierde al regenerar `plans.json` desde los `build_*.py`.
