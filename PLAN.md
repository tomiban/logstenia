# Logstenia — Plan de acción

App web (PWA) minimalista para lanzar la rutina de un día asociado a un plan de
calistenia (Pro-gress), con timer interactivo, métricas y videos embebidos.

**Stack**: React + Vite + TypeScript · IndexedDB (Dexie) · PWA · datos JSON estáticos
generados una vez desde los PDFs.

---

## 1. Inventario de contenido (de los PDFs)

| Categoría | Programas / niveles | PDF(s) |
|---|---|---|
| Cardio | en casa, todos los niveles, 5 rutinas | `cardio.pdf` |
| Movilidad & Flex | 8 modelos por grupo muscular | `pdf-calentamiento-movilidad-...` |
| Handstand | movilidad (M1/M2) + refuerzo (R1/R2 × 3 niveles) + balance (3 niveles) + pino por fuerza (nivel 4) | `...handstand-workout-movility-...` |
| Hefesto | principiantes: acondicionamiento + H1/H2/H3 × 3 intensidades | `pdf-entrenamiento-de-hefesto-...` |
| Back Lever Hefesto | Master: N1/N2 × 3 intensidades | `pdf-programa-avanzado-back-lever-hefesto-...` |
| Front Lever | intermedios (intensidad 2/3, R1–R4) y avanzados (R1–R5) | `pdf-rutina-de-front-lever-...`, `Front_Lever-Avanzados-PROGRESS©.pdf` |
| Planche (fuerza) | sin/con equipamiento, intensidad 2/3, R1–R5 + PRO1 | `pdf-rutinas-de-entrenamiento-para-planche.pdf` |
| Planche (resistencia) | PR1–PR3 × 3 niveles | `pdf-rutinas-de-resistencia-planche-...` |
| Fuerza | principiantes (básicos), intermedios (básicos-intermedios), avanzados (básicos-avanzados): 8 modelos B1–B8 | `pdf-rutinas-de-fuerza-para-principiantes-...` |

### Estructura común de una rutina (modelo del día)
- **Modelo** (R1, B3, PR2, H2, …) = la rutina del día.
- **Intensidad** 1/2/3 (carga).
- **Nivel** (principiante/intermedio/avanzado o N1/N2).
- **Bloques**: ejercicio suelto, BISERIE (2 ejercicios encadenados) o SUPERSERIE (3+).
- Por ejercicio: nombre, reps o tiempo (seg), cadencia (CAD 3:1), series (SETS), descanso (DESC).
- **Descansos**: intra-serie (`Rest Xmin` entre ejercicios dentro de una vuelta) e intra-ejercicio (entre series) → el PDF distingue "descanso entre series" y "descanso entre ejercicios".
- **VUELTAS**: número de series/vueltas del bloque (1, 2, 3, 4, 5).
- **Tiempo total** estimado por rutina.
- **Objetivos** del programa + **ejercicio estrella** para trackear (hold max).
- **Tabla de progreso** S1..S8 (semanas) para 1–2 ejercicios.
- **Reglas de conexión**: movilidad antes de fuerza; resistencia alterna con fuerza (48h); no combinar refuerzo handstand con otras rutinas el mismo día; frecuencia 2–3×/sem.

---

## 2. Modelo de datos (JSON)

```ts
type Category = { id: string; name: string; description: string };
type Program = {
  id: string; categoryId: string; name: string;
  level: 'beginner' | 'intermediate' | 'advanced';
  objectives: string[];            // texto del PDF
  goals: Goal[];                  // metas trackeables
  frequency: string;              // "2-3×/sem"
  restBetweenSessions: string;     // "48-72h"
  rules: string[];                // conexiones
  models: Model[];
};
type Model = {
  id: string; name: string;       // "R1"
  intensity: 1 | 2 | 3;
  totalTimeMin: number;
  blocks: Block[];
};
type Block = {
  type: 'single' | 'biseries' | 'superseries';
  sets: number;                   // vueltas
  restBetweenSetsSec: number;      // descanso intra-serie (entre vueltas)
  restBetweenExercisesSec?: number;// descanso intra-ejercicio (dentro del bloque)
  exercises: Exercise[];
};
type Exercise = {
  name: string;
  reps?: string;                  // "8-10" o "max"
  timeSec?: number;               // para holds/tiempo
  cadence?: string;               // "3:1"
  notes?: string;
};
type Goal = {
  id: string; name: string;       // "Hold tuck planche"
  unit: 'sec' | 'reps';
  target: number;                 // 10
};
```

Datos en `src/data/plans.json` (generado por script de parsing, versionado).

Los descansos de la rutina viven en el bloque: `restBetweenSetsSec` (descanso entre series) y
`restBetweenExercisesSec` (descanso entre ejercicios). `app/src/lib/rest.ts` los resuelve y el
runner los informa y los respeta.

---

## 3. Pantallas

