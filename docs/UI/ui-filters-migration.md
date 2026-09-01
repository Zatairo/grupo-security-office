---
tags: [ui, filters, grupo-security, kilo]
updated: 2026-09-01
---

# Migración de Filtros UI — Documentación para Kilo

## Fecha
2026-09-01

## Propósito

Este documento registra los cambios visuales y de interacción realizados en la migración de filtros al sistema `sidebarSections`. Está dirigido al agente `ui.orchestrator` de Kilo para mantener la consistencia visual y documentar los patrones de UI implementados.

---

## Componentes UI afectados

| Componente | Archivo | Cambio |
|------------|---------|--------|
| `SearchFilterBar` | `src/frontend/src/components/filters/SearchFilterBar.tsx` | Nueva prop `sidebarSections`, layout de dos columnas |
| `Sidebar` | Interno de `SearchFilterBar` | Panel lateral fijo de 288px |
| `Drawer` | Interno de `SearchFilterBar` | Panel lateral en mobile con overlay |

---

## Layout en Desktop

### Estructura visual
┌─────────────────────────────────────────────────────────────────┐
│ [Buscador] [Botón Filtros] │
│ [Chips activos] │
│ ┌──────────────┬────────────────────────────────────────────┐ │
│ │ Sidebar │ Content (resultados) │ │
│ │ 288px │ │ │
│ │ │ │ │
│ │ ════════════ │ ┌─────────────────────────────────────┐ │ │
│ │ ▼ Categorías │ │ Tabla/Grid de productos │ │ │
│ │ ☑ Cámara │ │ │ │ │
│ │ ☑ DVR │ │ Producto 1 │ $100 │ Categoría A │ │ │
│ │ ☐ NVR │ │ Producto 2 │ $200 │ Categoría B │ │ │
│ │ ──────────── │ │ │ │ │
│ │ ▶ Marcas │ └─────────────────────────────────────┘ │ │
│ │ ──────────── │ │ │
│ │ ▶ Estado │ [Paginación] │ │
│ └──────────────┴────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘

### Especificaciones

| Elemento | Especificación |
|----------|---------------|
| **Sidebar ancho** | `288px` (fijo) |
| **Sidebar posición** | `sticky top-4` |
| **Sidebar altura** | `max-h-[calc(100vh-2rem)]` con scroll propio |
| **Fondo sidebar** | `bg-white` con borde `border-neutral-200` |
| **Sombra** | `shadow-sm` |
| **Border radius** | `rounded-xl` |
| **Gap entre columnas** | `gap-6` |

### Header del sidebar

