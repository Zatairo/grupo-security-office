import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../services/api'

interface Product {
  id: string
  sku: string
  name: string
  description: string | null
  categoryId: string
  brandId: string
  technicalSpecs: Record<string, any> | null
  isActive: boolean
  isVisible: boolean
  category: { id: string; name: string; slug: string }
  brand: { id: string; name: string; slug: string }
  images: Array<{ id: string; url: string; isPrimary: boolean }>
  prices: Array<{ id: string; value: number; currency: string; priceList: { id: string; name: string; code: string } }>
  createdAt: string
}

export default function ProductsPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table')

  const { data: products, isLoading } = useQuery({
    queryKey: ['products', search],
    queryFn: async () => {
      const params = new URLSearchParams()
      params.set('take', '100')
      if (search) params.set('search', search)
      const res = await api.get(`/products?${params}`)
      return res.data
    },
  })

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const res = await api.get('/categories')
      return res.data.data
    },
  })

  const { data: brands } = useQuery({
    queryKey: ['brands'],
    queryFn: async () => {
      const res = await api.get('/brands')
      return res.data.data
    },
  })

  const toggleVisibility = useMutation({
    mutationFn: (id: string) => api.patch(`/products/${id}/toggle-visibility`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['products'] }),
  })

  const toggleActive = useMutation({
    mutationFn: (id: string) => api.patch(`/products/${id}/toggle-active`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['products'] }),
  })

  const deleteProduct = useMutation({
    mutationFn: (id: string) => api.delete(`/products/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['products'] }),
  })

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Productos</h1>
          <p className="text-sm text-navy-500 mt-1">Gestiona tu catálogo de productos</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-navy-900 text-white rounded-xl font-medium hover:bg-navy-800 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nuevo Producto
        </button>
      </div>

      {/* Search and filters */}
      <div className="bg-white rounded-xl border border-navy-100 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-navy-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Buscar por nombre, SKU o descripción..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-navy-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-transparent"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('table')}
              className={`p-2.5 rounded-xl border transition-colors ${
                viewMode === 'table'
                  ? 'bg-navy-900 text-white border-navy-900'
                  : 'bg-white text-navy-500 border-navy-200 hover:bg-navy-50'
              }`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2.5 rounded-xl border transition-colors ${
                viewMode === 'grid'
                  ? 'bg-navy-900 text-white border-navy-900'
                  : 'bg-white text-navy-500 border-navy-200 hover:bg-navy-50'
              }`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Products list */}
      {viewMode === 'table' ? (
        <div className="bg-white rounded-xl border border-navy-100 overflow-hidden">
          <table className="min-w-full divide-y divide-navy-100">
            <thead className="bg-navy-50">
              <tr>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-navy-600 uppercase tracking-wider">Producto</th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-navy-600 uppercase tracking-wider">Categoría</th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-navy-600 uppercase tracking-wider">Marca</th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-navy-600 uppercase tracking-wider">Estado</th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-navy-600 uppercase tracking-wider">Visible</th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-navy-600 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-100">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="flex items-center justify-center gap-2 text-navy-400">
                      <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Cargando productos...
                    </div>
                  </td>
                </tr>
              ) : products?.data?.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <svg className="w-12 h-12 text-navy-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                    <p className="text-navy-500 font-medium">No hay productos</p>
                    <p className="text-navy-400 text-sm mt-1">Crea tu primer producto para comenzar</p>
                  </td>
                </tr>
              ) : (
                products?.data?.map((product: Product) => (
                  <tr key={product.id} className="hover:bg-navy-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-navy-100 rounded-lg flex items-center justify-center">
                          <svg className="w-5 h-5 text-navy-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-navy-900">{product.name}</p>
                          <p className="text-xs text-navy-400 font-mono">{product.sku}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-navy-600">{product.category?.name}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-navy-600">{product.brand?.name}</span>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => toggleActive.mutate(product.id)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full transition-colors ${
                          product.isActive
                            ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                            : 'bg-red-50 text-red-700 hover:bg-red-100'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${product.isActive ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                        {product.isActive ? 'Activo' : 'Inactivo'}
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => toggleVisibility.mutate(product.id)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full transition-colors ${
                          product.isVisible
                            ? 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                            : 'bg-navy-100 text-navy-600 hover:bg-navy-200'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${product.isVisible ? 'bg-blue-500' : 'bg-navy-400'}`}></span>
                        {product.isVisible ? 'Visible' : 'Oculto'}
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setEditingProduct(product)}
                          className="p-2 text-navy-400 hover:text-navy-600 hover:bg-navy-100 rounded-lg transition-colors"
                          title="Editar"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => {
                            if (confirm('¿Eliminar este producto?')) {
                              deleteProduct.mutate(product.id)
                            }
                          }}
                          className="p-2 text-navy-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title="Eliminar"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {isLoading ? (
            Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-navy-100 p-4 animate-pulse">
                <div className="w-full h-32 bg-navy-100 rounded-lg mb-4"></div>
                <div className="h-4 bg-navy-100 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-navy-100 rounded w-1/2"></div>
              </div>
            ))
          ) : products?.data?.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <svg className="w-12 h-12 text-navy-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              <p className="text-navy-500 font-medium">No hay productos</p>
            </div>
          ) : (
            products?.data?.map((product: Product) => (
              <div key={product.id} className="bg-white rounded-xl border border-navy-100 overflow-hidden hover:shadow-lg transition-shadow group">
                <div className="aspect-[4/3] bg-gradient-to-br from-navy-50 to-navy-100 flex items-center justify-center">
                  <svg className="w-16 h-16 text-navy-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <h3 className="text-sm font-semibold text-navy-900 line-clamp-1">{product.name}</h3>
                      <p className="text-xs text-navy-400 font-mono mt-0.5">{product.sku}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs text-navy-500">{product.category?.name}</span>
                    <span className="text-navy-300">·</span>
                    <span className="text-xs text-navy-500">{product.brand?.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleActive.mutate(product.id)}
                      className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                        product.isActive
                          ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          : 'bg-red-50 text-red-700 hover:bg-red-100'
                      }`}
                    >
                      {product.isActive ? 'Activo' : 'Inactivo'}
                    </button>
                    <button
                      onClick={() => setEditingProduct(product)}
                      className="p-2 text-navy-400 hover:text-navy-600 hover:bg-navy-100 rounded-lg transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Modal */}
      {(showCreateModal || editingProduct) && (
        <ProductModal
          product={editingProduct}
          categories={categories || []}
          brands={brands || []}
          onClose={() => {
            setShowCreateModal(false)
            setEditingProduct(null)
          }}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['products'] })
            setShowCreateModal(false)
            setEditingProduct(null)
          }}
        />
      )}
    </div>
  )
}

function ProductModal({
  product,
  categories,
  brands,
  onClose,
  onSuccess,
}: {
  product: Product | null
  categories: any[]
  brands: any[]
  onClose: () => void
  onSuccess: () => void
}) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState({
    sku: product?.sku || '',
    name: product?.name || '',
    description: product?.description || '',
    categoryId: product?.categoryId || '',
    brandId: product?.brandId || '',
    isActive: product?.isActive ?? false,
    isVisible: product?.isVisible ?? false,
  })

  const mutation = useMutation({
    mutationFn: async (data: typeof form) => {
      if (product) {
        return api.put(`/products/${product.id}`, data)
      }
      return api.post('/products', data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      onSuccess()
    },
  })

  return (
    <div className="fixed inset-0 bg-navy-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="px-6 py-4 border-b border-navy-100">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-navy-900">
              {product ? 'Editar Producto' : 'Nuevo Producto'}
            </h2>
            <button onClick={onClose} className="p-2 text-navy-400 hover:text-navy-600 hover:bg-navy-100 rounded-lg transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        
        <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(form) }} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-sm font-medium text-navy-700 mb-1.5">SKU</label>
              <input
                type="text"
                value={form.sku}
                onChange={(e) => setForm({ ...form, sku: e.target.value })}
                className="w-full px-3 py-2.5 border border-navy-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-transparent"
                required
              />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-sm font-medium text-navy-700 mb-1.5">Nombre</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2.5 border border-navy-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-transparent"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-navy-700 mb-1.5">Descripción</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full px-3 py-2.5 border border-navy-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-transparent resize-none"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-navy-700 mb-1.5">Categoría</label>
              <select
                value={form.categoryId}
                onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                className="w-full px-3 py-2.5 border border-navy-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-transparent"
                required
              >
                <option value="">Seleccionar...</option>
                {categories.map((cat: any) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-navy-700 mb-1.5">Marca</label>
              <select
                value={form.brandId}
                onChange={(e) => setForm({ ...form, brandId: e.target.value })}
                className="w-full px-3 py-2.5 border border-navy-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-transparent"
                required
              >
                <option value="">Seleccionar...</option>
                {brands.map((brand: any) => (
                  <option key={brand.id} value={brand.id}>{brand.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                className="w-4 h-4 text-navy-600 border-navy-300 rounded focus:ring-navy-500"
              />
              <span className="text-sm text-navy-700">Activo</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.isVisible}
                onChange={(e) => setForm({ ...form, isVisible: e.target.checked })}
                className="w-4 h-4 text-navy-600 border-navy-300 rounded focus:ring-navy-500"
              />
              <span className="text-sm text-navy-700">Visible</span>
            </label>
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t border-navy-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 border border-navy-200 text-navy-700 rounded-xl hover:bg-navy-50 font-medium transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="px-4 py-2.5 bg-navy-900 text-white rounded-xl hover:bg-navy-800 disabled:opacity-50 font-medium transition-colors flex items-center gap-2"
            >
              {mutation.isPending ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Guardando...
                </>
              ) : (
                'Guardar'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
