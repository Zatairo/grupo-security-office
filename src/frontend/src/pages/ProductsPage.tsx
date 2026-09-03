import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { LifecycleEvent, LifecycleStatus, Product } from '../features/products/types/product.types'
import {
  LIFECYCLE_STATUS_LABEL,
  productAllowedActions,
} from '../features/products/lib/lifecycle'
import { useProducts } from '../features/products/hooks/useProducts'
import { useProductMutations } from '../features/products/hooks/useProductMutations'
import { useTransitionProduct } from '../features/products/hooks/useProductTransition'
import { useAccessMatrix } from '../features/products/hooks/useAccessMatrix'
import { useBulkTransition } from '../features/products/hooks/useProductTransition'
import { ProductCard } from '../features/products/components/ProductCard'
import { ProductTableRow } from '../features/products/components/ProductTableRow'
import ProductFormModal from '../features/products/components/ProductFormModal'
import { MoveCategoryModal, type MoveCategoryTarget } from '../features/products/components/MoveCategoryModal'
import { BulkPriceUpdateModal } from '../features/products/components/BulkPriceUpdateModal'
import { ProductAccessModal } from '../features/products/components/ProductAccessModal'
import { ProductPagination } from '../components/ProductPagination'
import { fetchListas, type Lista } from '../services/listas.service'
import type { BulkTransitionPayload } from '../services/product-detail.service'
import { hasPermission, hasRole, canManageListas } from '../lib/rbac'
import { ROLES } from '../lib/roles'
import { getApiErrorMessage } from '../lib/apiError'
import { Button } from '../components/ui'
import { SearchFilterBar, type SearchFilterChip } from '../components/filters/SearchFilterBar'
import { useAuthStore } from '../stores/auth.store'
import { BulkDeleteModal } from '../features/products/components/BulkDeleteModal'
import { useToast } from '../hooks/useToast'

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100]
const DEFAULT_PAGE_SIZE = 20

/** Acciones bulk → evento FSM canónico (Etapa 5). */
type BulkEventKind = 'archive' | 'restore' | 'publish' | 'unpublish'

const KIND_TO_EVENT: Record<BulkEventKind, LifecycleEvent> = {
  archive: 'ARCHIVE',
  restore: 'RESTORE',
  publish: 'PUBLISH',
  unpublish: 'UNPUBLISH',
}

const BULK_LABELS: Record<BulkEventKind, string> = {
  archive: 'Archivar',
  restore: 'Restaurar',
  publish: 'Publicar',
  unpublish: 'Despublicar',
}

const LIFECYCLE_FILTER_OPTIONS: LifecycleStatus[] = [
  'DRAFT',
  'PUBLISHED',
  'ARCHIVED',
]

