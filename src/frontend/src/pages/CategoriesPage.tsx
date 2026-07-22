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
          <h1 className="text-2xl font-bold text-navy-900">Categorías</h1>
          <p className="text-sm text-navy-500 mt-1">Organiza tu catálogo por categorías</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-navy-900 text-white rounded-xl font-medium hover:bg-navy-800 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nueva Categoría
        </button>
      </div>

      <div className="bg-white rounded-xl border border-navy-100 overflow-hidden">
        <table className="min-w-full divide-y divide-navy-100">
          <thead className="bg-navy-50">
            <tr>
              <th className="px-6 py-3.5 text-left text-xs font-semibold text-navy-600 uppercase tracking-wider">Nombre</th>
              <th className="px-6 py-3.5 text-left text-xs font-semibold text-navy-600 uppercase tracking-wider">Slug</th>
              <th className="px-6 py-3.5 text-left text-xs font-semibold text-navy-600 uppercase tracking-wider">Productos</th>
              <th className="px-6 py-3.5 text-left text-xs font-semibold text-navy-600 uppercase tracking-wider">Estado</th>
              <th className="px-6 py-3.5 text-left text-xs font-semibold text-navy-600 uppercase tracking-wider">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-navy-100">
            {isLoading ? (
              <tr><td colSpan={5} className="px-6 py-12 text-center text-navy-400">Cargando...</td></tr>
            ) : categories?.length === 0 ? (
              <tr><td colSpan={5} className="px-6 py-12 text-center text-navy-400">No hay categorías</td></tr>
            ) : (
              categories?.map((cat: any) => (
                <tr key={cat.id} className="hover:bg-navy-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-violet-50 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5 text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                        </svg>
                      </div>
                      <span className="text-sm font-semibold text-navy-900">{cat.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-navy-500 font-mono">{cat.slug}</td>
                  <td className="px-6 py-4 text-sm text-navy-600">{cat.productCount || 0}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full ${cat.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${cat.isActive ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                      {cat.isActive ? 'Activa' : 'Inactiva'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => { if (confirm('¿Eliminar esta categoría?')) deleteCategory.mutate(cat.id) }}
                      className="p-2 text-navy-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
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
    <div className="fixed inset-0 bg-navy-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="px-6 py-4 border-b border-navy-100">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-navy-900">Nueva Categoría</h2>
            <button onClick={onClose} className="p-2 text-navy-400 hover:text-navy-600 hover:bg-navy-100 rounded-lg transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(form) }} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-navy-700 mb-1.5">Nombre</label>
            <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2.5 border border-navy-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-transparent" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-navy-700 mb-1.5">Slug</label>
            <input type="text" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} className="w-full px-3 py-2.5 border border-navy-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-transparent" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-navy-700 mb-1.5">Descripción</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full px-3 py-2.5 border border-navy-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-transparent resize-none" rows={3} />
          </div>
          <div className="flex gap-3 justify-end pt-4 border-t border-navy-100">
            <button type="button" onClick={onClose} className="px-4 py-2.5 border border-navy-200 text-navy-700 rounded-xl hover:bg-navy-50 font-medium transition-colors">Cancelar</button>
            <button type="submit" disabled={mutation.isPending} className="px-4 py-2.5 bg-navy-900 text-white rounded-xl hover:bg-navy-800 disabled:opacity-50 font-medium transition-colors">
              {mutation.isPending ? 'Creando...' : 'Crear'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
