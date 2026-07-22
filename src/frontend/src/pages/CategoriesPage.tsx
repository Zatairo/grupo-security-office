import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../services/api'

export default function CategoriesPage() {
  const queryClient = useQueryClient()
  const [showCreateModal, setShowCreateModal] = useState(false)

  const { data: categories, isLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const res = await api.get('/categories')
      return res.data.data
    },
  })

  const deleteCategory = useMutation({
    mutationFn: (id: string) => api.delete(`/categories/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['categories'] }),
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-syscom-700">Categorías</h1>
          <p className="text-sm text-gray-500 mt-1">Organiza tu catálogo por categorías</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-accent-500 text-white rounded-lg font-semibold hover:bg-accent-600 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nueva Categoría
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gray-100 rounded-xl"></div>
                <div className="flex-1">
                  <div className="h-4 bg-gray-100 rounded w-1/2 mb-2"></div>
                  <div className="h-3 bg-gray-100 rounded w-1/3"></div>
                </div>
              </div>
            </div>
          ))
        ) : categories?.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
            <p className="text-gray-500 font-medium">No hay categorías</p>
          </div>
        ) : (
          categories?.map((cat: any) => (
            <div key={cat.id} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-syscom-50 rounded-xl flex items-center justify-center text-syscom-600">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">{cat.name}</h3>
                    <p className="text-xs text-gray-400 font-mono">{cat.slug}</p>
                  </div>
                </div>
                <button
                  onClick={() => { if (confirm('¿Eliminar esta categoría?')) deleteCategory.mutate(cat.id) }}
                  className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-gray-500">{cat.productCount || 0} productos</span>
                <span className={`px-2 py-1 text-xs font-medium rounded ${cat.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                  {cat.isActive ? 'Activa' : 'Inactiva'}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {showCreateModal && (
        <CategoryModal onClose={() => setShowCreateModal(false)} onSuccess={() => { queryClient.invalidateQueries({ queryKey: ['categories'] }); setShowCreateModal(false) }} />
      )}
    </div>
  )
}

function CategoryModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({ name: '', slug: '', description: '' })
  const mutation = useMutation({
    mutationFn: (data: typeof form) => api.post('/categories', data),
    onSuccess,
  })

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-lg shadow-2xl">
        <div className="px-6 py-4 border-b border-gray-200 bg-syscom-700 rounded-t-xl">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">Nueva Categoría</h2>
            <button onClick={onClose} className="p-2 text-syscom-200 hover:text-white hover:bg-syscom-600 rounded-lg transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(form) }} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Nombre</label>
            <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-syscom-500 focus:border-transparent" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Slug</label>
            <input type="text" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-syscom-500 focus:border-transparent" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Descripción</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-syscom-500 focus:border-transparent resize-none" rows={3} />
          </div>
          <div className="flex gap-3 justify-end pt-4 border-t border-gray-200">
            <button type="button" onClick={onClose} className="px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors">Cancelar</button>
            <button type="submit" disabled={mutation.isPending} className="px-4 py-2.5 bg-accent-500 text-white rounded-lg hover:bg-accent-600 disabled:opacity-50 font-semibold transition-colors">
              {mutation.isPending ? 'Creando...' : 'Crear'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