export default function ProductsPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list')
  const [showListaSelector, setShowListaSelector] = useState(false)
  const [createListaId, setCreateListaId] = useState('')
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(() => new Set())
  const [bulkNotice, setBulkNotice] = useState<string | null>(null)
  const [bulkError, setBulkError] = useState<string | null>(null)
  const [bulkModal, setBulkModal] = useState<{ kind: BulkEventKind } | null>(null)
  const [moveCategoryTarget, setMoveCategoryTarget] = useState<MoveCategoryTarget | null>(null)
  const [accessProduct, setAccessProduct] = useState<Product | null>(null)
  const [showBulkPrices, setShowBulkPrices] = useState(false)
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false)

  // Batch filters state
  const [filterChips, setFilterChips] = useState({
    categoryIds: [] as string[],
    brandIds: [] as string[],
    lifecycleStatuses: [] as string[],
  })

  const listasQuery = useQuery({
    queryKey: ['listas'],
    queryFn: fetchListas,
  })
  const listas = listasQuery.data ?? []
  const availableListas = listas.filter((l) => l.isActive && !l.archivedAt)

  const filters = {
    search,
    categoryIds: filterChips.categoryIds,
    brandIds: filterChips.brandIds,
    lifecycleStatuses: filterChips.lifecycleStatuses,
  }

  const { products, categories, brands, total, isLoading } = useProducts({
    filters,
    page,
    pageSize,
  })
  const { deleteProductWithMasterKey } = useProductMutations()
  const transitionProduct = useTransitionProduct()
  const bulkTransition = useBulkTransition()
  const currentUser = useAuthStore((s) => s.user)
  const userRoles = currentUser?.roles ?? []

  const { showToast } = useToast()

  const canBulkDelete = hasPermission('products:delete')
  const canBulkManage = canBulkDelete || hasPermission('products:write')
  const isCatalogManager = hasRole(ROLES.SUPER_ADMIN) || hasRole(ROLES.ADMIN_COMERCIAL)
  const { restrictedIds: accessRestrictedIds, unavailable: accessUnavailable } = useAccessMatrix(
    'PRODUCT',
    !isLoading
  )

  // Filtro de estado FSM (provisional, cliente): el backend aún no soporta
  // `?status=` en el query DTO. Se aplica sobre los productos ya cargados.
  // Obtener IDs de listas activas
  const listasData = listasQuery.data ?? []
  const activeListaIds = listasData
    .filter((l) => l.isActive && !l.archivedAt)
    .map((l) => l.id)

  // Filtrar productos: solo mostrar los que pertenecen a una lista activa
  const currentProducts = (products ?? []).filter(
    (p) => !!p.listaId && activeListaIds.includes(p.listaId),
  )
  const allPageSelected = currentProducts.length > 0 && currentProducts.every((p) => selectedProductIds.has(p.id))

  const toggleSelectProduct = (id: string) => {
    setSelectedProductIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAllPage = () => {
    setSelectedProductIds((prev) => {
      const next = new Set(prev)
      if (allPageSelected) {
        currentProducts.forEach((p) => next.delete(p.id))
      } else {
        currentProducts.forEach((p) => next.add(p.id))
      }
      return next
    })
  }

  const bulkDeleteProducts = () => {
    const count = selectedProductIds.size
    if (count === 0) return
    const productsToDelete = Array.from(selectedProductIds).map((id) => currentProducts.find((p) => p.id === id)).filter(Boolean) as Product[]
    if (productsToDelete.length === 0) return
    setShowBulkDeleteModal(true)
  }

  const handleBulkDeleteConfirm = () => {
    // El modal ya maneja la eliminación interna (executeDelete / handleRetryWithClave / handleRetryWithMasterKey).
    // NO cerrar modal aquí: el modal se cierra solo tras 2s en finish().
    // Solo reseteamos el estado local del padre.
    setBulkNotice(null)
    setBulkError(null)
    setSelectedProductIds(new Set())
    queryClient.invalidateQueries({ queryKey: ['products'], refetchType: 'all' })
  }

  /** Ejecuta una transición FSM en lote vía POST /api/products/bulk-transition. */
  const submitBulk = (payload: BulkTransitionPayload, actionLabel: string) => {
    setBulkNotice(null)
    setBulkError(null)
    bulkTransition.mutate(payload, {
      onSuccess: (result) => {
        const applied = result.applied.length
        const rejected = result.rejected
        setBulkNotice(
          rejected.length === 0
            ? `${applied} de ${payload.ids.length} producto(s) procesado(s) (${actionLabel}).`
            : `${applied} de ${payload.ids.length} producto(s) procesado(s) (${actionLabel}); ${rejected.length} rechazado(s).`
        )
        if (rejected.length > 0) {
          setBulkError(
            rejected
              .slice(0, 6)
              .map((r) => `${r.id}: ${r.reason}`)
              .join(' • ')
          )
        }
        setSelectedProductIds(new Set())
        setBulkModal(null)
        setPage(1)
        queryClient.invalidateQueries({ queryKey: ['products'], refetchType: 'all' })
      },
      onError: (err) => {
        setBulkError(getApiErrorMessage(err, 'No se pudo completar la acción masiva.'))
      },
    })
  }

  const runBulkTransition = (kind: BulkEventKind, reason?: string) => {
    const ids = Array.from(selectedProductIds)
    if (ids.length === 0) return
    const event = KIND_TO_EVENT[kind]
    submitBulk(
      {
        ids,
        event,
        ...(reason ? { reason } : {}),
        ...(event === 'ARCHIVE' || event === 'RESTORE' ? { confirm: true } : {}),
      },
      BULK_LABELS[kind]
    )
  }

  const handleBulkClick = (kind: BulkEventKind) => {
    const event = KIND_TO_EVENT[kind]
    if (event === 'ARCHIVE' || event === 'RESTORE') {
      setBulkModal({ kind })
      return
    }
    // PUBLISH y UNPUBLISH se ejecutan directamente; ARCHIVE/RESTORE abren
    // modal de motivo y confirmación.
    runBulkTransition(kind)
  }

  useEffect(() => {
    setPage(1)
    setSelectedProductIds(new Set())
  }, [search, filterChips])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const productsFilterCount =
    filterChips.categoryIds.length +
    filterChips.brandIds.length +
    filterChips.lifecycleStatuses.length

  const clearProductFilters = () => {
    setFilterChips({ categoryIds: [], brandIds: [], lifecycleStatuses: [] })
    setPage(1)
    setSelectedProductIds(new Set())
  }

  const productFilterChips: SearchFilterChip[] = [
    ...filterChips.categoryIds.map((id) => {
      const cat = categories.find((c) => c.id === id)
      return {
        id: `cat-${id}`,
        label: `Categoría: ${cat?.name ?? id}`,
        onRemove: () => {
          setFilterChips((prev) => ({ ...prev, categoryIds: prev.categoryIds.filter((c) => c !== id) }))
          setPage(1)
          setSelectedProductIds(new Set())
        },
      }
    }),
    ...filterChips.brandIds.map((id) => {
      const brand = brands.find((b) => b.id === id)
      return {
        id: `brand-${id}`,
        label: `Marca: ${brand?.name ?? id}`,
        onRemove: () => {
          setFilterChips((prev) => ({ ...prev, brandIds: prev.brandIds.filter((b) => b !== id) }))
          setPage(1)
          setSelectedProductIds(new Set())
        },
      }
    }),
    ...filterChips.lifecycleStatuses.map((status) => ({
      id: `lifecycle-${status}`,
      label: `Estado: ${LIFECYCLE_STATUS_LABEL[status as LifecycleStatus]}`,
      onRemove: () => {
        setFilterChips((prev) => ({ ...prev, lifecycleStatuses: prev.lifecycleStatuses.filter((s) => s !== status) }))
        setPage(1)
        setSelectedProductIds(new Set())
      },
    })),
  ]

  const selectedProducts = currentProducts.filter((p) => selectedProductIds.has(p.id))
  const selectedCan = (event: LifecycleEvent) =>
    selectedProducts.some((p) => productAllowedActions(p, userRoles).includes(event))
  const bulkAvailability: Record<BulkEventKind, boolean> = {
    archive: selectedCan('ARCHIVE'),
    restore: selectedCan('RESTORE'),
    publish: selectedCan('PUBLISH'),
    unpublish: selectedCan('UNPUBLISH'),
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-condensed font-bold text-security-800">Productos</h1>
          <p className="text-sm text-neutral-500 mt-1">Gestiona tu catálogo de productos</p>
        </div>
        <div className="flex flex-wrap gap-2 max-w-full">
          {hasPermission('products:write') && (
            <Button
              variant="primary"
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              }
              onClick={() => {
                if (availableListas.length === 0) {
                  showToast('No hay listas activas. Crea una lista primero.', 'warning')
                  return
                }
                setShowListaSelector(true)
              }}
            >
              Nuevo Producto
            </Button>
          )}
        </div>
      </div>

      {/* Search and filters */}
      <SearchFilterBar
        search={{
          value: search,
          onChange: setSearch,
          placeholder: 'Buscar por nombre, SKU o descripción...',
          ariaLabel: 'Buscar productos',
        }}
        activeFilterCount={productsFilterCount}
        activeFilterChips={productFilterChips}
        onClearFilters={clearProductFilters}
        clearFiltersDisabled={productsFilterCount === 0}
        layout="sidebar"
        sidebarSections={[
          {
            id: 'categories',
            label: 'Categorías',
            content: (
              <div className="space-y-2 max-h-56 overflow-y-auto">
                {(categories ?? []).map((cat) => (
                  <label key={cat.id} htmlFor={`prod-cat-${cat.id}`} className="flex items-center gap-2 text-sm text-neutral-700 cursor-pointer">
                    <input
                      id={`prod-cat-${cat.id}`}
                      type="checkbox"
                      checked={filterChips.categoryIds.includes(cat.id)}
                      onChange={(e) => {
                        setFilterChips((prev) => ({
                          ...prev,
                          categoryIds: e.target.checked
                            ? [...prev.categoryIds, cat.id]
                            : prev.categoryIds.filter((c) => c !== cat.id),
                        }))
                      }}
                      className="h-4 w-4 accent-[var(--color-primary)] focus:ring-2 focus:ring-brand-primary/30 cursor-pointer"
                    />
                    {cat.name}
                  </label>
                ))}
              </div>
            ),
          },
          {
            id: 'brands',
            label: 'Marcas',
            content: (
              <div className="space-y-2 max-h-56 overflow-y-auto">
                {(brands ?? []).map((brand) => (
                  <label key={brand.id} htmlFor={`prod-brand-${brand.id}`} className="flex items-center gap-2 text-sm text-neutral-700 cursor-pointer">
                    <input
                      id={`prod-brand-${brand.id}`}
                      type="checkbox"
                      checked={filterChips.brandIds.includes(brand.id)}
                      onChange={(e) => {
                        setFilterChips((prev) => ({
                          ...prev,
                          brandIds: e.target.checked
                            ? [...prev.brandIds, brand.id]
                            : prev.brandIds.filter((b) => b !== brand.id),
                        }))
                      }}
                      className="h-4 w-4 accent-[var(--color-primary)] focus:ring-2 focus:ring-brand-primary/30 cursor-pointer"
                    />
                    {brand.name}
                  </label>
                ))}
              </div>
            ),
          },
          {
            id: 'lifecycle',
            label: 'Estado',
            content: (
              <div className="space-y-2">
                {LIFECYCLE_FILTER_OPTIONS.map((status) => (
                  <label key={status} htmlFor={`prod-state-${status}`} className="flex items-center gap-2 text-sm text-neutral-700 cursor-pointer">
                    <input
                      id={`prod-state-${status}`}
                      type="checkbox"
                      checked={filterChips.lifecycleStatuses.includes(status)}
                      onChange={(e) => {
                        setFilterChips((prev) => ({
                          ...prev,
                          lifecycleStatuses: e.target.checked
                            ? [...prev.lifecycleStatuses, status]
                            : prev.lifecycleStatuses.filter((s) => s !== status),
                        }))
                      }}
                      className="h-4 w-4 accent-[var(--color-primary)] focus:ring-2 focus:ring-brand-primary/30 cursor-pointer"
                    />
                    {LIFECYCLE_STATUS_LABEL[status]}
                  </label>
                ))}
              </div>
            ),
          },
        ]}
        content={
          <>
            {/* View controls */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex gap-2">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2.5 rounded-lg border transition-colors ${
                    viewMode === 'grid'
                      ? 'bg-security-500 text-white border-security-500'
                      : 'bg-white text-neutral-500 border-neutral-300 hover:bg-neutral-50'
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2.5 rounded-lg border transition-colors ${
                    viewMode === 'list'
                      ? 'bg-security-500 text-white border-security-500'
                      : 'bg-white text-neutral-500 border-neutral-300 hover:bg-neutral-50'
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                </button>
              </div>
              <ProductPagination
                page={page}
                totalPages={totalPages}
                total={total}
                pageSize={pageSize}
                pageSizeOptions={PAGE_SIZE_OPTIONS}
                onPageChange={setPage}
                onPageSizeChange={(size) => {
                  setPageSize(size)
                  setPage(1)
                }}
              />
            </div>

            {canBulkManage && (selectedProductIds.size > 0 || bulkNotice || bulkError) && (
              <div className="px-4 py-3 bg-white rounded-xl border border-neutral-200 space-y-2">
                {selectedProductIds.size > 0 && (
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-sm font-medium text-neutral-600">{selectedProductIds.size} seleccionado(s)</span>
                    <button
                      onClick={() => {
                        setSelectedProductIds(new Set())
                        setBulkNotice(null)
                        setBulkError(null)
                      }}
                      className="text-sm text-neutral-500 hover:text-neutral-800 underline underline-offset-2"
                    >
                      Limpiar selección
                    </button>
                    <div className="ml-auto flex flex-wrap items-center gap-2">
                      {canBulkManage && (
                        <>
                          <BulkButton label="Publicar" disabled={bulkTransition.isPending || !bulkAvailability.publish} onClick={() => handleBulkClick('publish')} />
                          <BulkButton label="Despublicar" disabled={bulkTransition.isPending || !bulkAvailability.unpublish} onClick={() => handleBulkClick('unpublish')} />
                          <BulkButton label="Archivar" disabled={bulkTransition.isPending || !bulkAvailability.archive} onClick={() => handleBulkClick('archive')} />
                          <BulkButton label="Restaurar" disabled={bulkTransition.isPending || !bulkAvailability.restore} onClick={() => handleBulkClick('restore')} />
                          <BulkButton
                            label="Mover categoría"
                            disabled={bulkTransition.isPending}
                            onClick={() =>
                              setMoveCategoryTarget({
                                type: 'bulk',
                                products: currentProducts.filter((p) => selectedProductIds.has(p.id)),
                              })
                            }
                          />
                          <BulkButton
                            label="Actualizar precios"
                            disabled={bulkTransition.isPending}
                            onClick={() => setShowBulkPrices(true)}
                          />
                        </>
                      )}
                      {canBulkDelete && (
                        <Button variant="danger" onClick={bulkDeleteProducts} disabled={bulkTransition.isPending}>
                          Eliminar
                        </Button>
                      )}
                    </div>
                  </div>
                )}
                {(bulkNotice || bulkError) && (
                  <div
                    role="status"
                    aria-live="polite"
                    className={`text-sm px-3 py-2 rounded-lg ${
                      bulkError ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'
                    }`}
                  >
                    {bulkNotice}
                    {bulkError && <span className="block mt-1 text-xs opacity-80">{bulkError}</span>}
                  </div>
                )}
              </div>
            )}

            {/* Products grid/list */}
            {viewMode === 'grid' ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {isLoading ? (
                  Array.from({ length: 10 }).map((_, i) => (
                    <div key={i} className="border border-gray-200 overflow-hidden animate-pulse">
                      <div className="aspect-square bg-gray-100"></div>
                      <div className="p-4 space-y-2">
                        <div className="h-3 bg-gray-100 rounded w-1/3"></div>
                        <div className="h-4 bg-gray-100 rounded w-full"></div>
                        <div className="h-3 bg-gray-100 rounded w-1/2"></div>
                      </div>
                    </div>
                  ))
                ) : currentProducts.length === 0 ? (
                  <div className="col-span-full text-center py-12">
                    <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                    <p className="text-gray-500 font-medium">
                      {filterChips.lifecycleStatuses.length > 0 && (products?.length ?? 0) > 0
                        ? `No hay productos en estado ${filterChips.lifecycleStatuses.map(s => LIFECYCLE_STATUS_LABEL[s as LifecycleStatus]).join(', ')}`
                        : 'No hay productos'}
                    </p>
                    <p className="text-gray-400 text-sm mt-1">
                      {isCatalogManager
                        ? 'Crea tu primer producto para comenzar'
                        : 'No tienes listas asignadas. Solicita acceso a tu administrador.'}
                    </p>
                  </div>
                ) : (
                  currentProducts.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      onEdit={setEditingProduct}
onTransition={(event) => transitionProduct.mutate({ event: event as LifecycleEvent })}
                      onDelete={(id) => deleteProductWithMasterKey.mutate({ id })}
                      onMoveCategory={(p) => setMoveCategoryTarget({ type: 'single', product: p })}
                      onAccess={setAccessProduct}
                    />
                  ))
                )}
              </div>
            ) : (
              <div className="overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      {canBulkManage && (
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          <input
                            type="checkbox"
                            checked={allPageSelected}
                            onChange={toggleSelectAllPage}
                            aria-label="Seleccionar todos los productos de la página"
                            className="h-4 w-4 accent-security-500 cursor-pointer"
                          />
                        </th>
                      )}
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Producto</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Precio</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Categoría</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Marca</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Estado</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {isLoading ? (
                      <tr>
                        <td colSpan={canBulkManage ? 7 : 6} className="px-6 py-12 text-center text-gray-400">Cargando...</td>
                      </tr>
                    ) : currentProducts.length === 0 ? (
                      <tr>
                        <td colSpan={canBulkManage ? 7 : 6} className="px-6 py-12 text-center text-gray-400">
                        {filterChips.lifecycleStatuses.length > 0 && (products?.length ?? 0) > 0
                          ? `No hay productos en estado ${filterChips.lifecycleStatuses.map(s => LIFECYCLE_STATUS_LABEL[s as LifecycleStatus]).join(', ')}`
                          : 'No hay productos'}
                        {!isCatalogManager && filterChips.lifecycleStatuses.length === 0 && (
                          <span className="block text-xs mt-1 text-gray-500">
                            No tienes listas asignadas. Solicita acceso a tu administrador.
                          </span>
                        )}
                      </td>
                      </tr>
                    ) : (
                      currentProducts.map((product) => (
                        <ProductTableRow
                          key={product.id}
                          product={product}
                          onEdit={setEditingProduct}
onTransition={(event) => transitionProduct.mutate({ event: event as LifecycleEvent })}
                          onDelete={(id) => deleteProductWithMasterKey.mutate({ id })}
                          selected={selectedProductIds.has(product.id)}
                          onToggleSelect={canBulkManage ? toggleSelectProduct : undefined}
                          accessRestrictedIds={accessRestrictedIds}
                          accessUnavailable={accessUnavailable}
                          onMoveCategory={(p) => setMoveCategoryTarget({ type: 'single', product: p })}
                          onAccess={setAccessProduct}
                        />
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {total > 0 && (
              <ProductPagination
                page={page}
                totalPages={totalPages}
                total={total}
                pageSize={pageSize}
                pageSizeOptions={PAGE_SIZE_OPTIONS}
                onPageChange={setPage}
                onPageSizeChange={(size) => {
                  setPageSize(size)
                  setPage(1)
                }}
              />
            )}
          </>
        }
      />

      {/* Modal */}
      {(showCreateModal || editingProduct) && (
        <ProductFormModal
          product={editingProduct}
          categories={categories || []}
          brands={brands || []}
          listaId={createListaId}
          onClose={() => {
            setShowCreateModal(false)
            setEditingProduct(null)
          }}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ['products'] })
            setShowCreateModal(false)
            setEditingProduct(null)
          }}
        />
      )}

      {showListaSelector && (
        <ListaSelectorModal
          listas={listas}
          onConfirm={(listaId) => {
            setCreateListaId(listaId)
            setShowCreateModal(true)
            setShowListaSelector(false)
          }}
          onClose={() => setShowListaSelector(false)}
        />
      )}

      {bulkModal && (
        <BulkLifecycleModal
          kind={bulkModal.kind}
          count={selectedProductIds.size}
          onConfirm={(reason) => runBulkTransition(bulkModal.kind, reason)}
          onClose={() => setBulkModal(null)}
        />
      )}

      {moveCategoryTarget && (
        <MoveCategoryModal
          target={moveCategoryTarget}
          categories={categories || []}
          onClose={() => setMoveCategoryTarget(null)}
          onDone={(summary) => {
            setBulkNotice(summary)
            setBulkError(null)
            setSelectedProductIds(new Set())
            queryClient.invalidateQueries({ queryKey: ['products'] })
          }}
        />
      )}

      {accessProduct && (
        <ProductAccessModal
          productId={accessProduct.id}
          productName={accessProduct.name}
          onClose={() => setAccessProduct(null)}
        />
      )}

      {showBulkPrices && (
        <BulkPriceUpdateModal
          productIds={Array.from(selectedProductIds)}
          onClose={() => setShowBulkPrices(false)}
          onDone={(summary) => {
            setBulkNotice(summary)
            setBulkError(null)
            setSelectedProductIds(new Set())
            queryClient.invalidateQueries({ queryKey: ['products'] })
            setShowBulkPrices(false)
          }}
        />
      )}

      {showBulkDeleteModal && (
        <BulkDeleteModal
          open={showBulkDeleteModal}
          onClose={() => setShowBulkDeleteModal(false)}
          products={currentProducts.filter((p) => selectedProductIds.has(p.id))}
          onConfirm={handleBulkDeleteConfirm}
          canManageListas={canManageListas}
        />
      )}
    </div>
  )
}

