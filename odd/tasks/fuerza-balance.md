# Balance de las rutinas de fuerza

Rebalancear las 24 rutinas de los 3 programas de fuerza: toda rutina con tracción y empuje, sin días de un solo lado, sin sobreuso de un mismo ejercicio explosivo, con core y sin piernas (programa de tren superior).

## Specs

- S1: Pedido del usuario, verbatim: "AJUSTA LAS RUTINAS DE FUERZA PORQUE ESTAN DESBALANCEADAS. REVISA BIEN LOS PLANES."
- S2: Tren inferior, decisión del usuario (verbatim): "Tren superior puro" — no se agregan bloques de piernas; sólo se mantiene lo que ya existe (`fz-b4`).
- S3: Toda rutina de fuerza tiene al menos un bloque de tracción y uno de empuje.
- S4: Ni la tracción ni el empuje acumulan más de 3 **ejercicios** en una misma rutina (un bloque puede agrupar varios).
- S5: Toda rutina tiene al menos un bloque de core.
- S6: Un ejercicio explosivo no aparece más de dos veces por programa.
- S7: Se mantienen 8 rutinas por programa con `id` intacto, misma duración (20 min) y los descansos de cada bloque.
- S8: No se agregan nombres de ejercicio nuevos: se reutilizan los que ya existen en `plans.json` y `exercise-videos.json`.
- S9: Las rutinas `Desafío` (benchmark) no se tocan: son el certificado del nivel.
- S10: Un test de datos (`app/src/data/fuerzaBalance.test.ts`) verifica S3-S6 sobre `plans.json`.

## Cambios por rutina

### fuerza-principiantes

- fz-b1: `Australian pull ups pronas [8-12]` → `Leg raises colgado [20s]`.
- fz-b2: biseries `[Salto a fondo en barra [6-10] + Flexiones inclinadas explosivas [8-12]]` → bloque simple `Remos con banda (a la cadera) [6-12]`.
- fz-b3: `Dominadas supina (cadencia 2-2-2) [4-8]` → biseries `[Fondos en banco [8-12] + Flexiones normales (cadencia 2s hold abajo/arrriba) [6-10]]`.
- fz-b4: biseries `[Flexiones supinas (barra baja) [6-10] + Flexiones normales [4-8]]` → biseries `[Leg raises colgado [20s] + Australian pull ups pronas [8-12]]`.
- fz-b5: superseries `[Leg raises colgado [20s] + Knee raises laterales [20s] + Plank a planche [20s]]` → `[Leg raises colgado [20s] + Australian pull ups [6-12] + Plank a planche [20s]]`.
- fz-b6: biseries `[Fondos en banco [6-12] + Reverse lean planche [10s]]` → biseries `[Dominadas prona asistidas (banda) [4-8] + Australian pull ups pronas [8-12]]`.
- fz-b7: superseries `[Flexiones diamante [4-8] + Flexiones normales (ancho poco más que hombro) [4-8] + Flexiones abiertas [4-8]]` → `[Flexiones diamante [4-8] + Flexiones normales (ancho poco más que hombro) [4-8] + Dominadas supinas (rango parcial) [4-8]]`.
- fz-b8: biseries en B1 `[Australian pull up (agarre prono abierto) [4-6] + Australian pull up (agarre prono estándar) [4-6] + Australian pull up (agarre supino) [4-6]]` → `[Australian pull up (agarre prono abierto) [4-6] + Flexiones normales (ancho poco más que hombro) [4-8] + Australian pull up (agarre supino) [4-6]]`; biseries `[Pull ups de hefesto asistido [6-12] + Lean planche supina [10s]]` → `[Flexiones en pica [6-12] + Lean planche supina [10s]]`.

### fuerza-intermedios

- fz-int-b2: `Fondos en paralelas (explosivos) [6-8]` → biseries `[Fondos en paralelas (explosivos) [6-8] + Leg raises colgado [20s]]`.
- fz-int-b3: `Dominadas explosivas (pasando barbilla) [6-8]` → biseries `[Dominadas supinas (rango parcial) [4-8] + Leg raises completas [6-8]]`; el bloque `Fondos en paralelas (explosivos)` de la última biserie → `Fondos normales [8-12]`.
- fz-int-b4: `Dominadas explosivas (pasando barbilla) [6-8]` → `Dominadas pronas (agarre estándar) [8-10]`; biseries `[Flexiones en suelo (iso abajo) [8] + Flexiones en pica en suelo [5-8]]` → `[Flexiones en suelo (iso abajo) [8] + Leg raises normales (máx altura) [20s]]`; la superserie de 7 ejercicios → `[Dominadas pronas cerradas [2] + Dominadas supinas normales [2] + Fondos en barra [10-15] + Leg raises completas [6-8]]`.
- fz-int-b6: `Flexiones en suelo (explosivas, iso abajo) [5-8]` → `Flexiones normales (codos pegados) [8-10]`; biseries `[Flexiones diamante [6-10] + Lean planche supina [10s]]` → `[Dominadas supinas (rango parcial) [4-8] + Lean planche supina [10s]]`.
- fz-int-b7: `Aguantes pino en pared [20s]` → biseries `[Aguantes pino en pared [20s] + Dominadas pronas (agarre estándar) [8-10]]`; `Flexiones en suelo (explosivas, iso abajo) [6-10]` → `Flexiones supinas en suelo [10-12]`.
- fz-int-b8: superseries `[Lean planche supina [10s] + Flexiones supina en suelo [6-10] + Lean planche [10s]]` → biseries `[Lean planche supina [10s] + Flexiones en pica (pies elevados) [6-10]]`.

