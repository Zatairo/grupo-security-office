import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import api from '../services/api'
import { fetchCatalogById, productCountOf } from '../services/catalogs.service'
import type { Product, ProductListResponse } from '../features/products/types/product.types'
import { getApiErrorMessage } from '../lib/apiError'
import { formatCurrency } from '../lib/format'

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

function basePriceValue(product: Product): number | undefined {
  const first = product.prices?.[0]
  return first ? Number(first.value) : undefined
}

function isNotFoundError(error: unknown): boolean {
  if (error && typeof error === 'object' && 'response' in error) {
    return (error as { response?: { status?: number } }).response?.status === 404
  }
  return false
}

export default function CatalogDetailPage() {
  const { catalogId } = useParams<{ catalogId: string }>()

  const catalogQuery = useQuery({
    queryKey: ['catalog', catalogId],
    queryFn: () => fetchCatalogById(catalogId ?? ''),
    enabled: Boolean(catalogId),
  })

  const productsQuery = useQuery({
    queryKey: ['products', 'catalog', catalogId],
    queryFn: async () => {
      const res = await api.get(`/products?catalogId=${encodeURIComponent(catalogId ?? '')}&take=50`)
      const body = res.data as ProductListResponse
      return body.data ?? []
    },
    enabled: Boolean(catalogId) && Boolean(catalogQuery.data),
  })

  const catalog = catalogQuery.data
  const products = productsQuery.data ?? []

  if (catalogQuery.isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-4 bg-neutral-100 rounded w-1/3 animate-pulse"></div>
        <div className="bg-white rounded-xl border border-neutral-200 p-6 animate-pulse space-y-3">
          <div className="h-6 bg-neutral-100 rounded w-1/2"></div>
          <div className="h-3 bg-neutral-100 rounded w-1/4"></div>
        </div>
        <div className="bg-white rounded-xl border border-neutral-200 p-6 animate-pulse space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-12 bg-neutral-100 rounded w-full"></div>
          ))}
        </div>
      </div>
    )
  }

  if (catalogQuery.error || !catalog) {
    const accessDenied = catalogQuery.error ? isNotFoundError(catalogQuery.error) : false

    return (
      <div className="space-y-6">
        <nav aria-label="Breadcrumb">
          <ol className="flex items-center gap-1.5 text-sm text-neutral-500 flex-wrap">
            <li>
              <Link
                to="/commercial/catalogs"
                className="hover:text-[var(--color-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus-ring)] rounded"
              >
                Catálogos
              </Link>
            </li>
            <li aria-hidden>›</li>
            <li className="text-neutral-700" aria-current="page">
              Detalle
            </li>
          </ol>
        </nav>
        {accessDenied ? (
          <div className="flex items-start gap-3 p-3.5 rounded-lg border text-sm bg-amber-50 border-amber-200 text-amber-800" role="alert">
            <svg className="w-5 h-5 text-amber-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4" />
            </svg>
            <span className="flex-1">
              <span className="font-semibold block">Sin acceso a este catálogo</span>
              El catálogo no existe o no está dentro de tus asignaciones.
            </span>
          </div>
        ) : (
          <div className="flex items-start gap-3 p-3.5 rounded-lg border text-sm bg-red-50 border-red-200 text-red-800" role="alert">
            <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="flex-1">
              {getApiErrorMessage(catalogQuery.error, 'Catálogo no encontrado')}
            </span>
          </div>
        )}
        <Link
          to="/commercial/catalogs"
          className="inline-flex items-center gap-2 text-sm font-medium text-[var(--color-primary)] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus-ring)] rounded"
        >
          ← Volver a Catálogos
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb">
        <ol className="flex items-center gap-1.5 text-sm text-neutral-500 flex-wrap">
          <li>
            <Link
              to="/commercial/catalogs"
              className="hover:text-[var(--color-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus-ring)] rounded"
            >
              Catálogos
            </Link>
          </li>
          <li aria-hidden>›</li>
          <li className="text-neutral-700">{catalog.name}</li>
          <li aria-hidden>›</li>
          <li className="text-neutral-400" aria-current="page">
            Productos
          </li>
        </ol>
      </nav>

      {/* Header */}
      <div className="bg-white rounded-xl border border-neutral-200 p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-condensed font-bold text-security-800">{catalog.name}</h1>
              <StatusBadge isActive={catalog.isActive} />
            </div>
            <p className="text-sm text-neutral-400 font-mono mt-1">{catalog.code}</p>
            {catalog.description && (
              <p className="text-sm text-neutral-500 mt-2 max-w-2xl">{catalog.description}</p>
            )}
          </div>
          <div className="flex items-center gap-6 flex-shrink-0">
            <div className="text-center">
              <p className="text-2xl font-bold text-security-700 tabular-nums">{productCountOf(catalog)}</p>
              <p className="text-xs text-neutral-500">Productos</p>
            </div>
            <Link
              to="/commercial/products"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-neutral-300 text-sm font-medium text-neutral-700 hover:bg-neutral-50 hover:border-[var(--color-primary)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus-ring)]"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              Ver en Productos
            </Link>
          </div>
        </div>
      </div>

      {/* Product summary */}
      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between">
          <h2 className="text-lg font-condensed font-semibold text-neutral-800">Productos del catálogo</h2>
          {products.length > 0 && (
            <span className="text-xs text-neutral-400">Mostrando hasta 50</span>
          )}
        </div>

        {productsQuery.isLoading ? (
          <div className="p-6 space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-12 bg-neutral-100 rounded animate-pulse"></div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-16">
            <svg className="w-16 h-16 text-neutral-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            <p className="text-neutral-500 font-medium">Este catálogo no tiene productos asignados</p>
            <p className="text-neutral-400 text-sm mt-1">
              Asigna productos desde la página de Productos
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-neutral-200 text-sm">
              <thead className="bg-neutral-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider">SKU</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider">Producto</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider">Marca</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider">Categoría</th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-semibold text-neutral-600 uppercase tracking-wider">Precio base</th>
                  <th scope="col" className="px-6 py-3 text-center text-xs font-semibold text-neutral-600 uppercase tracking-wider">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {products.map((product) => {
                  const price = basePriceValue(product)
                  return (
                    <tr key={product.id} className="hover:bg-neutral-50/60 transition-colors">
                      <td className="px-6 py-3 text-xs text-neutral-500 font-mono whitespace-nowrap">{product.sku}</td>
                      <td className="px-6 py-3 font-medium text-neutral-900">{product.name}</td>
                      <td className="px-6 py-3 text-neutral-600">{product.brand?.name}</td>
                      <td className="px-6 py-3 text-neutral-600">{product.category?.name}</td>
                      <td className="px-6 py-3 text-right tabular-nums">
                        {price === undefined ? (
                          <span className="inline-block text-[10px] font-semibold bg-amber-100 text-amber-700 px-2 py-0.5 rounded whitespace-nowrap">
                            Sin precio
                          </span>
                        ) : price === 0 ? (
                          <span className="text-neutral-300">—</span>
                        ) : (
                          <span className="font-medium text-neutral-900">{formatCurrency(price)}</span>
                        )}
                      </td>
                      <td className="px-6 py-3 text-center">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 text-xs font-medium rounded-full ${
                            product.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {product.isActive ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
