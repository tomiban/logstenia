# UI Plan — Logstenia

## Dirección (decisiones del usuario)
- Uso: entrenar + seguimiento.
- Estilo: minimal limpio, mucho espacio, tipografía neutra.
- Prioridad dashboard: métricas de skills + acceso rápido a planes.
- Navegación: bottom tabs en móvil (top en desktop).

## Principios
- Mobile-first, touch targets ≥ 44px.
- Una sola acción principal por pantalla.
- Jerarquía: título → métrica → detalle.
- Espaciado consistente (8/12/16/24).
- Color: un acento (indigo), neutros slate, semánticos (success/danger).

## Pantallas

### 1. Dashboard (Home)
- Header: saludo + fecha.
- Sección Skills (prioridad): grid de cards con nombre, sesiones, barra de progreso, último entreno.
- Acceso rápido: grid de planes (card con nombre, categoría, modelos, badge opcional).
- Calendario compacto: mes actual, días entrenados resaltados, tooltip.
- Stats secundarios: sesiones, minutos, racha (fila compacta).

### 2. Programa
- Header con nombre + badge opcional.
- Objetivos y reglas (colapsables).
- Lista de modelos por intensidad (cards).
- CTA "Iniciar" claro.

### 3. Rutina (detalle)
- Bloques como cards con tipo, sets, descanso.
- Ejercicios con nombre, reps/tiempo, cadencia.
- Video toggle por ejercicio.
- CTA iniciar.

### 4. Runner (timer)
- Full-screen, ejercicio actual grande.
- Timer enorme, progress step.
- Controles agrupados (pausa, ±15s, saltar, completado).
- Video colapsable.

### 5. Métricas
- Stats cards.
- Metas con barra de progreso.
- Sesiones por plan.
- Progreso registrado.

### 6. Progreso semanal
- Tabla S1..S8 por ejercicio.
- Formulario compacto.

### 7. Ajustes
- Secciones agrupadas: Sonido, Tema, Datos (backup/import).

## Componentes (shadcn)
- Button, Card, Badge, Input, Progress, Select (instalar).
- Layout: bottom tabs móvil, top nav desktop.

## Próximo paso
Implementar rediseño por pantalla empezando por Dashboard + Layout.