### fuerza-avanzados

- fz-adv-b1: biseries `[Flexiones parciales pino en pared [6-10] + Flexiones normales (codos pegados) [10-15]]` → `[Flexiones parciales pino en pared [6-10] + Dominadas explosivas (pasando barbilla) [4-6]]`.
- fz-adv-b2: superseries `[Flexiones diamante [8-10] + Flexiones normales (manos altura hombros) [8-10] + Flexiones abiertas [8-10]]` → `[Flexiones diamante [8-10] + Dominadas arqueras (banda) [4-6] + Flexiones abiertas [8-10]]`.
- fz-adv-b3: biseries `[Reverse planche lean [10s] + Flexiones normales [10]]` → `[Dominadas pronas (normales) [10-15] + Leg raises completas [6-8]]`.
- fz-adv-b6: superseries `[Curl bíceps en supino [4-6] + Dominadas prona cerrada [5-10] + Dominadas prona normal [5-10]]` → biseries `[Curl bíceps en supino [4-6] + Flexiones en pica 90° [4-8]]`; biseries `[Hefesto asistido (pies en suelo) [8-10] + Lean planche supina [10s]]` → `[Hefesto asistido (pies en suelo) [8-10] + Leg raises completas [6-8]]`.
- fz-adv-b7: biseries `[Flexiones en pica 90° (pies elevados) [4-8] + Lean planche (pies elevados) [10s]]` → bloque simple `Flexiones en pica 90° (pies elevados) [4-8]`; biseries `[Flexiones pino en pared [4-8] + Isométrico pino en pared [15s]]` → bloque simple `Flexiones pino en pared (buscando profundidad) [4-8]`; bloque simple `Flexiones en pica 90° (pies elevados) [4-8]` → biseries `[Flexiones en pica 90° (pies elevados) [4-8] + Dominadas pronas (normales) [10-15]]`; biseries `[Flexiones explosivas (iso abajo) [8-10] + Flexiones normales (codos pegados) [8-10]]` → `[Dominadas al pecho (explosivas) [6-10] + Flexiones normales (codos pegados) [8-10]]`; biseries `[De knee raises a leg raises (subir max) [4-6] + Plank en suelo [20s]]` → `[De knee raises a leg raises (subir max) [4-6] + Dominadas supinas (rango parcial) [4-8]]`.

Sin cambios (ya cumplen S3-S6): fz-int-b1, fz-int-b5, fz-adv-b4, fz-adv-b5, fz-adv-b8.

## Tasks

- T1 [S3..S9] Aplicar la tabla de cambios en `app/src/data/plans.json` con script node (roundtrip `JSON.stringify(data, null, 2) + '\n'`), sin tocar `id` de modelos ni bloques `Desafío`.
- T2 [S10] Nuevo `app/src/data/fuerzaBalance.test.ts` con los invariantes S3-S6 para los 3 programas.
- T3 [S1..S10] Verificación: `npm test`, `npm run lint`, `npm run build`, `npm run test:e2e`.

## Log

- L1: "AJUSTA LAS RUTINAS DE FUERZA PORQUE ESTAN DESBALANCEADAS. REVISA BIEN LOS PLANES."
- L2: Diagnóstico previo al ajuste: 5 rutinas sin tracción (fz-b6, fz-int-b6, fz-int-b7, fz-adv-b3, fz-adv-b7), 2 sin empuje (fz-b3, fz-b8), push-dominadas agudas (fz-b4 1/3, fz-b7 1/5, fz-adv-b1 2/4, fz-adv-b2 1/4), pull-dominada sin empuje (fz-adv-b6 4/1), core ausente en 6 rutinas, explosivos repetidos ×4 en intermedios, superserie de 7 en fz-int-b4, piernas en una sola rutina.
- L3: Decisión del usuario sobre tren inferior: "Tren superior puro" (sin bloques de piernas nuevos).
- L4: Ajuste posterior a la primera pasada: `fz-adv-b7` quedaba con 4 ejercicios de empuje contra 2 de tracción; el hold de pino se retiró de esa rutina y la pica 90 comparte bloque con dominadas pronas (tracción 3 / empuje 3). S4 se endureció a ejercicios.
