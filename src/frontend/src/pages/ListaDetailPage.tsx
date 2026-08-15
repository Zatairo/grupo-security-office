import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../services/api'
import { fetchListaById, fetchListaProducts, fetchListaPrices, fetchListaAssignments, fetchListaAudit } from '../services/listas.service'
import { canManageListas, hasPermission } from '../lib/rbac'
import { getApiErrorMessage } from '../lib/apiError'
import { formatDate } from '../lib/format'
import { Button } from '../components/ui'
import ProductFormModal from '../features/products/components/ProductFormModal'
import ImportWizard from '../features/products/import/components/ImportWizard'
import { hasPersistedImportState } from '../features/products/import/store/import.store'
import type { Category, Brand, Product } from '../features/products/types/product.types'

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
        <PreciosTab products={products ?? []} prices={prices ?? []} />
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
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
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

function PreciosTab({ products, prices }: { products: any[]; prices: any[] }) {
  const [selectedProductId, setSelectedProductId] = useState<string>('')

  if (products.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-neutral-200 text-center py-12">
        <p className="text-neutral-500">No hay productos en esta Lista para mostrar precios</p>
      </div>
    )
  }

  const effectiveId = selectedProductId || products[0]?.id || ''
  const productPrices = prices.filter((p: any) => p.productId === effectiveId)

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="price-product-select" className="block text-sm font-medium text-neutral-800 mb-1.5">
          Producto
        </label>
        <select
          id="price-product-select"
          value={effectiveId}
          onChange={(e) => setSelectedProductId(e.target.value)}
          className="w-full max-w-md px-3 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-focus-ring)] focus:border-[var(--color-primary)] text-sm bg-white"
        >
          {products.map((p: any) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.sku})
            </option>
          ))}
        </select>
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
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {productPrices.map((p: any) => (
                  <tr key={p.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-3 text-sm text-neutral-700">{p.priceList?.name ?? p.priceList?.code ?? '-'}</td>
                    <td className="px-4 py-3 text-sm text-neutral-700 text-right">{Number(p.value).toLocaleString('es-CO')}</td>
                    <td className="px-4 py-3 text-sm text-neutral-700">{p.currency}</td>
                    <td className="px-4 py-3 text-sm text-neutral-500">
                      {p.validFrom && p.validUntil
                        ? `${formatDate(p.validFrom)} → ${formatDate(p.validUntil)}`
                        : p.validFrom
                          ? `Desde ${formatDate(p.validFrom)}`
                          : p.validUntil
                            ? `Hasta ${formatDate(p.validUntil)}`
                            : 'Sin vigencia'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
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
