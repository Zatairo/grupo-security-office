import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../services/api'
import { hasPermission } from '../lib/rbac'

export default function BrandsPage() {
  const queryClient = useQueryClient()
  const [showCreateModal, setShowCreateModal] = useState(false)

  const { data: brands, isLoading } = useQuery({
    queryKey: ['brands'],
    queryFn: async () => {
      const res = await api.get('/brands')
      return res.data.data
    },
  })

  const deleteBrand = useMutation({
    mutationFn: (id: string) => api.delete(`/brands/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['brands'] }),
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-security-700">Marcas</h1>
          <p className="text-sm text-gray-500 mt-1">Gestiona las marcas de productos</p>
        </div>
        {hasPermission('brands:write') && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-security-500 text-white rounded-lg font-semibold hover:bg-security-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nueva Marca
          </button>
        )}
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
        ) : brands?.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            <p className="text-gray-500 font-medium">No hay marcas</p>
          </div>
        ) : (
          brands?.map((brand: any) => (
            <div key={brand.id} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">{brand.name}</h3>
                    <p className="text-xs text-gray-400 font-mono">{brand.slug}</p>
                  </div>
                </div>
                {hasPermission('brands:delete') && (
                  <button
                    onClick={() => { if (confirm('¿Eliminar esta marca?')) deleteBrand.mutate(brand.id) }}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-gray-500">{brand.productCount || 0} productos</span>
                <span className={`px-2 py-1 text-xs font-medium rounded ${brand.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                  {brand.isActive ? 'Activa' : 'Inactiva'}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {showCreateModal && (
        <BrandModal onClose={() => setShowCreateModal(false)} onSuccess={() => { queryClient.invalidateQueries({ queryKey: ['brands'] }); setShowCreateModal(false) }} />
      )}
    </div>
  )
}

function BrandModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({ name: '', slug: '', description: '' })
  const mutation = useMutation({
    mutationFn: (data: typeof form) => api.post('/brands', data),
    onSuccess,
  })

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-lg shadow-2xl">
        <div className="px-6 py-4 border-b border-gray-200 bg-security-700 rounded-t-xl">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">Nueva Marca</h2>
            <button onClick={onClose} className="p-2 text-security-200 hover:text-white hover:bg-security-600 rounded-lg transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(form) }} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Nombre</label>
            <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Slug</label>
            <input type="text" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Descripción</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary resize-none" rows={3} />
          </div>
          <div className="flex gap-3 justify-end pt-4 border-t border-gray-200">
            <button type="button" onClick={onClose} className="px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors">Cancelar</button>
            <button type="submit" disabled={mutation.isPending} className="px-4 py-2.5 bg-security-500 text-white rounded-lg hover:bg-security-600 disabled:opacity-50 font-semibold transition-colors">
              {mutation.isPending ? 'Creando...' : 'Crear'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
