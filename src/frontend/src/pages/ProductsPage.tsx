import { useState, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import ImportWizard from '../features/products/import/components/ImportWizard'
import { IMPORT_WIZARD_STORAGE_KEY } from '../features/products/import/store/import.store'
import type { Product } from '../features/products/types/product.types'
import { useProducts } from '../features/products/hooks/useProducts'
import { useProductMutations } from '../features/products/hooks/useProductMutations'
import { ProductCard } from '../features/products/components/ProductCard'
import { ProductTableRow } from '../features/products/components/ProductTableRow'
import { ProductSpreadsheetTable } from '../features/products/components/ProductSpreadsheetTable'
import ProductFormModal from '../features/products/components/ProductFormModal'
import { hasPermission } from '../lib/rbac'
import { Button } from '../components/ui'

const PAGE_SIZE = 20

function hasPersistedImportState(): boolean {
  try {
    const raw = sessionStorage.getItem(IMPORT_WIZARD_STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    const step = parsed?.state?.currentStep;
    return typeof step === 'string' && step !== 'upload' && step !== 'execution' && step !== 'result';
  } catch {
    return false;
  }
}

export default function ProductsPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [brandId, setBrandId] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(hasPersistedImportState)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'table'>('table')

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
    pageSize: PAGE_SIZE,
  })
  const { toggleVisibility, toggleActive, deleteProduct } = useProductMutations()

  useEffect(() => {
    setPage(1)
  }, [search, categoryId, brandId, status])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-condensed font-bold text-security-800">Productos</h1>
          <p className="text-sm text-neutral-500 mt-1">Gestiona tu catálogo de productos</p>
        </div>
        <div className="flex gap-2">
          {hasPermission('products:write') && (
            <Button
              variant="secondary"
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
              }
              onClick={() => setShowImportModal(true)}
            >
              Importar Excel
            </Button>
          )}
          {hasPermission('products:write') && (
            <Button
              variant="primary"
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              }
              onClick={() => setShowCreateModal(true)}
            >
              Nuevo Producto
            </Button>
          )}
        </div>
      </div>

      {/* Search and filters */}
      <div className="bg-white rounded-xl border border-neutral-200 p-4">
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
          </div>
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
        </div>
      </div>

      {/* Products grid/list */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {isLoading ? (
            Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 overflow-hidden animate-pulse">
                <div className="aspect-square bg-gray-100"></div>
                <div className="p-4 space-y-2">
                  <div className="h-3 bg-gray-100 rounded w-1/3"></div>
                  <div className="h-4 bg-gray-100 rounded w-full"></div>
                  <div className="h-3 bg-gray-100 rounded w-1/2"></div>
                </div>
              </div>
            ))
          ) : products?.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              <p className="text-gray-500 font-medium">No hay productos</p>
              <p className="text-gray-400 text-sm mt-1">Crea tu primer producto para comenzar</p>
            </div>
          ) : (
            products?.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onEdit={setEditingProduct}
                onToggleActive={toggleActive.mutate}
                onDelete={deleteProduct.mutate}
              />
            ))
          )}
        </div>
      ) : viewMode === 'list' ? (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
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
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-400">Cargando...</td>
                </tr>
              ) : products?.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-400">No hay productos</td>
                </tr>
              ) : (
                products?.map((product) => (
                  <ProductTableRow
                    key={product.id}
                    product={product}
                    onEdit={setEditingProduct}
                    onToggleActive={toggleActive.mutate}
                    onToggleVisibility={toggleVisibility.mutate}
                    onDelete={deleteProduct.mutate}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <ProductSpreadsheetTable
          products={products}
          isLoading={isLoading}
          onEdit={setEditingProduct}
          onToggleActive={toggleActive.mutate}
          onToggleVisibility={toggleVisibility.mutate}
          onDelete={deleteProduct.mutate}
        />
      )}

      {/* Pagination */}
      {total > 0 && (
        <div className="flex items-center justify-between bg-white rounded-xl border border-neutral-200 px-4 py-3">
          <p className="text-sm text-neutral-500">
            Página {page} de {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-4 py-2 text-sm font-medium border border-neutral-300 rounded-lg text-neutral-700 hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Anterior
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-4 py-2 text-sm font-medium border border-neutral-300 rounded-lg text-neutral-700 hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}

      {/* Modal */}
      {(showCreateModal || editingProduct) && (
        <ProductFormModal
          product={editingProduct}
          categories={categories || []}
          brands={brands || []}
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

      {/* Import Wizard Modal */}
      {showImportModal && (
        <ImportWizard
          onClose={() => setShowImportModal(false)}
          onComplete={() => {
            queryClient.invalidateQueries({ queryKey: ['products'] })
            setShowImportModal(false)
          }}
        />
      )}
    </div>
  )
}


