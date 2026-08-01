import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import ImportWizard from '../features/products/import/components/ImportWizard'
import { IMPORT_WIZARD_STORAGE_KEY } from '../features/products/import/store/import.store'
import type { Product } from '../features/products/types/product.types'
import { useProducts } from '../features/products/hooks/useProducts'
import { useProductMutations } from '../features/products/hooks/useProductMutations'
import { ProductCard } from '../features/products/components/ProductCard'
import { ProductTableRow } from '../features/products/components/ProductTableRow'
import ProductFormModal from '../features/products/components/ProductFormModal'
import { hasPermission } from '../lib/rbac'
import { Button } from '../components/ui'

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
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(hasPersistedImportState)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  const { products, categories, brands, isLoading } = useProducts(search)
  const { toggleVisibility, toggleActive, deleteProduct } = useProductMutations()

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
        <div className="flex flex-col sm:flex-row gap-4">
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
          ) : products?.data?.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              <p className="text-gray-500 font-medium">No hay productos</p>
              <p className="text-gray-400 text-sm mt-1">Crea tu primer producto para comenzar</p>
            </div>
          ) : (
            products?.data?.map((product) => (
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
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Producto</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Categoría</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Marca</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Estado</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-400">Cargando...</td>
                </tr>
              ) : products?.data?.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-400">No hay productos</td>
                </tr>
              ) : (
                products?.data?.map((product) => (
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


