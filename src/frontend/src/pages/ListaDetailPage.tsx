import { useState, useMemo, type FormEvent } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import api from '../services/api'
import { fetchListaById, fetchListaProducts, fetchListaPrices, fetchListaAssignments, fetchListaAudit, downloadListaTemplateCsv } from '../services/listas.service'
import { fetchPriceLists, createPrice, updatePrice, deletePrice } from '../services/prices.service'
import type { Price, PricePayload, UpdatePricePayload } from '../services/prices.service'
import { canManageListas, hasPermission, hasRole } from '../lib/rbac'
import { ROLES } from '../lib/roles'
import { getApiErrorMessage } from '../lib/apiError'
import { formatDate } from '../lib/format'
import { Button, Modal } from '../components/ui'
import ProductFormModal from '../features/products/components/ProductFormModal'
import ImportWizard from '../features/products/import/components/ImportWizard'
import { hasPersistedImportState } from '../features/products/import/store/import.store'
import type { Category, Brand, Product } from '../features/products/types/product.types'
import { ProductIndicators } from '../features/products/components/ProductIndicators'

type Tab = 'products' | 'prices' | 'access' | 'audit'

function StatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full ${
        isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
      }`}
    >
      {isActive ? 'Activo' : 'Inactivo'}
    </span>
  )
}

export default function ListaDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<Tab>('products')
  const [showImportModal, setShowImportModal] = useState(hasPersistedImportState)

  const {
    data: lista,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['lista', id],
    queryFn: () => fetchListaById(id!),
    enabled: !!id,
    retry: false,
  })

  const accessDenied =
    error && (error as { response?: { status?: number } })?.response?.status === 403 ||
    (error && (error as { response?: { status?: number } })?.response?.status === 404)

  const { data: products } = useQuery({
    queryKey: ['lista-products', id],
    queryFn: () => fetchListaProducts(id!),
    enabled: !!id && (tab === 'products' || tab === 'prices'),
    retry: false,
  })

  const { data: prices } = useQuery({
    queryKey: ['lista-prices', id],
    queryFn: () => fetchListaPrices(id!),
    enabled: !!id && tab === 'prices',
    retry: false,
  })

  const { data: assignments } = useQuery({
    queryKey: ['lista-assignments', id],
    queryFn: () => fetchListaAssignments(id!),
    enabled: !!id && tab === 'access',
    retry: false,
  })

  const { data: auditLogs } = useQuery({
    queryKey: ['lista-audit', id],
    queryFn: () => fetchListaAudit(id!),
    enabled: !!id && tab === 'audit',
    retry: false,
  })

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-neutral-100 rounded w-1/3 animate-pulse"></div>
        <div className="h-4 bg-neutral-100 rounded w-2/3 animate-pulse"></div>
      </div>
    )
  }

  if (accessDenied) {
    return (
      <div className="bg-white rounded-xl border border-neutral-200 text-center py-16">
        <svg className="w-16 h-16 text-neutral-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v3m0 0l3-3m-3 3l-3-3M12 7v9" />
        </svg>
        <p className="text-neutral-500 font-medium">No tienes acceso a esta Lista</p>
        <p className="text-neutral-400 text-sm mt-1">Solo puedes ver las Listas a las que tienes asignación activa.</p>
        <Button variant="secondary" className="mt-4" onClick={() => navigate('/commercial/lists')}>
          Volver a Listas
        </Button>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-start gap-3 p-3.5 rounded-lg border text-sm bg-red-50 border-red-200 text-red-800" role="alert">
        <span className="flex-1">{getApiErrorMessage(error, 'No se pudo cargar la Lista')}</span>
      </div>
    )
  }

  if (!lista) return null

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-condensed font-bold text-security-800">{lista.name}</h1>
          <p className="text-sm text-neutral-500 mt-1 font-mono">
            {lista.code} · {lista.currency}
          </p>
          {lista.description && <p className="text-sm text-neutral-500 mt-1">{lista.description}</p>}
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {(canManageListas() || hasPermission('products:write')) && (
            <>
              <Button
                variant="secondary"
                icon={
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                }
                onClick={() => downloadListaTemplateCsv(`plantilla-lista-${lista.code}-${lista.id.slice(0, 8)}.csv`)}
              >
                Descargar plantilla
              </Button>
              <Button
                variant="secondary"
                icon={
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                }
                onClick={() => setShowImportModal(true)}
              >
                Importar desde Excel
              </Button>
            </>
          )}
          <StatusBadge isActive={lista.isActive} />
          <span className="text-xs text-neutral-500">{formatDate(lista.updatedAt)}</span>
          <span className="text-xs text-neutral-500">{lista.productCount ?? 0} producto(s)</span>
        </div>
      </div>

      <div className="border-b border-neutral-200">
        <nav className="flex gap-1 overflow-x-auto scrollbar-thin" aria-label="Pestañas">
          {([
            { key: 'products', label: 'Productos' },
            { key: 'prices', label: 'Precios' },
            { key: 'access', label: 'Accesos' },
            { key: 'audit', label: 'Auditoría' },
          ] as { key: Tab; label: string }[]).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2.5 text-sm font-condensed font-semibold whitespace-nowrap border-b-2 transition-colors ${
                tab === t.key
                  ? 'text-[var(--color-primary)] border-[var(--color-primary)]'
                  : 'text-neutral-500 border-transparent hover:text-neutral-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {tab === 'products' && (
        <ProductosTab products={products ?? []} canManage={canManageListas()} listaId={id ?? ''} />
      )}
      {tab === 'prices' && (
        <PreciosTab products={products ?? []} prices={prices ?? []} listaId={id ?? ''} />
      )}
      {tab === 'access' && <AccesosTab assignments={assignments ?? []} />}
      {tab === 'audit' && <AuditoriaTab logs={auditLogs ?? []} />}

      {showImportModal && (
        <ImportWizard
          listaId={id ?? undefined}
          onClose={() => setShowImportModal(false)}
          onComplete={() => {
            queryClient.invalidateQueries({ queryKey: ['lista-products', id] })
            queryClient.invalidateQueries({ queryKey: ['lista-prices', id] })
            queryClient.invalidateQueries({ queryKey: ['listas'] })
            setShowImportModal(false)
          }}
        />
      )}
    </div>
  )
}

function ProductosTab({
  products,
  canManage,
  listaId,
}: {
  products: any[]
  canManage: boolean
  listaId: string
}) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [view, setView] = useState<'table' | 'folder'>('table')
  const canEdit = canManage || hasPermission('products:write')

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => (await api.get('/categories')).data.data as Category[],
  })

  const { data: brands } = useQuery({
    queryKey: ['brands'],
    queryFn: async () => (await api.get('/brands')).data.data as Brand[],
  })

  if (products.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-neutral-200 text-center py-12">
        <p className="text-neutral-500">No hay productos en esta Lista.</p>
        {canManage && (
          <p className="text-neutral-400 text-sm mt-1">Crea productos asignados a esta Lista para comenzar.</p>
        )}
      </div>
    )
  }

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <div className="flex gap-1.5 bg-neutral-100 rounded-lg p-1 text-xs font-medium text-neutral-600">
          <button
            onClick={() => setView('table')}
            className={`px-3 py-1.5 rounded ${view === 'table' ? 'bg-white shadow text-neutral-800' : ''}`}
          >
            Tabla
          </button>
          <button
            onClick={() => setView('folder')}
            className={`px-3 py-1.5 rounded ${view === 'folder' ? 'bg-white shadow text-neutral-800' : ''}`}
          >
            Carpeta
          </button>
        </div>
        <span className="text-xs text-neutral-500">{products.length} producto(s)</span>
      </div>

      {view === 'folder' ? (
        <FolderView products={products} onOpenProduct={(id) => navigate(`/commercial/products/${id}`)} />
      ) : (
        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-neutral-200">
              <thead className="bg-neutral-100">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-condensed font-semibold text-neutral-500 uppercase">SKU</th>
                  <th className="px-4 py-3 text-left text-xs font-condensed font-semibold text-neutral-500 uppercase">Producto</th>
                  <th className="px-4 py-3 text-left text-xs font-condensed font-semibold text-neutral-500 uppercase">Categoría</th>
                  <th className="px-4 py-3 text-left text-xs font-condensed font-semibold text-neutral-500 uppercase">Marca</th>
                  <th className="px-4 py-3 text-right text-xs font-condensed font-semibold text-neutral-500 uppercase">Precio base</th>
                  <th className="px-4 py-3 text-left text-xs font-condensed font-semibold text-neutral-500 uppercase">Estado</th>
                  <th className="px-4 py-3 text-left text-xs font-condensed font-semibold text-neutral-500 uppercase">Indicadores</th>
                  <th className="px-4 py-3 text-right text-xs font-condensed font-semibold text-neutral-500 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {products.map((p: any) => (
                  <tr key={p.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-3 text-sm font-mono text-neutral-700">{p.sku}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 font-medium">{p.name}</td>
                    <td className="px-4 py-3 text-sm text-neutral-700">{p.category?.name ?? '-'}</td>
                    <td className="px-4 py-3 text-sm text-neutral-700">{p.brand?.name ?? '-'}</td>
                    <td className="px-4 py-3 text-sm text-neutral-700 text-right">
                      {Array.isArray(p.prices) && p.prices.length > 0
                        ? `${p.prices[0].currency} ${Number(p.prices[0].value).toLocaleString('es-CO')}`
                        : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <PriceIndicator prices={p.prices} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <ProductIndicators product={p as Product} />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          to={`/commercial/products/${p.id}`}
                          className="px-2.5 py-1 text-xs font-medium text-[var(--color-primary)] hover:bg-[var(--color-primary-bg-subtle)] rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus-ring)]"
                        >
                          Ver
                        </Link>
                        {canEdit && (
                          <button
                            onClick={() => setEditingProduct(p as Product)}
                            className="px-2.5 py-1 text-xs font-medium text-neutral-600 hover:text-[var(--color-primary)] hover:bg-[var(--color-primary-bg-subtle)] rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus-ring)]"
                          >
                            Editar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {editingProduct && (
        <ProductFormModal
          product={editingProduct}
          categories={categories ?? []}
          brands={brands ?? []}
          listaId={listaId}
          onClose={() => setEditingProduct(null)}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ['lista-products', listaId] })
            queryClient.invalidateQueries({ queryKey: ['lista-prices', listaId] })
            setEditingProduct(null)
          }}
        />
      )}
    </>
  )
}

function FolderView({
  products,
  onOpenProduct,
}: {
  products: any[]
  onOpenProduct: (id: string) => void
}) {
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => new Set())

  const groups = useMemo(() => {
    const map = new Map<string, any[]>()
    for (const p of products) {
      const key = p.category?.name ?? 'Sin categoría'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(p)
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0], 'es'))
  }, [products])

  const toggleGroup = (key: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  if (groups.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-neutral-200 text-center py-12">
        <p className="text-neutral-500">Sin productos para agrupar.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {groups.map(([category, items]) => {
        const open = openGroups.has(category)
        return (
          <div key={category} className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
            <button
              onClick={() => toggleGroup(category)}
              className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-neutral-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus-ring)]"
              aria-expanded={open}
            >
              <span className="flex items-center gap-2 text-sm font-semibold text-neutral-800">
                <svg
                  className={`w-4 h-4 text-neutral-400 transition-transform ${open ? 'rotate-90' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                {category}
              </span>
              <span className="text-xs font-medium text-neutral-500 bg-neutral-100 px-2.5 py-1 rounded-full">
                {items.length} producto(s)
              </span>
            </button>
            {open && (
              <div className="px-4 pb-4 pt-1 border-t border-neutral-100">
                <div className="flex flex-wrap gap-2">
                  {items.map((p: any) => (
                    <button
                      key={p.id}
                      onClick={() => onOpenProduct(p.id)}
                      className="flex flex-col items-start gap-1 px-3 py-2 border border-neutral-200 rounded-lg hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-bg-subtle)] transition-colors text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus-ring)]"
                    >
                      <span className="text-xs font-medium text-gray-900 max-w-56 truncate">{p.name}</span>
                      <span className="text-[10px] font-mono text-neutral-400">{p.sku}</span>
                      <ProductIndicators product={p as Product} />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function PriceIndicator({ prices }: { prices: any[] }) {
  const arr = Array.isArray(prices) ? prices : []
  const hasAny = arr.length > 0
  const hasActive = arr.some((pr: any) => !pr.validUntil || new Date(pr.validUntil).getTime() >= Date.now())
  if (!hasAny) {
    return (
      <span className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full bg-amber-100 text-amber-700">
        Sin precio
      </span>
    )
  }
  if (hasActive) {
    return (
      <span className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full bg-emerald-100 text-emerald-700">
        Con precio
      </span>
    )
  }
  return (
    <span className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full bg-red-100 text-red-700">
      Precio vencido
    </span>
  )
}

const CURRENCIES = ['COP', 'USD', 'EUR']

function PreciosTab({
  products,
  prices,
  listaId,
}: {
  products: any[]
  prices: any[]
  listaId: string
}) {
  const queryClient = useQueryClient()
  const [selectedProductId, setSelectedProductId] = useState<string>('')
  const [modal, setModal] = useState<{ mode: 'create' } | { mode: 'edit'; price: any } | null>(null)
  const [deletingPrice, setDeletingPrice] = useState<any | null>(null)
  const canEdit = canManageListas() || hasPermission('products:write')
  const canDelete = hasRole(ROLES.SUPER_ADMIN)

  const invalidatePrices = () => {
    queryClient.invalidateQueries({ queryKey: ['lista-prices', listaId] })
    queryClient.invalidateQueries({ queryKey: ['lista-products', listaId] })
  }

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deletePrice(id),
    onSuccess: () => {
      invalidatePrices()
      setDeletingPrice(null)
    },
  })

  if (products.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-neutral-200 text-center py-12">
        <p className="text-neutral-500">No hay productos en esta Lista para mostrar precios</p>
      </div>
    )
  }

  const effectiveId = selectedProductId || products[0]?.id || ''
  const productPrices = prices.filter((p: any) => p.productId === effectiveId)
  const selectedProduct = products.find((p: any) => p.id === effectiveId)

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div className="w-full max-w-md">
          <label htmlFor="price-product-select" className="block text-sm font-medium text-neutral-800 mb-1.5">
            Producto
          </label>
          <select
            id="price-product-select"
            value={effectiveId}
            onChange={(e) => setSelectedProductId(e.target.value)}
            className="w-full px-3 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-focus-ring)] focus:border-[var(--color-primary)] text-sm bg-white"
          >
            {products.map((p: any) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.sku})
              </option>
            ))}
          </select>
        </div>
        {canEdit && (
          <Button
            variant="secondary"
            icon={
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            }
            onClick={() => setModal({ mode: 'create' })}
          >
            Nuevo Precio
          </Button>
        )}
      </div>

      {productPrices.length === 0 ? (
        <div className="bg-white rounded-xl border border-neutral-200 text-center py-12">
          <p className="text-neutral-500">Este producto no tiene precios registrados en esta Lista.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-neutral-200">
              <thead className="bg-neutral-100">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-condensed font-semibold text-neutral-500 uppercase">Tarifa</th>
                  <th className="px-4 py-3 text-right text-xs font-condensed font-semibold text-neutral-500 uppercase">Valor</th>
                  <th className="px-4 py-3 text-left text-xs font-condensed font-semibold text-neutral-500 uppercase">Moneda</th>
                  <th className="px-4 py-3 text-left text-xs font-condensed font-semibold text-neutral-500 uppercase">Vigencia</th>
                  {canEdit && (
                    <th className="px-4 py-3 text-right text-xs font-condensed font-semibold text-neutral-500 uppercase">Acciones</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {productPrices.map((p: any) => {
                  const expired = !!p.validUntil && new Date(p.validUntil).getTime() < Date.now()
                  const active = !expired && (!p.validFrom || new Date(p.validFrom).getTime() <= Date.now())
                  return (
                    <tr key={p.id} className={`hover:bg-neutral-50 ${expired ? 'bg-amber-50' : ''}`}>
                      <td className="px-4 py-3 text-sm text-neutral-700">{p.priceList?.name ?? p.priceList?.code ?? '-'}</td>
                      <td className="px-4 py-3 text-sm text-neutral-700 text-right">{Number(p.value).toLocaleString('es-CO')}</td>
                      <td className="px-4 py-3 text-sm text-neutral-700">{p.currency}</td>
                      <td className="px-4 py-3 text-sm text-neutral-500">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span>
                            {p.validFrom && p.validUntil
                              ? `${formatDate(p.validFrom)} → ${formatDate(p.validUntil)}`
                              : p.validFrom
                                ? `Desde ${formatDate(p.validFrom)}`
                                : p.validUntil
                                  ? `Hasta ${formatDate(p.validUntil)}`
                                  : 'Sin vigencia'}
                          </span>
                          {expired && (
                            <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-700">
                              Vencido
                            </span>
                          )}
                          {active && (
                            <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-emerald-100 text-emerald-700">
                              Vigente
                            </span>
                          )}
                        </div>
                      </td>
                      {canEdit && (
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => setModal({ mode: 'edit', price: p })}
                              className="px-2.5 py-1 text-xs font-medium text-neutral-600 hover:text-[var(--color-primary)] hover:bg-[var(--color-primary-bg-subtle)] rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus-ring)]"
                            >
                              Editar
                            </button>
                            {canDelete && (
                              <button
                                onClick={() => setDeletingPrice(p)}
                                className="px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-200"
                              >
                                Eliminar
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modal && (
        <PriceFormModal
          mode={modal.mode}
          price={modal.mode === 'edit' ? modal.price : undefined}
          productId={effectiveId}
          productName={selectedProduct?.name}
          listaId={listaId}
          onClose={() => setModal(null)}
          onSaved={invalidatePrices}
        />
      )}

      {deletingPrice && (
        <Modal
          open
          onClose={() => {
            if (!deleteMutation.isPending) setDeletingPrice(null)
          }}
          title="Eliminar precio"
          footer={
            <>
              <Button variant="secondary" disabled={deleteMutation.isPending} onClick={() => setDeletingPrice(null)}>
                Cancelar
              </Button>
              <Button variant="danger" loading={deleteMutation.isPending} onClick={() => deleteMutation.mutate(deletingPrice.id)}>
                Eliminar
              </Button>
            </>
          }
        >
          <p className="text-sm text-neutral-600">
            ¿Seguro que deseas eliminar el precio de la tarifa{' '}
            <span className="font-medium text-neutral-800">{deletingPrice.priceList?.name ?? '-'}</span> para este
            producto? Esta acción no se puede deshacer.
          </p>
          {deleteMutation.isError && (
            <div className="mt-3 p-3 rounded-lg border text-sm bg-red-50 border-red-200 text-red-800" role="alert">
              {getApiErrorMessage(deleteMutation.error, 'No se pudo eliminar el precio')}
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}

function PriceFormModal({
  mode,
  price,
  productId,
  productName,
  listaId,
  onClose,
  onSaved,
}: {
  mode: 'create' | 'edit'
  price?: any
  productId: string
  productName?: string
  listaId: string
  onClose: () => void
  onSaved: () => void
}) {
  const [value, setValue] = useState(mode === 'edit' && price ? String(price.value) : '')
  const [currency, setCurrency] = useState(mode === 'edit' && price ? (price.currency ?? '') : '')
  const [priceListId, setPriceListId] = useState(mode === 'edit' && price ? (price.priceListId ?? '') : '')
  const [validFrom, setValidFrom] = useState(mode === 'edit' && price ? toDateInputValue(price.validFrom) : '')
  const [validUntil, setValidUntil] = useState(mode === 'edit' && price ? toDateInputValue(price.validUntil) : '')
  const [formError, setFormError] = useState('')

  const { data: priceLists = [], isLoading: priceListsLoading, isError: priceListsError } = useQuery({
    queryKey: ['priceLists'],
    queryFn: fetchPriceLists,
  })

  const mutation = useMutation({
    mutationFn: async (): Promise<Price> => {
      if (mode === 'edit' && price) {
        const payload: UpdatePricePayload = {
          value: Number(value),
          currency,
          listaId,
          validFrom: validFrom || null,
          validUntil: validUntil || null,
        }
        return updatePrice(price.id, payload)
      }
      const payload: PricePayload = {
        productId,
        priceListId,
        value: Number(value),
        currency,
        ...(listaId ? { listaId } : {}),
        ...(validFrom ? { validFrom } : {}),
        ...(validUntil ? { validUntil } : {}),
      }
      return createPrice(payload)
    },
    onSuccess: () => {
      onSaved()
      onClose()
    },
  })

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const num = Number(value)
    if (!value || !Number.isFinite(num) || num <= 0) {
      setFormError('El valor debe ser mayor que 0.')
      return
    }
    if (!currency) {
      setFormError('La moneda es requerida.')
      return
    }
    if (mode === 'create' && !priceListId) {
      setFormError('Selecciona una tarifa.')
      return
    }
    if (validFrom && validUntil && validUntil < validFrom) {
      setFormError('La fecha de fin no puede ser anterior a la fecha de inicio.')
      return
    }
    setFormError('')
    mutation.mutate()
  }

  const handlePriceListChange = (v: string) => {
    setPriceListId(v)
    if (!currency) {
      const pl = priceLists.find((item) => item.id === v)
      setCurrency(pl?.currency ?? '')
    }
  }

  return (
    <Modal
      open
      onClose={() => {
        if (!mutation.isPending) onClose()
      }}
      title={mode === 'edit' ? 'Editar precio' : 'Nuevo precio'}
      footer={
        <>
          <Button variant="secondary" disabled={mutation.isPending} onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="price-form" loading={mutation.isPending}>
            {mode === 'edit' ? 'Guardar cambios' : 'Crear precio'}
          </Button>
        </>
      }
    >
      <form id="price-form" onSubmit={handleSubmit} className="space-y-4">
        {(formError || mutation.isError) && (
          <div className="p-3 rounded-lg border text-sm bg-red-50 border-red-200 text-red-800" role="alert">
            {formError || getApiErrorMessage(mutation.error, 'No se pudo guardar el precio')}
          </div>
        )}

        <div>
          <label htmlFor="price-form-product" className="block text-sm font-medium text-neutral-800 mb-1.5">
            Producto
          </label>
          <input
            id="price-form-product"
            value={productName ?? productId}
            disabled
            className="w-full px-3 py-2.5 border border-neutral-200 rounded-lg bg-neutral-50 text-sm text-neutral-500"
          />
        </div>

        <div>
          <label htmlFor="price-form-price-list" className="block text-sm font-medium text-neutral-800 mb-1.5">
            Tarifa <span className="text-red-500">*</span>
          </label>
          {mode === 'edit' ? (
            <input
              id="price-form-price-list"
              value={price?.priceList?.name ?? price?.priceListId ?? ''}
              disabled
              className="w-full px-3 py-2.5 border border-neutral-200 rounded-lg bg-neutral-50 text-sm text-neutral-500"
            />
          ) : (
            <select
              id="price-form-price-list"
              value={priceListId}
              onChange={(e) => handlePriceListChange(e.target.value)}
              required
              className="w-full px-3 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-focus-ring)] focus:border-[var(--color-primary)] text-sm bg-white"
            >
              <option value="">Selecciona una tarifa</option>
              {priceLists.map((pl) => (
                <option key={pl.id} value={pl.id}>
                  {pl.name} ({pl.code})
                </option>
              ))}
            </select>
          )}
          {priceListsLoading && <p className="text-xs text-neutral-400 mt-1">Cargando tarifas…</p>}
          {priceListsError && <p className="text-xs text-red-600 mt-1">No se pudieron cargar las tarifas.</p>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="price-form-value" className="block text-sm font-medium text-neutral-800 mb-1.5">
              Valor <span className="text-red-500">*</span>
            </label>
            <input
              id="price-form-value"
              type="number"
              min="0.01"
              step="0.01"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              required
              autoFocus
              placeholder="0.00"
              className="w-full px-3 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-focus-ring)] focus:border-[var(--color-primary)] text-sm bg-white"
            />
          </div>
          <div>
            <label htmlFor="price-form-currency" className="block text-sm font-medium text-neutral-800 mb-1.5">
              Moneda <span className="text-red-500">*</span>
            </label>
            <select
              id="price-form-currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              required
              className="w-full px-3 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-focus-ring)] focus:border-[var(--color-primary)] text-sm bg-white"
            >
              <option value="">Selecciona moneda</option>
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="price-form-valid-from" className="block text-sm font-medium text-neutral-800 mb-1.5">
              Vigencia desde
            </label>
            <input
              id="price-form-valid-from"
              type="date"
              value={validFrom}
              onChange={(e) => setValidFrom(e.target.value)}
              className="w-full px-3 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-focus-ring)] focus:border-[var(--color-primary)] text-sm bg-white"
            />
          </div>
          <div>
            <label htmlFor="price-form-valid-until" className="block text-sm font-medium text-neutral-800 mb-1.5">
              Vigencia hasta
            </label>
            <input
              id="price-form-valid-until"
              type="date"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
              className="w-full px-3 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-focus-ring)] focus:border-[var(--color-primary)] text-sm bg-white"
            />
          </div>
        </div>

        <p className="text-xs text-neutral-400">
          La vigencia es opcional. Si defines ambas fechas, la de fin no puede ser anterior a la de inicio.
        </p>
      </form>
    </Modal>
  )
}

function toDateInputValue(iso?: string | null): string {
  if (!iso) return ''
  return iso.slice(0, 10)
}

function AccesosTab({ assignments }: { assignments: any[] }) {
  const LEVEL_LABELS: Record<string, string> = { view: 'Vista', edit: 'Edición', manage: 'Administrar' }
  if (assignments.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-neutral-200 text-center py-12">
        <p className="text-neutral-500">No hay accesos asignados a esta Lista.</p>
        <p className="text-neutral-400 text-sm mt-1">
          Los accesos se gestionan desde la vista de Asignaciones para usuarios con permiso de administración sobre esta Lista.
        </p>
      </div>
    )
  }
  return (
    <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-neutral-200">
          <thead className="bg-neutral-100">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-condensed font-semibold text-neutral-500 uppercase">Usuario</th>
              <th className="px-4 py-3 text-left text-xs font-condensed font-semibold text-neutral-500 uppercase">Nivel</th>
              <th className="px-4 py-3 text-left text-xs font-condensed font-semibold text-neutral-500 uppercase">Estado</th>
              <th className="px-4 py-3 text-left text-xs font-condensed font-semibold text-neutral-500 uppercase">Actualizado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {assignments.map((a: any) => (
              <tr key={a.id} className="hover:bg-neutral-50">
                <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                  {a.user?.email ?? a.userId?.slice(0, 8)}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full ${
                      a.level === 'manage'
                        ? 'bg-red-100 text-red-700'
                        : a.level === 'edit'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-[var(--color-primary-bg-subtle)] text-[var(--color-primary)]'
                    }`}
                  >
                    {LEVEL_LABELS[a.level] ?? a.level}
                  </span>
                </td>
                <td className="px-4 py-3"><StatusBadge isActive={a.isActive} /></td>
                <td className="px-4 py-3 text-sm text-neutral-500">{formatDate(a.updatedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function AuditoriaTab({ logs }: { logs: any[] }) {
  if (logs.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-neutral-200 text-center py-12">
        <p className="text-neutral-400">Sin eventos de auditoría registrados para esta Lista.</p>
      </div>
    )
  }
  return (
    <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-neutral-200">
          <thead className="bg-neutral-100">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-condensed font-semibold text-neutral-500 uppercase">Fecha</th>
              <th className="px-4 py-3 text-left text-xs font-condensed font-semibold text-neutral-500 uppercase">Acción</th>
              <th className="px-4 py-3 text-left text-xs font-condensed font-semibold text-neutral-500 uppercase">Usuario</th>
              <th className="px-4 py-3 text-left text-xs font-condensed font-semibold text-neutral-500 uppercase">Detalle</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {logs.map((l: any) => (
              <tr key={l.id} className="hover:bg-neutral-50">
                <td className="px-4 py-3 text-sm text-neutral-500">{formatDate(l.createdAt)}</td>
                <td className="px-4 py-3 text-sm text-gray-900 font-medium">{l.action}</td>
                <td className="px-4 py-3 text-sm text-neutral-700">{l.user?.email ?? l.userId?.slice(0, 8) ?? '-'}</td>
                <td className="px-4 py-3 text-sm text-neutral-500 truncate max-w-xs">
                  {l.oldValues || l.newValues ? 'Cambio registrado' : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
