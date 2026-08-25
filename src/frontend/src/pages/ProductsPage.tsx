import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { LifecycleEvent, LifecycleStatus, Product } from '../features/products/types/product.types'
import {
  LIFECYCLE_STATUS_LABEL,
  effectiveLifecycleStatus,
  productAllowedActions,
} from '../features/products/lib/lifecycle'
import { useProducts } from '../features/products/hooks/useProducts'
import { useProductMutations } from '../features/products/hooks/useProductMutations'
import { useTransitionProduct } from '../features/products/hooks/useProductTransition'
import { useAccessMatrix } from '../features/products/hooks/useAccessMatrix'
import { useBulkTransition } from '../features/products/hooks/useProductTransition'
import { ProductCard } from '../features/products/components/ProductCard'
import { ProductTableRow } from '../features/products/components/ProductTableRow'
import { ProductSpreadsheetTable } from '../features/products/components/ProductSpreadsheetTable'
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
import { useAuthStore } from '../stores/auth.store'
import { BulkDeleteModal } from '../features/products/components/BulkDeleteModal'

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100]
const DEFAULT_PAGE_SIZE = 20

/** Acciones bulk legacy → evento FSM (Etapa 5). */
type BulkEventKind =
  | 'activate'
  | 'deactivate'
  | 'show'
  | 'hide'
  | 'archive'
  | 'restore'
  | 'publish'
  | 'unpublish'
  | 'schedule'

const KIND_TO_EVENT: Record<BulkEventKind, LifecycleEvent> = {
  activate: 'REACTIVATE',
  deactivate: 'DISCONTINUE',
  show: 'SHOW',
  hide: 'HIDE',
  archive: 'ARCHIVE',
  restore: 'RESTORE',
  publish: 'PUBLISH',
  unpublish: 'UNPUBLISH',
  schedule: 'SCHEDULE',
}

const BULK_LABELS: Record<BulkEventKind, string> = {
  activate: 'Activar',
  deactivate: 'Desactivar',
  show: 'Mostrar',
  hide: 'Ocultar',
  archive: 'Archivar',
  restore: 'Restaurar',
  publish: 'Publicar',
  unpublish: 'Despublicar',
  schedule: 'Programar',
}

const LIFECYCLE_FILTER_OPTIONS: LifecycleStatus[] = [
  'DRAFT',
  'READY',
  'SCHEDULED',
  'PUBLISHED',
  'HIDDEN',
  'DISCONTINUED',
  'ARCHIVED',
]

