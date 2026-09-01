---
tags: [decision, adr, grupo-security, filters]
date: 2026-09-01
estado: completado
---

# ADR: Migración de Filtros a SidebarSections

## Fecha
2026-09-01

## Contexto

El sistema de filtros del panel administrativo de Grupo Security utilizaba `children` en el componente `SearchFilterBar` para renderizar los filtros en un panel flotante. Esto generaba varios problemas:

1. **Inconsistencia visual:** En desktop, los filtros aparecían como un panel flotante que se superponía al contenido, en lugar de estar integrado en el layout.

2. **UX deficiente:** Los usuarios debían abrir/cerrar el panel de filtros constantemente, lo que interrumpía el flujo de trabajo.

3. **Falta de estructura:** Los filtros se renderizaban como una lista plana sin organización jerárquica ni acordeones.

4. **Mantenibilidad:** Cada página definía sus propios filtros dentro de `children`, sin un contrato claro entre el componente y la página.

## Decisión

**Migrar todas las páginas con filtros al nuevo sistema `sidebarSections` con `layout="sidebar"`.**

El nuevo sistema consiste en:

- Un panel lateral fijo de **288px** en desktop
- Tres secciones en acordeón: **Categorías**, **Marcas** y **Estado**
- `Categorías` inicia expandida por defecto
- `Marcas` y `Estado` inician contraídos
- En mobile: drawer desde la derecha con overlay
- El botón `Filtros` oculta/muestra el sidebar sin perder el estado de los filtros

## Alternativas consideradas

| Alternativa | Veredicto | Razón |
|-------------|-----------|-------|
| **Mantener el sistema actual** | ❌ Rechazado | Problemas de UX documentados |
| **Crear componente de filtros separado por página** | ❌ Rechazado | Duplicación de código y mantenibilidad baja |
| **Usar `sidebarSections` con layout sidebar** | ✅ **Seleccionado** | Consistente, mantenible y mejor UX |

## Implementación

### Cambios en `SearchFilterBar.tsx`

1. **Nuevo tipo `SidebarFilterSection`:**

```typescript
export type SidebarFilterSection = {
  id: 'categories' | 'brands' | 'lifecycle'
  label: string
  content: ReactNode
}