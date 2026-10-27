# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

React + Vite + TypeScript · Tailwind CSS 4 · Dexie (IndexedDB) · vite-plugin-pwa ·
datos estáticos en `app/src/data/plans.json`. UI en español. Diseño: The Timing Board
(documentado en `DESIGN.md`).

## Users

Uso personal de un solo atleta. Entrena calistenia con los programas que venían en 7 PDFs y
usa la app *durante* la sesión, en el gimnasio, desde el celular, a menudo con una sola mano y
con interrupciones. Trabajo a resolver: registrar la sesión de hoy y ver cómo evoluciona su
progreso en el tiempo.

## Product Purpose

Un logbook personal de calistenia. Convierte los 7 programas (originalmente PDFs) en datos y
permite registrar cada sesión —serie por serie— para ver la progresión y avanzar de
progresión. Existe porque el plan venía en PDF y el progreso se perdía. Éxito = mejorar las
marcas (segundos en isométricos, reps en básicos) y saltar al siguiente nivel de dificultad.

**Implementado hoy (MVP):** navegación categorías → programas → modelos (rutina del día);
detalle de rutina con bloques, ejercicios, descansos, tiempo total y video por ejercicio con
toggle; runner con timer (countdown automático para isométricos, confirmación manual para
reps, controles +15s/-15s/skip/pausa); persistencia de sesión en IndexedDB; métricas
(sesiones, racha, tiempo total, sesiones por plan); progreso semanal S1..S8 por ejercicio;
ajustes (sonido, tema, backup JSON); PWA offline instalable. Progresión encadenada solo para
planche (`lib/progression.ts`).

**En progreso / futuro (no implementado aún):** mesociclo (4 semanas: 3 carga + 1 descarga)
con fecha de inicio; bloque "Marcas del mesociclo" en Hoy con input por ejercicio y log con
`sesion_id = 'marcas'`; chequeo previo por sesión (energía / fatiga / molestias); cadenas de
progresión para front lever, plancha, handstand, dominadas, fondos y flexiones; comparación
de marcas contra el mesociclo anterior; selector de "qué entrenar hoy" por énfasis e
intensidad; login por token y sync con backend.

## Positioning

No es un tracker genérico. Trae los 7 programas ya cargados como datos (programas → sesiones →
bloques → prescripciones), registra por serie y clasifica cada ejercicio en **skill** o
**básico**. Corre offline, sin login, con un solo usuario.

## Operating Context

- Se usa *durante* el entrenamiento: registro guiado de a un ejercicio, cronómetro para
  isométricos, descanso con aviso sonoro + vibración, y (futuro) chequeo previo.
- Los programas son 7 PDFs de terceros; su texto se extrae una vez a CSV/JSON y el front los
  lee bundleados.
- La planificación aspira a ser a nivel **mesociclo**: 4 semanas, 3 de carga + 1 de descarga
  (no implementado aún).
- La decisión recurrente es "¿qué entrenar hoy?", por **énfasis** (empuje / tirón / mixto /
  pierna) e **intensidad** (parcialmente: intensidad sí, énfasis no).
- Fuera de alcance hoy: IA, sincronización, login, multiusuario.

## Capabilities and Constraints

Confirmado (implementado):
- Navegar categorías → programas → intensidades → modelos (rutina del día).
- Detalle de rutina con bloques (single/biseries/superseries), ejercicios (reps o tiempo,
  cadencia, sets, descanso), tiempo total y video por ejercicio con toggle.
- Runner full-screen con estados `idle → countdown(3) → work → rest → done`, controles
  +15s/-15s/skip/pausa; isométricos con countdown automático, por reps confirmación manual.
- Persistencia de sesión (fecha, plan, modelo, duración, completado) en IndexedDB.
- Métricas: sesiones completadas, racha, tiempo total, sesiones por plan.
- Progreso semanal S1..S8 por ejercicio con input de valor.
- Ajustes: sonido, tema claro/oscuro, backup/importación JSON.
- PWA instalable y offline (cache local).
- Progresión encadenada para planche (fase X de Y en pantalla de programa).
- Datos de planes en `app/src/data/plans.json` generados desde los PDFs.

No decidido / no confirmado / futuro:
- Derechos de redistribución de los programas originales (planteado, **no confirmado** por el
  usuario): no asumir permiso ni prohibición.
- Normalización de los nombres de ejercicios al catálogo (pendiente; hoy la clave es el nombre
  crudo del PDF, así que el mismo ejercicio con otra nota cuenta como dos).
- Login por token y sync con backend (Clean Architecture, endpoints GetState/PushState): no
  implementado; la app es offline-only hoy.
- Mesociclo, marcas por mesociclo, chequeo previo, cadenas de skill (salvo planche),
  comparación contra mesociclo anterior, selector por énfasis: no implementado.
- Curación del resto de programas (handstand, hefesto, front lever, planche, fuerza):
  parcial; varios siguen como placeholder.

## Brand Commitments

- Nombre en la interfaz: **Logtenia**.
- Sistema visual comprometido por el usuario: **The Timing Board** (Swiss style) sobre
  shadcn/ui — se detalla en `DESIGN.md`, no se expande acá.

## Product Principles

1. **La progresión es el producto.** Toda pantalla debe dejar ver la marca y el avance; los
   números son la recompensa.
2. **Se usa en el gym, con una mano.** Registrar debe costar lo mínimo: un ejercicio por vez,
   sin scroll infinito.
3. **Local y offline por defecto.** Nada depende de la red ni de un servidor.
4. **Comparar contra uno mismo.** Las marcas se contrastan contra la sesión anterior, no contra
   un ideal abstracto.
5. **Un solo usuario.** No agregar cuentas, sync ni multiusuario sin pedido explícito.

## Evidence on Hand

- `app/public/rutinas.json` y `rutinas/db/*.csv`: 7 programas, 40 sesiones, 96 bloques,
  265 prescripciones, extraídas de los PDFs.
- `catalogo_ejercicios.csv` / `.json` (226 ejercicios) como fuente de clasificación y
  `anclas.csv`.
- 7 PDFs originales en la raíz del proyecto.
- Sistema de diseño implementado en `DESIGN.md` + `app/src/index.css` (tokens).
- **No** hay usuarios reales, testimonios ni datos de producción: es uso personal de un solo
  usuario. No fabricar métricas sociales ni prueba social.