# Logstenia UI — mejoras orientadas a producto y usabilidad

## Specs

- S1: Navegación completa y accesible en móvil y desktop (bottom tabs móvil, top nav desktop), incluyendo Hoy, Planes, Métricas, Progreso y Ajustes.
- S2: Eliminar indicadores falsos ("synced") y estados engañosos.
- S3: Jerarquía tipográfica consistente con el design system (clase `metric` para números, `label-caps` para metadatos).
- S4: Pantallas vacías con guía de activación (Home sin entrenamientos, Métricas sin datos, Progreso sin registros).
- S5: Formularios con labels accesibles y controles con touch targets ≥ 44px.
- S6: Tablas/listas responsive en móvil (scroll horizontal con columna pegajosa o cards).
- S7: Copys claros y consistentes (renombrar "Skills" a "Planes", etc.).
- S8: Build, lint y tests siguen pasando.

## Tasks

- T1 [S1] Layout: bottom tabs móvil + nav desktop completa. Route: inline.
- T2 [S2] Layout: quitar "synced" falso. Route: inline.
- T3 [S3,S4] Home: empty state + jerarquía. Route: inline.
- T4 [S7] Planes: renombrar título y ajustar copy. Route: inline.
- T5 [S3,S6] Metrics: jerarquía + responsive. Route: inline.
- T6 [S5,S6] Progress: labels + responsive. Route: inline.
- T7 [S5] Settings: labels + agrupación. Route: inline.
- T8 [S8] Verificación build/lint/test. Route: inline.

## Log

- L1: Solicitud del usuario: mejorar pantallas con criterio orientado al producto y usabilidad usando impeccable.
- L2: Implementado: bottom tabs móvil + nav desktop completa; eliminado 'synced' falso; Home empty state + header; Planes renombrado; Metrics jerarquía; Progress labels + tabla responsive; Settings agrupado; reactivado Toma de marcas; limpieza TagInput. Build/lint/test OK.
- L3: Unificadas Métricas + Progreso + Ajustes en una sola pantalla (Progress.tsx). Eliminadas rutas/páginas Metrics y Settings (redirigen a /progress). Nav reducido a 3 tabs (Hoy, Planes, Progreso). Build/test OK.