export default function ProductsPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [brandId, setBrandId] = useState('')
  const [status, setStatus] = useState('')
  const [lifecycleFilter, setLifecycleFilter] = useState<'' | LifecycleStatus>('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
const [viewMode, setViewMode] = useState<'grid' | 'list' | 'table'>('table')
  const [createListaId, setCreateListaId] = useState('')
  const [showListaSelector, setShowListaSelector] = useState(false)
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(() => new Set())
  const [bulkNotice, setBulkNotice] = useState<string | null>(null)
  const [bulkError, setBulkError] = useState<string | null>(null)
  const [bulkModal, setBulkModal] = useState<{ kind: BulkEventKind } | null>(null)
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [moveCategoryTarget, setMoveCategoryTarget] = useState<MoveCategoryTarget | null>(null)
  const [accessProduct, setAccessProduct] = useState<Product | null>(null)
  const [showBulkPrices, setShowBulkPrices] = useState(false)
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false)

  const listasQuery = useQuery({
    queryKey: ['listas'],
    queryFn: fetchListas,
  })
  const listas = listasQuery.data ?? []
  const availableListas = listas.filter((l) => l.isActive && !l.archivedAt)

  const filters = {
    search,
    categoryId,
    brandId,
    isVisible: status === 'visible' ? true : status === 'hidden' ? false : undefined,
    isActive: status === 'active' ? true : status === 'inactive' ? false : undefined,
  }

  const { products, categories, brands, total, isLoading } = useProducts({
    filters,
    page,
    pageSize,
  })
  const { deleteProductWithMasterKey, markReady } = useProductMutations()
  const transitionProduct = useTransitionProduct()
  const bulkTransition = useBulkTransition()
  const currentUser = useAuthStore((s) => s.user)
  const userRoles = currentUser?.roles ?? []

  const canBulkDelete = hasPermission('products:delete')
  const canBulkManage = canBulkDelete || hasPermission('products:write')
  const isCatalogManager = hasRole(ROLES.SUPER_ADMIN) || hasRole(ROLES.ADMIN_COMERCIAL)
  const { restrictedIds: accessRestrictedIds, unavailable: accessUnavailable } = useAccessMatrix(
    'PRODUCT',
    !isLoading
  )

  // Filtro de estado FSM (provisional, cliente): el backend aún no soporta
  // `?status=` en el query DTO. Se aplica sobre los productos ya cargados.
  const filteredProducts = lifecycleFilter
    ? (products ?? []).filter((p) => effectiveLifecycleStatus(p) === lifecycleFilter)
    : products ?? []
  const currentProducts = filteredProducts
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
        setShowScheduleModal(false)
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
    if (kind === 'schedule') {
      setShowScheduleModal(true)
      return
    }
    const event = KIND_TO_EVENT[kind]
    if (event === 'ARCHIVE' || event === 'RESTORE' || event === 'DISCONTINUE' || event === 'UNPUBLISH') {
      setBulkModal({ kind })
      return
    }
    runBulkTransition(kind)
  }

  const runBulkSchedule = (publishAt: string, unpublishAt?: string) => {
    const ids = Array.from(selectedProductIds)
    if (ids.length === 0) return
    submitBulk(
      {
        ids,
        event: 'SCHEDULE',
        publishAt: new Date(publishAt).toISOString(),
        ...(unpublishAt ? { unpublishAt: new Date(unpublishAt).toISOString() } : {}),
      },
      'Programar'
    )
  }

  useEffect(() => {
    setPage(1)
    setSelectedProductIds(new Set())
  }, [search, categoryId, brandId, status, lifecycleFilter])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const selectedProducts = currentProducts.filter((p) => selectedProductIds.has(p.id))
  const selectedCan = (event: LifecycleEvent) =>
    selectedProducts.some((p) => productAllowedActions(p, userRoles).includes(event))
  const bulkAvailability: Record<BulkEventKind, boolean> = {
    activate: selectedCan('REACTIVATE'),
    deactivate: selectedCan('DISCONTINUE'),
    show: selectedCan('SHOW'),
    hide: selectedCan('HIDE'),
    archive: selectedCan('ARCHIVE'),
    restore: selectedCan('RESTORE'),
    publish: selectedCan('PUBLISH'),
    unpublish: selectedCan('UNPUBLISH'),
    schedule: selectedCan('SCHEDULE'),
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
            <>
              <select
                value={createListaId}
                onChange={(e) => setCreateListaId(e.target.value)}
                className="px-3 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary text-sm bg-white max-w-64"
                aria-label="Lista destino para nuevos productos"
              >
                <option value="">Lista destino...</option>
                {availableListas.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
              <Button
                variant="primary"
                icon={
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                }
                onClick={() => {
                  if (createListaId) {
                    setShowCreateModal(true)
                  } else {
                    setShowListaSelector(true)
                  }
                }}
              >
                Nuevo Producto
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Search and filters */}
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex-1 relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Buscar por nombre, SKU o descripción..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary text-sm"
          />
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="px-3 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary text-sm bg-white"
          >
            <option value="">Todas las categorías</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
          <select
            value={brandId}
            onChange={(e) => setBrandId(e.target.value)}
            className="px-3 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary text-sm bg-white"
          >
            <option value="">Todas las marcas</option>
            {brands.map((brand) => (
              <option key={brand.id} value={brand.id}>
                {brand.name}
              </option>
            ))}
          </select>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="px-3 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary text-sm bg-white"
          >
            <option value="">Todos los estados</option>
            <option value="visible">Visible</option>
            <option value="hidden">Oculto</option>
            <option value="active">Activo</option>
            <option value="inactive">Inactivo</option>
          </select>
          <select
            value={lifecycleFilter}
            onChange={(e) => setLifecycleFilter((e.target.value || '') as '' | LifecycleStatus)}
            aria-label="Filtrar por estado de ciclo de vida"
            className="px-3 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary text-sm bg-white"
          >
            <option value="">Todos los ciclos</option>
            {LIFECYCLE_FILTER_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {LIFECYCLE_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
      </div>

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
          <button
            onClick={() => setViewMode('table')}
            title="Vista de tabla (prices)"
            className={`p-2.5 rounded-lg border transition-colors ${
              viewMode === 'table'
                ? 'bg-security-500 text-white border-security-500'
                : 'bg-white text-neutral-500 border-neutral-300 hover:bg-neutral-50'
            }`}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4h16a1 1 0 011 1v14a1 1 0 01-1 1H4a1 1 0 01-1-1V5a1 1 0 011-1zM4 9h16M4 14h16M9 4v16" />
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
                    <BulkButton label="Activar" disabled={bulkTransition.isPending || !bulkAvailability.activate} onClick={() => handleBulkClick('activate')} />
                    <BulkButton label="Desactivar" disabled={bulkTransition.isPending || !bulkAvailability.deactivate} onClick={() => handleBulkClick('deactivate')} />
                    <BulkButton label="Mostrar" disabled={bulkTransition.isPending || !bulkAvailability.show} onClick={() => handleBulkClick('show')} />
                    <BulkButton label="Ocultar" disabled={bulkTransition.isPending || !bulkAvailability.hide} onClick={() => handleBulkClick('hide')} />
                    <BulkButton label="Archivar" disabled={bulkTransition.isPending || !bulkAvailability.archive} onClick={() => handleBulkClick('archive')} />
                    <BulkButton label="Restaurar" disabled={bulkTransition.isPending || !bulkAvailability.restore} onClick={() => handleBulkClick('restore')} />
                    <BulkButton label="Publicar" disabled={bulkTransition.isPending || !bulkAvailability.publish} onClick={() => handleBulkClick('publish')} />
                    <BulkButton label="Despublicar" disabled={bulkTransition.isPending || !bulkAvailability.unpublish} onClick={() => handleBulkClick('unpublish')} />
                    <BulkButton label="Programar" disabled={bulkTransition.isPending || !bulkAvailability.schedule} onClick={() => handleBulkClick('schedule')} />
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
                {lifecycleFilter && (products?.length ?? 0) > 0
                  ? `No hay productos en estado ${LIFECYCLE_STATUS_LABEL[lifecycleFilter]}`
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
                onMarkReady={(p) => {
                  if (window.confirm(`¿Marcar "${p.name}" como listo para publicar?`)) markReady.mutate(p.id)
                }}
              />
            ))
          )}
        </div>
      ) : viewMode === 'list' ? (
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
                  {lifecycleFilter && (products?.length ?? 0) > 0
                    ? `No hay productos en estado ${LIFECYCLE_STATUS_LABEL[lifecycleFilter]}`
                    : 'No hay productos'}
                  {!isCatalogManager && !lifecycleFilter && (
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
                    onMarkReady={(p) => {
                      if (window.confirm(`¿Marcar "${p.name}" como listo para publicar?`)) markReady.mutate(p.id)
                    }}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <ProductSpreadsheetTable
          products={currentProducts}
          isLoading={isLoading}
          onEdit={setEditingProduct}
          onTransition={(event) => transitionProduct.mutate({ event: event as LifecycleEvent })}
          onDelete={(id) => deleteProductWithMasterKey.mutate({ id })}
          selectedProductIds={canBulkManage ? selectedProductIds : undefined}
          onToggleSelectProduct={canBulkManage ? toggleSelectProduct : undefined}
          onToggleSelectAllProducts={canBulkManage ? toggleSelectAllPage : undefined}
          accessRestrictedIds={accessRestrictedIds}
          accessUnavailable={accessUnavailable}
          onMoveCategory={(p) => setMoveCategoryTarget({ type: 'single', product: p })}
          onAccess={setAccessProduct}
          onMarkReady={(p) => {
            if (window.confirm(`¿Marcar "${p.name}" como listo para publicar?`)) markReady.mutate(p.id)
          }}
        />
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
            setShowListaSelector(false)
            setShowCreateModal(true)
          }}
          onClose={() => setShowListaSelector(false)}
        />
      )}

      {showScheduleModal && (
        <SchedulePublishModal
          count={selectedProductIds.size}
          onConfirm={runBulkSchedule}
          onClose={() => setShowScheduleModal(false)}
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

function SchedulePublishModal({
  count,
  onConfirm,
  onClose,
}: {
  count: number
  onConfirm: (publishAt: string, unpublishAt?: string) => void
  onClose: () => void
}) {
  const [publishAt, setPublishAt] = useState('')
  const [unpublishAt, setUnpublishAt] = useState('')

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-md shadow-2xl">
        <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between">
          <h2 className="text-lg font-condensed font-semibold text-neutral-800">Programar publicación</h2>
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
            Programar la publicación de <strong>{count}</strong> producto(s) seleccionado(s). Hasta que llegue la
            fecha, quedarán en estado LISTO.
          </p>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Fecha y hora de publicación *</label>
            <input
              type="datetime-local"
              value={publishAt}
              onChange={(e) => setPublishAt(e.target.value)}
              className="w-full px-3 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Despublicación automática (opcional)</label>
            <input
              type="datetime-local"
              value={unpublishAt}
              onChange={(e) => setUnpublishAt(e.target.value)}
              className="w-full px-3 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary text-sm"
            />
            {unpublishAt && publishAt && new Date(unpublishAt) <= new Date(publishAt) && (
              <p className="mt-1 text-xs text-red-600">La despublicación debe ser posterior a la publicación.</p>
            )}
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={!publishAt || (!!unpublishAt && !!publishAt && new Date(unpublishAt) <= new Date(publishAt))}
              onClick={() => onConfirm(publishAt, unpublishAt || undefined)}
            >
              Programar
            </Button>
          </div>
        </div>
      </div>
    </div>
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


