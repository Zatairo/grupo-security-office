import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../../services/api'
import type { Product, Category, Brand } from '../types/product.types'

interface ProductFormModalProps {
  product: Product | null
  categories: Category[]
  brands: Brand[]
  onClose: () => void
  onSaved: () => void
}

export default function ProductFormModal({
  product,
  categories,
  brands,
  onClose,
  onSaved,
}: ProductFormModalProps) {
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
      onSaved()
    },
  })

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-lg shadow-2xl">
        <div className="px-6 py-4 border-b border-gray-200 bg-security-700 rounded-t-xl">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">
              {product ? 'Editar Producto' : 'Nuevo Producto'}
            </h2>
            <button onClick={onClose} className="p-2 text-security-200 hover:text-white hover:bg-security-600 rounded-lg transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        
        <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(form) }} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">SKU</label>
              <input
                type="text"
                value={form.sku}
                onChange={(e) => setForm({ ...form, sku: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
                required
              />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Nombre</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Descripción</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary resize-none"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Categoría</label>
              <select
                value={form.categoryId}
                onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
                required
              >
                <option value="">Seleccionar...</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Marca</label>
              <select
                value={form.brandId}
                onChange={(e) => setForm({ ...form, brandId: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
                required
              >
                <option value="">Seleccionar...</option>
                {brands.map((brand) => (
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
                className="w-4 h-4 text-security-600 border-gray-300 rounded focus:ring-brand-primary/30 focus:border-brand-primary"
              />
              <span className="text-sm text-gray-700">Activo</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.isVisible}
                onChange={(e) => setForm({ ...form, isVisible: e.target.checked })}
                className="w-4 h-4 text-security-600 border-gray-300 rounded focus:ring-brand-primary/30 focus:border-brand-primary"
              />
              <span className="text-sm text-gray-700">Visible</span>
            </label>
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="px-4 py-2.5 bg-security-500 text-white rounded-lg hover:bg-security-600 disabled:opacity-50 font-semibold transition-colors flex items-center gap-2"
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