```tsx
<header className="flex items-center justify-between gap-3 border-b border-neutral-200 px-5 py-4">
  <div>
    <h2 className="text-base font-semibold text-neutral-800">Filtros</h2>
    <p className="mt-0.5 text-xs text-neutral-500">
      {activeFilterCount > 0
        ? `${activeFilterCount} filtro(s) activo(s)`
        : 'Refina los resultados sin salir del catálogo'}
    </p>
  </div>
  <button>Limpiar</button>
</header>
Acordeones
<div className="divide-y divide-neutral-200">
  <!-- Cada sección -->
  <div>
    <button
      aria-expanded={isExpanded}
      aria-controls={contentId}
      className="flex w-full items-center justify-between gap-2 py-3 text-left text-sm font-medium text-neutral-800"
    >
      <span>{label}</span>
      <svg className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
        <path d="m19 9-7 7-7-7" />
      </svg>
    </button>
    {isExpanded && (
      <div id={contentId} className="pb-4">
        {content}
      </div>
    )}
  </div>
</div>

Elemento	Especificación
Separador	divide-y divide-neutral-200
Padding vertical	py-3 en botón, pb-4 en contenido
Chevron	SVG inline, rota 180° al abrir
Fuente	text-sm font-medium
Color	text-neutral-800
Hover	hover:bg-neutral-50


Estados de los acordeones

Sección	Estado inicial
Categorías	✅ Expandido
Marcas	❌ Contraído
Estado	❌ Contraído


Layout en Mobile / Tablet (< 1024px)

Estructura visual
┌─────────────────────────────────────────────────────────────────┐
│  [Buscador]                              [Botón Filtros]      │
│  [Chips activos]                                              │
│                                                                 │
│  Content (resultados)                                          │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Tabla/Grid de productos                                    ││
│  │                                                             ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  ═══════════════════════════════════════════════════════════════ │
│                                                                 │
│  [OVERLAY OSCURO]                    ┌─────────────────────────┐│
│                                      │ [Filtros]       [X]    ││
│                                      │                         ││
│                                      │ ▼ Categorías           ││
│                                      │   ☑ Cámara             ││
│                                      │   ☑ DVR                ││
│                                      │ ▶ Marcas               ││
│                                      │ ▶ Estado               ││
│                                      │                         ││
│                                      │ [Limpiar]              ││
│                                      └─────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘

Especificaciones
Elemento	Especificación
Drawer ancho	max-w-sm (full en mobile, sm:w-[24rem] en tablet)
Drawer posición	fixed inset-y-0 right-0
Overlay	fixed inset-0 bg-black/30 z-40
Drawer z-index	z-50
Fondo drawer	bg-white
Borde	border-l border-neutral-200
Sombra	shadow-2xl
Comportamiento
Acción	Comportamiento
Clic en overlay	Cierra el drawer
Presionar Escape	Cierra el drawer
Clic en X	Cierra el drawer
Clic exterior	Cierra el drawer
Abrir drawer	El contenido de resultados NO se desplaza
Botón Filtros
Elemento	Especificación
Texto	Filtros o Filtros (N) con contador
Icono	SVG de filtros
ARIA	aria-expanded, aria-controls, aria-haspopup

<Button
  type="button"
  variant="secondary"
  icon={<FilterIcon />}
  aria-expanded={isOpen}
  aria-controls={isOpen ? panelId : undefined}
  aria-haspopup={isSidebar ? 'menu' : 'dialog'}
  onClick={() => setIsOpen(!isOpen)}
>
  {activeFilterCount > 0 ? `Filtros (${activeFilterCount})` : 'Filtros'}
</Button>

Chips de filtros activos
Especificaciones
Elemento	Especificación
Fondo	bg-[var(--color-primary-bg-subtle)]
Borde	border border-[var(--color-primary)]/20
Color texto	var(--color-primary)
Padding	px-2.5 py-1
Tamaño fuente	text-xs font-medium
Border radius	rounded-full
Botón quitar	rounded-sm p-0.5 con hover bg-[var(--color-primary)]/10
tsx
<span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-primary)]/20 bg-[var(--color-primary-bg-subtle)] px-2.5 py-1 text-xs font-medium text-[var(--color-primary)]">
  <span>{chip.label}</span>
  <button onClick={chip.onRemove}>
    <CloseIcon />
  </button>
</span>
Páginas con nuevo layout
Página	Sidebar secciones	Estado
ProductsPage	Categorías, Marcas, Estado	✅
ListasPage	Estado, Vigencia, Filtros adicionales	✅
AssignmentsPage	Estado	✅
AuditPage	Entidad, Acción	✅
PurchaseOrdersPage	Estado	✅
SuppliersPage	Estado	✅
Guías de implementación para nuevos componentes UI
1. Cómo agregar un nuevo filtro en una página
tsx
<SearchFilterBar
  layout="sidebar"
  sidebarSections={[
    {
      id: 'categories',
      label: 'Mi Sección',
      content: (
        <div className="space-y-2">
          {/* contenido del filtro */}
        </div>
      ),
    },
  ]}
  content={
    <>{/* resultados */}</>
  }
/>
2. Cómo usar layout="overlay" (modo legacy)
Para páginas que no usan el sidebar fijo:

tsx
<SearchFilterBar
  layout="overlay"
  // sin sidebarSections
>
  {/* contenido del panel flotante */}
</SearchFilterBar>
3. Accesibilidad mínima
Usar fieldset y legend para grupos de filtros

Usar label con htmlFor para cada input

Usar aria-expanded en botones de acordeón

Usar aria-controls apuntando al contenido

Usar role="dialog" y aria-modal="true" en el drawer mobile

Verificación visual
Checklist de QA visual
□ Desktop: Sidebar de 288px visible a la izquierda
□ Desktop: Contenido de resultados a la derecha
□ Desktop: Acordeones funcionan (expandir/contraer)
□ Desktop: Categorías inicia expandida
□ Desktop: Marcas y Estado inician contraídos
□ Desktop: Botón Filtros oculta/muestra el sidebar
□ Desktop: Al ocultar sidebar, contenido ocupa todo el ancho
□ Mobile: Drawer se abre desde la derecha
□ Mobile: Overlay oscuro visible
□ Mobile: Escape cierra el drawer
□ Mobile: Clic en overlay cierra el drawer
□ Mobile: Botón X cierra el drawer
□ Mobile: El contenido de resultados NO se desplaza al abrir drawer
□ Chips: Se muestran correctamente con botón de quitar
□ Chips: Se eliminan al hacer clic en X
□ Contador: Muestra el número correcto de filtros activos
□ Botón Limpiar: Deshabilitado cuando no hay filtros activos
Comandos útiles para Kilo
bash
# Verificar que el build del frontend compila
cd src/frontend
npm run build

# Verificar TypeScript sin compilar
npx tsc --noEmit

# Verificar lint
npm run lint
Historial de actualizaciones
Fecha	Cambio	Responsable
2026-09-01	Creación del documento	Tech Lead Orchestrator