1. **Home** — categorías → programas (con % de progreso por programa).
2. **Programa** — objetivos, reglas, niveles/intensidades, lista de modelos.
3. **Rutina (detalle)** — bloques, ejercicios, series, descansos, tiempo total, video por ejercicio (toggle), botón "Iniciar".
4. **Runner (timer)** — full-screen: ejercicio actual, serie X/Y, countdown, controles `+15s / -15s / skip / pausa`, video embebido ocultable.
5. **Métricas** — sesiones completadas, streak, tiempo total, volumen, holds por ejercicio (línea por semanas), metas con barra de progreso.
6. **Progreso semanal** — tabla S1..S8 por ejercicio estrella, input de valor.
7. **Ajustes** — sonido/vibración, duración ±default, tema.

---

## 4. Timer interactivo

Estados: `idle → countdown(3) → work → rest → (siguiente ejercicio o serie) → done`.

- Ejercicios por tiempo: countdown automático del tiempo del ejercicio.
- Ejercicios por reps: pantalla "completado" manual (botón).
- Descansos: salen de la configuración de la rutina, no se editan en el runner. El runner
  informa el descanso de cada serie y el descanso al finalizar el ejercicio.
- El timer de descanso solo permite agregar (`+10s`), quitar (`-10s`) u omitir (`saltar
  descanso`) sobre la duración configurada.
- Biseries/superseries: ejecutar los ejercicios del bloque en secuencia con descanso intra-ejercicio (si aplica), luego descanso intra-serie entre vueltas.
- Al finalizar: guardar `Session` (fecha, plan, modelo, duración real, completado).
- Sonido/vibración al terminar descanso (configurable).

---

## 5. Videos

- Iframe de YouTube con búsqueda por nombre de ejercicio:
  `https://www.youtube.com/embed?listType=search&list=<query>+calistenia`
- Botón "ocultar/mostrar" por ejercicio y global en el runner.
- Sin backend ni API key.

---

## 6. Persistencia (IndexedDB / Dexie)

Tablas:
- `sessions`: id, date, planId, modelId, durationSec, completed
- `progress`: exerciseId, week (S1..S8), value, date
- `goals`: goalId, current, updatedAt
- `settings`: key/value

---

## 7. Reglas de conexión (sugerencias en UI)

- Mostrar "recomendado antes: Movilidad (modelo X)".
- Alerta si se intenta hacer resistencia planche < 48h después de fuerza planche.
- Alerta si se combina refuerzo handstand con otra rutina el mismo día.
- Frecuencia semanal sugerida por programa.

---

## 8. Plan de acción por fases

- **F0 — Setup**: repo, Vite+React+TS, ESLint, PWA base, tema oscuro minimalista.
- **F1 — Datos**: script de parsing PDF→JSON (pdftotext + regex), validar muestra, `plans.json`.
- **F2 — Navegación y listado**: Home, Programa, Rutina (detalle) sin timer.
- **F3 — Runner/timer**: estados, controles, persistencia de sesión.
- **F4 — Videos**: iframe + toggle.
- **F5 — Persistencia y métricas**: Dexie, dashboard, gráficos (recharts o SVG).
- **F6 — Progreso semanal + metas**: tabla S1..S8, metas con barra.
- **F7 — Reglas de conexión**: sugerencias y alertas.
- **F8 — PWA**: offline, install, polish, accesibilidad.
- **F9 — Tests + docs**: tests del timer y del parser, README.

### Estimación
~8–12 sesiones de trabajo. Empezar por F0–F2 (MVP navegable), luego F3 (core).

---

## 9. Decisiones cerradas (respuestas del usuario)

1. **Tema**: light por defecto (no oscuro). Toggle oscuro opcional en Ajustes.
2. **Sonido al terminar descanso**: on por defecto, configurable. Sonido = `https://www.myinstants.com/en/instant/pokemon-item-found-50824/` (descargar y empaquetar como asset local en `/public/sounds/` para no depender de la red ni de CORS).
3. **Backup JSON**: despriorizado (fuera del MVP; queda para v2).
4. **Usuario**: uno solo, sin login, datos locales.
5. **Idioma**: español (consistente con los PDFs).

---

## 10. Decisiones tomadas (grill)

- Plataforma: Web PWA.
- Stack: React + Vite + TypeScript.
- Persistencia: IndexedDB (Dexie).
- Datos: parseo único PDF→JSON.
- Videos: iframe YouTube con búsqueda + toggle ocultar.
- Timer: countdown automático + `+15s/-15s/skip/pausa`.
- Niveles/intensidades seleccionables antes de arrancar.
- Biseries/superseries como bloque (descanso al final del bloque).
- Métricas: sesiones, streak, tiempo total, volumen, holds por semana, metas.
- Progreso semanal S1..S8 por ejercicio estrella.
- Nombre: **Logstenia**.
- Tema: light por defecto.
- Sonido: pokemon item found (asset local).
- Backup JSON: fuera del MVP.