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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Productos</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Nuevo Producto
        </button>
      </div>

      <div className="bg-white p-4 rounded-lg shadow">
        <input
          type="text"
          placeholder="Buscar por nombre, SKU o descripción..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nombre</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Categoría</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Marca</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Visible</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-6 py-4 text-center text-gray-500">Cargando...</td>
              </tr>
            ) : products?.data?.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-4 text-center text-gray-500">No hay productos</td>
              </tr>
            ) : (
              products?.data?.map((product: Product) => (
                <tr key={product.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-mono text-gray-900">{product.sku}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{product.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{product.category?.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{product.brand?.name}</td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => toggleActive.mutate(product.id)}
                      className={`px-2 py-1 text-xs rounded-full ${
                        product.isActive
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {product.isActive ? 'Activo' : 'Inactivo'}
                    </button>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => toggleVisibility.mutate(product.id)}
                      className={`px-2 py-1 text-xs rounded-full ${
                        product.isVisible
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {product.isVisible ? 'Visible' : 'Oculto'}
                    </button>
                  </td>
                  <td className="px-6 py-4 text-sm space-x-2">
                    <button
                      onClick={() => setEditingProduct(product)}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('¿Eliminar este producto?')) {
                          deleteProduct.mutate(product.id)
                        }
                      }}
                      className="text-red-600 hover:text-red-800"
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-lg font-semibold mb-4">
          {product ? 'Editar Producto' : 'Nuevo Producto'}
        </h2>
        
        <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(form) }} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">SKU</label>
            <input
              type="text"
              value={form.sku}
              onChange={(e) => setForm({ ...form, sku: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Nombre</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Descripción</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              rows={3}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Categoría</label>
            <select
              value={form.categoryId}
              onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">Seleccionar...</option>
              {categories.map((cat: any) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Marca</label>
            <select
              value={form.brandId}
              onChange={(e) => setForm({ ...form, brandId: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">Seleccionar...</option>
              {brands.map((brand: any) => (
                <option key={brand.id} value={brand.id}>{brand.name}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                className="rounded"
              />
              <span className="text-sm">Activo</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.isVisible}
                onChange={(e) => setForm({ ...form, isVisible: e.target.checked })}
                className="rounded"
              />
              <span className="text-sm">Visible</span>
            </label>
          </div>

          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded-lg hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {mutation.isPending ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
