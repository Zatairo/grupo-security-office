import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../services/api'
import { hasPermission } from '../lib/rbac'
import { getApiErrorMessage } from '../lib/apiError'

interface PriceList {
  id: string
  name: string
  code: string
  currency: string
  isActive: boolean
  validFrom: string | null
  validUntil: string | null
  priceCount: number
  prices?: Price[]
}

interface Price {
  id: string
  value: number
  currency: string
  validFrom: string | null
  validUntil: string | null
  product: { id: string; sku: string; name: string }
  priceList: { id: string; name: string; code: string }
}

interface Product {
  id: string
  sku: string
  name: string
}

export default function PricesPage() {
  const queryClient = useQueryClient()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingList, setEditingList] = useState<PriceList | null>(null)
  const [selectedList, setSelectedList] = useState<PriceList | null>(null)
  const [showAddPriceModal, setShowAddPriceModal] = useState(false)
  const [editingPrice, setEditingPrice] = useState<Price | null>(null)

  const { data: priceLists, isLoading } = useQuery({
    queryKey: ['priceLists'],
    queryFn: async () => {
      const res = await api.get('/prices/lists')
      return res.data.data
    },
  })

  const { data: selectedListDetail } = useQuery({
    queryKey: ['priceList', selectedList?.id],
    queryFn: async () => {
      const res = await api.get(`/prices/lists/${selectedList!.id}`)
      return res.data
    },
    enabled: !!selectedList,
  })

  const { data: products } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const res = await api.get('/products?take=1000')
      return res.data.data
    },
  })

  const deleteList = useMutation({
    mutationFn: (id: string) => api.delete(`/prices/lists/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['priceLists'] })
      setSelectedList(null)
    },
  })

  const deletePrice = useMutation({
    mutationFn: (id: string) => api.delete(`/prices/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['priceList'] })
      queryClient.invalidateQueries({ queryKey: ['priceLists'] })
    },
  })

  const toggleList = useMutation({
    mutationFn: (id: string) => api.patch(`/prices/lists/${id}/toggle-active`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['priceLists'] })
      queryClient.invalidateQueries({ queryKey: ['priceList'] })
    },
  })

  const formatCurrency = (value: number, currency: string = 'COP') => {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value)
  }

  const formatDate = (date: string | null) => {
    if (!date) return '—'
    return new Date(date).toLocaleDateString('es-CO')
  }

  if (selectedList) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button onClick={() => setSelectedList(null)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-security-700">{selectedList.name}</h1>
            <p className="text-sm text-gray-500 mt-1">Código: <span className="font-mono">{selectedList.code}</span> · {selectedList.priceCount ?? 0} precios</p>
          </div>
          {hasPermission('prices:write') && (
            <button onClick={() => setShowAddPriceModal(true)} className="inline-flex items-center gap-2 px-4 py-2.5 bg-security-500 text-white rounded-lg font-semibold hover:bg-security-600 transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Agregar Precio
            </button>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
            <div className="grid grid-cols-12 gap-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              <div className="col-span-3">SKU</div>
              <div className="col-span-4">Producto</div>
              <div className="col-span-2">Precio</div>
              <div className="col-span-2">Vigencia</div>
              <div className="col-span-1"></div>
            </div>
          </div>
          <div className="divide-y divide-gray-100">
            {selectedListDetail?.prices?.length === 0 ? (
              <div className="text-center py-12">
                <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-gray-500 font-medium">No hay precios en esta lista</p>
                <p className="text-sm text-gray-400 mt-1">Agrega precios para productos</p>
              </div>
            ) : (
              selectedListDetail?.prices?.map((price: Price) => (
                <div key={price.id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                  <div className="grid grid-cols-12 gap-4 items-center">
                    <div className="col-span-3">
                      <span className="text-sm font-mono text-gray-600">{price.product.sku}</span>
                    </div>
                    <div className="col-span-4">
                      <span className="text-sm font-medium text-gray-900">{price.product.name}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-sm font-bold text-security-700">{formatCurrency(price.value, price.currency)}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-xs text-gray-500">{formatDate(price.validFrom)} — {formatDate(price.validUntil)}</span>
                    </div>
                    <div className="col-span-1 flex justify-end gap-1">
                      {hasPermission('prices:write') && (
                        <button onClick={() => setEditingPrice(price)} className="p-1.5 text-gray-400 hover:text-security-600 hover:bg-security-50 rounded transition-colors">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                      )}
                      {hasPermission('prices:delete') && (
                        <button onClick={() => { if (confirm('¿Eliminar este precio?')) deletePrice.mutate(price.id) }} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {showAddPriceModal && (
          <PriceModal
            priceListId={selectedList.id}
            priceListName={selectedList.name}
            products={products || []}
            onClose={() => setShowAddPriceModal(false)}
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ['priceList'] })
              queryClient.invalidateQueries({ queryKey: ['priceLists'] })
              setShowAddPriceModal(false)
            }}
          />
        )}

        {editingPrice && (
          <PriceModal
            priceListId={selectedList.id}
            priceListName={selectedList.name}
            products={products || []}
            price={editingPrice}
            onClose={() => setEditingPrice(null)}
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ['priceList'] })
              queryClient.invalidateQueries({ queryKey: ['priceLists'] })
              setEditingPrice(null)
            }}
          />
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-security-700">Listas de Precios</h1>
          <p className="text-sm text-gray-500 mt-1">Gestiona las listas de precios del catálogo</p>
        </div>
        {hasPermission('prices:write') && (
          <button onClick={() => setShowCreateModal(true)} className="inline-flex items-center gap-2 px-4 py-2.5 bg-security-500 text-white rounded-lg font-semibold hover:bg-security-600 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nueva Lista
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
        ) : priceLists?.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-gray-500 font-medium">No hay listas de precios</p>
            <p className="text-sm text-gray-400 mt-1">Crea una lista para empezar a asignar precios</p>
          </div>
        ) : (
          priceLists?.map((list: PriceList) => (
            <div key={list.id} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-lg transition-shadow cursor-pointer" onClick={() => setSelectedList(list)}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">{list.name}</h3>
                    <p className="text-xs text-gray-400 font-mono">{list.code}</p>
                  </div>
                </div>
                {hasPermission('prices:delete') && (
                  <button onClick={(e) => { e.stopPropagation(); if (confirm('¿Eliminar esta lista de precios?')) deleteList.mutate(list.id) }} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
              <div className="flex items-center justify-between text-xs text-gray-500">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                    {list.priceCount} precios
                  </span>
                  <span>{list.currency}</span>
                </div>
                {hasPermission('prices:write') ? (
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleList.mutate(list.id) }}
                    className="flex items-center gap-2"
                    aria-pressed={list.isActive}
                    title={list.isActive ? 'Desactivar lista' : 'Activar lista'}
                  >
                    <span className={`w-9 h-5 rounded-full relative transition-colors ${list.isActive ? 'bg-emerald-500' : 'bg-gray-300'}`}>
                      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${list.isActive ? 'left-4' : 'left-0.5'}`} />
                    </span>
                    <span className={`text-xs font-medium ${list.isActive ? 'text-emerald-700' : 'text-gray-500'}`}>
                      {list.isActive ? 'Activa' : 'Inactiva'}
                    </span>
                  </button>
                ) : (
                  <span className={`px-2 py-1 text-xs font-medium rounded ${list.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                    {list.isActive ? 'Activa' : 'Inactiva'}
                  </span>
                )}
              </div>
              {(list.validFrom || list.validUntil) && (
                <div className="mt-2 pt-2 border-t border-gray-100 text-xs text-gray-400">
                  Vigente: {formatDate(list.validFrom)} — {formatDate(list.validUntil)}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {showCreateModal && (
        <PriceListModal onClose={() => setShowCreateModal(false)} onSuccess={() => { queryClient.invalidateQueries({ queryKey: ['priceLists'] }); setShowCreateModal(false) }} />
      )}

      {editingList && (
        <PriceListModal list={editingList} onClose={() => setEditingList(null)} onSuccess={() => { queryClient.invalidateQueries({ queryKey: ['priceLists'] }); setEditingList(null) }} />
      )}
    </div>
  )
}

function PriceListModal({ list, onClose, onSuccess }: { list?: PriceList; onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({
    name: list?.name || '',
    code: list?.code || '',
    currency: list?.currency || 'COP',
    isActive: list?.isActive ?? true,
    validFrom: list?.validFrom?.split('T')[0] || '',
    validUntil: list?.validUntil?.split('T')[0] || '',
  })
  const [formError, setFormError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: (data: typeof form) => {
      const payload = { ...data, validFrom: data.validFrom || undefined, validUntil: data.validUntil || undefined }
      return list ? api.put(`/prices/lists/${list.id}`, payload) : api.post('/prices/lists', payload)
    },
    onSuccess,
    onError: (error) => setFormError(getApiErrorMessage(error, 'No se pudo guardar la lista de precios')),
  })

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    mutation.mutate(form)
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-lg shadow-2xl">
        <div className="px-6 py-4 border-b border-gray-200 bg-security-700 rounded-t-xl">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">{list ? 'Editar Lista' : 'Nueva Lista de Precios'}</h2>
            <button onClick={onClose} className="p-2 text-security-200 hover:text-white hover:bg-security-600 rounded-lg transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          {formError && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2.5 text-sm" role="alert">
              {formError}
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Nombre</label>
              <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary" required placeholder="Ej: Lista Mayorista" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Código</label>
              <input type="text" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary font-mono" required placeholder="MAYORISTA" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Moneda</label>
              <select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary">
                <option value="COP">COP - Peso Colombiano</option>
                <option value="USD">USD - Dólar</option>
                <option value="EUR">EUR - Euro</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Vigencia desde</label>
              <input type="date" value={form.validFrom} onChange={(e) => setForm({ ...form, validFrom: e.target.value })} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Vigencia hasta</label>
              <input type="date" value={form.validUntil} onChange={(e) => setForm({ ...form, validUntil: e.target.value })} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary" />
            </div>
            <div className="col-span-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="w-4 h-4 text-security-600 border-gray-300 rounded focus:ring-brand-primary/30" />
                <span className="text-sm font-medium text-gray-700">Lista activa</span>
              </label>
            </div>
          </div>
          <div className="flex gap-3 justify-end pt-4 border-t border-gray-200">
            <button type="button" onClick={onClose} className="px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors">Cancelar</button>
            <button type="submit" disabled={mutation.isPending} className="px-4 py-2.5 bg-security-500 text-white rounded-lg hover:bg-security-600 disabled:opacity-50 font-semibold transition-colors">
              {mutation.isPending ? 'Guardando...' : list ? 'Actualizar' : 'Crear'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function PriceModal({ priceListId, priceListName, products, price, onClose, onSuccess }: { priceListId: string; priceListName: string; products: Product[]; price?: Price; onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({
    productId: price?.product?.id || '',
    value: price?.value?.toString() || '',
    currency: price?.currency || 'COP',
    validFrom: price?.validFrom?.split('T')[0] || '',
    validUntil: price?.validUntil?.split('T')[0] || '',
  })

  const mutation = useMutation({
    mutationFn: (data: typeof form) => {
      const payload = {
        productId: data.productId,
        priceListId,
        value: parseFloat(data.value),
        currency: data.currency,
        validFrom: data.validFrom || undefined,
        validUntil: data.validUntil || undefined,
      }
      return price ? api.put(`/prices/${price.id}`, payload) : api.post('/prices', payload)
    },
    onSuccess,
  })

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-lg shadow-2xl">
        <div className="px-6 py-4 border-b border-gray-200 bg-security-700 rounded-t-xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white">{price ? 'Editar Precio' : 'Agregar Precio'}</h2>
              <p className="text-security-200 text-sm">{priceListName}</p>
            </div>
            <button onClick={onClose} className="p-2 text-security-200 hover:text-white hover:bg-security-600 rounded-lg transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(form) }} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Producto</label>
            <select value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary" required disabled={!!price}>
              <option value="">Seleccionar producto...</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>
              ))}
            </select>
            {price && <p className="text-xs text-gray-400 mt-1">No se puede cambiar el producto</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Precio</label>
              <input type="number" step="0.01" min="0" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary" required placeholder="0" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Moneda</label>
              <select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary">
                <option value="COP">COP</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Vigencia desde</label>
              <input type="date" value={form.validFrom} onChange={(e) => setForm({ ...form, validFrom: e.target.value })} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Vigencia hasta</label>
              <input type="date" value={form.validUntil} onChange={(e) => setForm({ ...form, validUntil: e.target.value })} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary" />
            </div>
          </div>
          <div className="flex gap-3 justify-end pt-4 border-t border-gray-200">
            <button type="button" onClick={onClose} className="px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors">Cancelar</button>
            <button type="submit" disabled={mutation.isPending} className="px-4 py-2.5 bg-security-500 text-white rounded-lg hover:bg-security-600 disabled:opacity-50 font-semibold transition-colors">
              {mutation.isPending ? 'Guardando...' : price ? 'Actualizar' : 'Agregar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