function BulkButton({
  label,
  onClick,
  disabled,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="px-3 py-2 text-xs font-medium rounded-lg border border-neutral-300 text-neutral-700 bg-white hover:bg-neutral-50 hover:border-security-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      {label}
    </button>
  )
}

function BulkLifecycleModal({
  kind,
  count,
  onConfirm,
  onClose,
}: {
  kind: BulkEventKind
  count: number
  onConfirm: (reason?: string) => void
  onClose: () => void
}) {
  const event = KIND_TO_EVENT[kind]
  const requiresConfirm = event === 'ARCHIVE' || event === 'RESTORE'
  const [reason, setReason] = useState('')
  const [confirmed, setConfirmed] = useState(false)

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-md shadow-2xl">
        <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between">
          <h2 className="text-lg font-condensed font-semibold text-neutral-800">{BULK_LABELS[kind]}</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 transition-colors"
            aria-label="Cerrar"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-sm text-neutral-500">
            Aplicar {BULK_LABELS[kind].toLowerCase()} a <strong>{count}</strong> producto(s) seleccionado(s).
          </p>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Motivo *</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Indica el motivo de esta acción"
              className="w-full px-3 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary text-sm"
            />
          </div>
          {requiresConfirm && (
            <label className="flex items-start gap-2 text-sm text-neutral-600">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="mt-1 h-4 w-4 accent-security-500"
              />
              <span>
                Confirmo que deseo {event === 'RESTORE' ? 'restaurar' : 'archivar'} los productos seleccionados.
              </span>
            </label>
          )}
          <div className="flex gap-3 justify-end pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={!reason.trim() || (requiresConfirm && !confirmed)}
              onClick={() => onConfirm(reason.trim())}
            >
              Confirmar
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ListaSelectorModal({
  listas,
  onConfirm,
  onClose,
}: {
  listas: Lista[]
  onConfirm: (listaId: string) => void
  onClose: () => void
}) {
  const [selected, setSelected] = useState('')
  const available = listas.filter((l) => l.isActive && !l.archivedAt)

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-md shadow-2xl max-h-[calc(100vh-4rem)] overflow-y-auto overscroll-contain">
        <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between">
          <h2 className="text-lg font-condensed font-semibold text-neutral-800">Seleccionar Lista</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 transition-colors"
            aria-label="Cerrar"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-neutral-500">
            Los productos se crean dentro de una Lista. Selecciona la Lista destino para continuar.
          </p>
          {available.length === 0 ? (
            <p className="text-sm text-neutral-400 bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-4 text-center">
              No hay Listas activas disponibles. Contacta al administrador.
            </p>
          ) : (
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              className="w-full px-3 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary text-sm bg-white"
              aria-label="Lista destino"
            >
              <option value="">Selecciona una Lista...</option>
              {available.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} ({l.code})
                </option>
              ))}
            </select>
          )}
          <div className="flex gap-3 justify-end pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="button" disabled={!selected} onClick={() => onConfirm(selected)}>
              Continuar
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}