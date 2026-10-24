# Desafíos por nivel

Rutina de desafío (estilo PRO1) para cada nivel que hoy no tiene certificado propio, y certificación del nivel derivada de sus marcas: el desafío aprobado es el examen que completa el plan y abre el siguiente.

## Specs

- S1: Pedido del usuario, verbatim: "me gustaria que me ayudes a preparar rutinas como las de tuck pero para el nivel correspondiente comod esafio para saber si completamos ese plan".
- S2: Alcance aprobado, verbatim: "todas las que no tengan las PRO" — todo nivel sin desafío PRO propio: fuerza (3), full front lever (1), hefesto (2) y handstand principiante/intermedio (2). Los 4 PRO1 de planche, `semi-benchmark` y `handstand-benchmark` ya sirven de certificado y no se reescriben.
- S3: Handstand pasa a ser cadena de progresión, verbatim: "Sí, cadena con desafíos" (`handstand-principiante` → `handstand-intermedio` → `handstand-avanzado`).
- S4: Un desafío se aprueba en el techo del rango prescrito, verbatim: "Techo del rango (4-6 → 6)". `timeSec` se exige exacto.
- S5: Cada programa con progresión tiene una rutina `benchmark` llamada "Desafío" cuyos objetivos numéricos (reps o timeSec de cada ejercicio) son el certificado del nivel.
- S6: Un nivel queda completado cuando se cumplen **todas** las marcas numéricas de su desafío, o cuando corrió todas sus rutinas; el nivel siguiente se desbloquea al completar el anterior.
- S7: Tabla aprobada de desafíos y objetivos (ejercicio / objetivo):
  - Fuerza principiante: Dominadas pronas 10 · Fondos en paralelas 10 · Australian pull ups 15 · Flexiones en pica 8 · Leg raises colgado 8
  - Fuerza intermedio: Dominadas explosivas 10 · Fondos explosivos 10 · Isométrico pino en pared 30s · Leg raises (1 mano) 5 · Flexiones lean planche 8
  - Fuerza avanzado: Dominadas pronas explosivas (hasta debajo del pecho) 8 · Flexiones pino en pared 6 · Hefesto asistido (pies en suelo) 10 · Lean planche (buscando inclinación) 10s
  - Semi Front Lever: Semi front lever 10s · De L sit a tuck adv FL 8 · Pull ups Tuck Adv. FL 10
  - Full Front Lever: Hold en front lever full 5s (sin banda) · Pull ups Front lever full (banda) 5 · De tuck Fl a full Fl (banda en pies) 4
  - Hefesto principiante: Hefestos (max reps hasta fallo técnico) 3 · Korean dips (agarre supino) 12 · Skin the cat (supino) 7
  - Hefesto avanzado: Hefesto (45° o mayor inclinación) 1 · Isométrico Hefesto touch (full/half lay BL) 3s · Hefesto hasta la cadera (un pie asistido) 8
  - Handstand principiante: Plancha en T dinámica 20s · Flexiones en pica (buscando profundidad) 8 · Empujes de pino con cadencia 5-3 (banda) 3
  - Handstand intermedio: Aguantes de pino en pared 35s · Flexiones en pino parciales (pared) 8 · Intentar pino desde la pared 10
  - Handstand avanzado: Pino por libre 40s
- S8: El criterio de hefesto es 3 hefestos: el ejercicio `Hefestos (max reps hasta fallo técnico)` con objetivo 3 reps. Las negativas, curls y variantes asistidas no cuentan como hefesto.
- S9: Una marca `max`, `RIR1` o sin valor no exige objetivo y no bloquea el certificado.
- S10: Los ejercicios nuevos reutilizan nombres que ya existen en `exercise-videos.json` (plansVideo.test lo exige) y copian `id` y `video` del ejercicio homónimo. Excepción aprobada: `Hold en front lever full` es un nombre nuevo y su entrada se inserta junto a `Hold en Front lever full (banda)` para no romper el orden del catálogo (el último par clave/pdf lo verifica plansVideo.test).
- S13: El hold de `Straddle Planche (intentos)` en `str-pro1` certifica 5 segundos (`timeSec: 5`).
- S11: No se renombran los `id` de modelos existentes: las sesiones guardadas referencian `modelId`.
- S12: El certificado se deriva de las marcas registradas en sesiones completadas; no se escriben filas nuevas en `marks`.

## Tasks

- T1 [S5,S7,S8,S10,S11] Datos: desafíos en `app/src/data/plans.json` (5 modelos existentes normalizados/reescritos + 3 nuevos: front-full, handstand n1 y n2).
- T2 [S3,S6,S9,S12] Código: certificación derivada del desafío en `app/src/features/plans/progression.ts`, sin tabla de criterios en código, más la cadena de handstand.
- T3 [S1..S9] Tests unitarios de progresión actualizados a los nuevos criterios.
- T4 [S1,S2] Ajustar/añadir e2e del flujo de desafío.
- T5 [S1..S12] Verificación: `npm test`, `npm run lint`, `npm run build`, `npm run test:e2e`.

## Log

- L1: "me gustaria que me ayudes a preparar rutinas como las de tuck pero para el nivel correspondiente comod esafio para saber si completamos ese plan".
- L2: Decisiones del usuario: alcance "todas las que no tengan las PRO"; handstand "Sí, cadena con desafíos"; aprobación "Techo del rango (4-6 → 6)".
- L3: Contexto previo: el desbloqueo por marcas ya lee `sessions.sets`; hoy los criterios viven en código (`EDGE_ANCHORS`, hefesto = 3 hefestos) y quedan pendientes `planche-tuckadv → straddle` y `straddle → full`, que este feature resuelve usando los PRO1 de cada nivel.
- L4: Restricciones verificadas: roundtrip de `plans.json` idéntico (transformable por script); `plansVideo.test.ts` exige entrada en `exercise-videos.json` para cada nombre de ejercicio; "Hefestos" no existe como nombre, se usa "Hefestos (max reps hasta fallo técnico)".
- L5: Criterio de straddle definido por el usuario (verbatim): "SI 5" → `Straddle Planche (intentos)` pasa de `reps: max` a `timeSec: 5` y certifica el hold.
- L6: Criterio de front lever full definido por el usuario (verbatim): "EL FRONT LEVER FULL CAMBIA EL DE BADNA POR FULL 5\"" → el hold con banda de 3s se reemplaza por `Hold en front lever full` 5s; el nombre nuevo requiere entrada propia en exercise-videos.json.
