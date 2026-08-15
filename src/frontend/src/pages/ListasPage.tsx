import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  fetchListas,
  createLista,
  updateLista,
  toggleListaActive,
  archiveLista,
  restoreLista,
  productCountOf,
  type Lista,
  type ListaPayload,
} from '../services/listas.service'
import { canCreateLista, canManageListas, hasPermission } from '../lib/rbac'
import { getApiErrorMessage } from '../lib/apiError'
import { formatDate } from '../lib/format'
import { Button } from '../components/ui'
import { fetchUsers, type UserListItem } from '../services/users.service'
import ImportWizard from '../features/products/import/components/ImportWizard'
import { hasPersistedImportState } from '../features/products/import/store/import.store'

const CURRENCIES = ['COP', 'USD', 'EUR'] as const
const LISTA_TYPES = ['mayorista', 'detalle', 'oro', 'platino', 'instalador', 'tienda'] as const

function StatusBadge({ isActive, archived }: { isActive: boolean; archived: boolean }) {
  let label = isActive ? 'Activo' : 'Inactivo'
  let cls = isActive
    ? 'bg-emerald-100 text-emerald-700'
    : 'bg-red-100 text-red-700'
  if (archived) {
    label = 'Archivado'
    cls = 'bg-neutral-100 text-neutral-600'
  }
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full ${cls}`}
      aria-label={label}
    >
      {label}
    </span>
  )
}

export default function ListasPage() {
  const queryClient = useQueryClient()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingLista, setEditingLista] = useState<Lista | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState<boolean | 'all'>('all')
  const [showImportModal, setShowImportModal] = useState(hasPersistedImportState)

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['listas'] })

  const { data: listas, isLoading, error } = useQuery({
    queryKey: ['listas'],
    queryFn: fetchListas,
  })

  const filtered = useMemo(() => {
    if (!listas) return []
    return listas.filter((l) => {
      const matchesSearch =
        search.trim() ===
          '' ||
        l.name.toLowerCase().includes(search.toLowerCase()) ||
        l.code.toLowerCase().includes(search.toLowerCase())
      const matchesState =
        activeFilter === 'all' || l.isActive === activeFilter
      return matchesSearch && matchesState
    })
  }, [listas, search, activeFilter])

  const toggleMutation = useMutation({
    mutationFn: (lista: Lista) => toggleListaActive(lista.id, !lista.isActive),
    onSuccess: () => {
      invalidate()
      setActionError(null)
    },
    onError: (err) => setActionError(getApiErrorMessage(err, 'No se pudo cambiar el estado de la Lista')),
  })

  const archiveMutation = useMutation({
    mutationFn: (id: string) => archiveLista(id),
    onSuccess: () => {
      invalidate()
      setActionError(null)
    },
    onError: (err) => setActionError(getApiErrorMessage(err, 'No se pudo archivar la Lista')),
  })

  const restoreMutation = useMutation({
    mutationFn: (id: string) => restoreLista(id),
    onSuccess: () => {
      invalidate()
      setActionError(null)
    },
    onError: (err) => setActionError(getApiErrorMessage(err, 'No se pudo restaurar la Lista')),
  })

  const listError = error ? getApiErrorMessage(error, 'No se pudieron cargar las Listas') : null

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-condensed font-bold text-security-800">Listas</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Gestión de listas comerciales. Lista es la raíz de productos, precios y permisos.
          </p>
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
              Importar desde Excel
            </Button>
          )}
          {canCreateLista() && (
            <Button
              variant="primary"
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              }
              onClick={() => {
                setActionError(null)
                setEditingLista(null)
                setShowCreateModal(true)
              }}
            >
              Nueva Lista
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Buscar por nombre o código..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-focus-ring)] focus:border-[var(--color-primary)] text-sm"
          />
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <div className="flex gap-1.5 bg-neutral-100 rounded-lg p-1 text-xs font-medium text-neutral-600">
          <button
            onClick={() => setActiveFilter('all')}
            className={`px-3 py-1.5 rounded ${activeFilter === 'all' ? 'bg-white shadow text-neutral-800' : ''}`}
          >
            Todas
          </button>
          <button
            onClick={() => setActiveFilter(true)}
            className={`px-3 py-1.5 rounded ${activeFilter === true ? 'bg-white shadow text-neutral-800' : ''}`}
          >
            Activas
          </button>
          <button
            onClick={() => setActiveFilter(false)}
            className={`px-3 py-1.5 rounded ${activeFilter === false ? 'bg-white shadow text-neutral-800' : ''}`}
          >
            Inactivas
          </button>
        </div>
      </div>

      {actionError && (
        <div className="flex items-start gap-3 p-3.5 rounded-lg border text-sm bg-red-50 border-red-200 text-red-800" role="alert">
          <span className="flex-1">{actionError}</span>
          <button onClick={() => setActionError(null)} className="p-0.5 rounded hover:bg-red-100/60" aria-label="Cerrar" />
        </div>
      )}

      {listError && (
        <div className="flex items-start gap-3 p-3.5 rounded-lg border text-sm bg-red-50 border-red-200 text-red-800" role="alert">
          <span className="flex-1">{listError}</span>
        </div>
      )}

      <div className="space-y-3">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-neutral-200 p-5 animate-pulse">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-neutral-100 rounded w-1/3"></div>
                    <div className="h-3 bg-neutral-100 rounded w-1/4"></div>
                  </div>
                  <div className="h-6 bg-neutral-100 rounded-full w-20"></div>
                </div>
              </div>
            ))
          : filtered.length === 0 ? (
            <div className="bg-white rounded-xl border border-neutral-200 text-center py-16">
              <svg className="w-16 h-16 text-neutral-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <p className="text-neutral-500 font-medium">No tienes Listas asignadas</p>
              <p className="text-neutral-400 text-sm mt-1">
                {search || activeFilter !== 'all'
                  ? 'Intenta ajustar los filtros de búsqueda.'
                  : 'No tienes permisos para ver ninguna Lista. Contacta al administrador.'}
              </p>
            </div>
          ) : (
            filtered.map((lista) => (
              <div
                key={lista.id}
                className="bg-white rounded-xl border border-neutral-200 p-5 hover:shadow-lg transition-shadow"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-12 h-12 bg-[var(--color-primary-bg-subtle)] rounded-xl flex items-center justify-center text-[var(--color-primary)] flex-shrink-0">
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <Link
                        to={`/commercial/lists/${lista.id}`}
                        className="text-sm font-semibold text-gray-900 hover:text-[var(--color-primary)] focus:outline-none"
                      >
                        {lista.name}
                      </Link>
                      <p className="text-xs text-neutral-400 font-mono">{lista.code} · {lista.currency}</p>
                      {lista.description && (
                        <p className="text-sm text-neutral-500 mt-1 line-clamp-2">{lista.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <StatusBadge isActive={lista.isActive} archived={lista.archivedAt !== null} />
                    <span className="text-xs text-neutral-500 whitespace-nowrap">
                      {productCountOf(lista)} producto(s)
                    </span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-neutral-100 flex flex-wrap items-center justify-between gap-3">
                  <span className="text-xs text-neutral-400">Actualizado: {formatDate(lista.updatedAt)}</span>
                  <div className="flex items-center gap-1">
                    {canManageListas() && !lista.archivedAt && (
                      <>
                        <button
                          onClick={() => {
                            setActionError(null)
                            setEditingLista(lista)
                            setShowCreateModal(true)
                          }}
                          className="p-2 text-neutral-400 hover:text-[var(--color-primary)] hover:bg-[var(--color-primary-bg-subtle)] rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus-ring)]"
                          title="Editar Lista"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => {
                            setActionError(null)
                            toggleMutation.mutate(lista)
                          }}
                          className="p-2 text-neutral-400 hover:text-[var(--color-primary)] hover:bg-[var(--color-primary-bg-subtle)] rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus-ring)]"
                          title={lista.isActive ? 'Desactivar Lista' : 'Activar Lista'}
                          aria-label={lista.isActive ? 'Desactivar Lista' : 'Activar Lista'}
                        >
                          {lista.isActive ? (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636M12 3a9 9 0 019 9 9 9 0 01-9 9 9 9 0 01-9-9 9 9 0 019-9z" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.478 0-8.268-2.943-9.542-7z" />
                            </svg>
                          )}
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm('¿Archivar esta Lista? No se podrán crear productos nuevos mientras esté archivada.')) {
                              archiveMutation.mutate(lista.id)
                            }
                          }}
                          className="p-2 text-neutral-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus-ring)]"
                          title="Archivar Lista"
                          aria-label="Archivar Lista"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 7v10a2 2 0 002 2h10a2 2 0 012-2V7M9 12h6" />
                          </svg>
                        </button>
                      </>
                    )}
                    {canManageListas() && lista.archivedAt && (
                      <button
                        onClick={() => restoreMutation.mutate(lista.id)}
                        className="p-2 text-neutral-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus-ring)]"
                        title="Restaurar Lista"
                        aria-label="Restaurar Lista"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h4l3-3m0 0l-3 3m3-3v10a2 2 0 002 2h1.07m-7.43 0a2 2 0 01-.58-1.4l-2-8M7 17h10a2 2 0 012 2v2" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
      </div>

      {(showCreateModal || editingLista) && (
        <ListasFormModal
          lista={editingLista}
          onClose={() => {
            setShowCreateModal(false)
            setEditingLista(null)
          }}
          onSaved={() => {
            invalidate()
            setShowCreateModal(false)
            setEditingLista(null)
          }}
          onError={(err) => setActionError(getApiErrorMessage(err, 'No se pudo guardar la Lista'))}
        />
      )}

      {showImportModal && (
        <ImportWizard
          onClose={() => setShowImportModal(false)}
          onComplete={() => {
            queryClient.invalidateQueries({ queryKey: ['products'] })
            queryClient.invalidateQueries({ queryKey: ['listas'] })
            setShowImportModal(false)
          }}
        />
      )}
    </div>
  )
}

function ListasFormModal({
  lista,
  onClose,
  onSaved,
  onError,
}: {
  lista?: Lista | null
  onClose: () => void
  onSaved: () => void
  onError: (error: unknown) => void
}) {
  const [form, setForm] = useState<ListaPayload>({
    name: lista?.name || '',
    code: lista?.code || '',
    description: lista?.description ?? null,
    currency: lista?.currency || 'COP',
    isActive: lista?.isActive ?? true,
    type: lista?.type ?? '',
    defaultVisibility: lista?.defaultVisibility ?? false,
    responsibleId: lista?.responsibleId ?? '',
    validFrom: lista?.validFrom ? lista.validFrom.slice(0, 10) : '',
    validUntil: lista?.validUntil ? lista.validUntil.slice(0, 10) : '',
  })
  const [formError, setFormError] = useState<string | null>(null)
  const isEditing = Boolean(lista)

  const { data: users, isLoading: isLoadingUsers } = useQuery({
    queryKey: ['users'],
    queryFn: () => fetchUsers(),
  })
  const usersList = (users ?? []) as UserListItem[]

  const mutation = useMutation({
    mutationFn: (payload: ListaPayload) =>
      isEditing && lista ? updateLista(lista.id, payload) : createLista(payload),
    onSuccess: onSaved,
    onError: (err) => {
      setFormError(getApiErrorMessage(err, 'No se pudo guardar la Lista'))
      onError(err)
    },
  })

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    const payload: ListaPayload = {
      name: form.name.trim(),
      code: form.code.trim(),
      description: form.description?.trim() || null,
      currency: form.currency,
      isActive: form.isActive,
      type: form.type || null,
      defaultVisibility: form.defaultVisibility ?? false,
      responsibleId: form.responsibleId || null,
      validFrom: form.validFrom || null,
      validUntil: form.validUntil || null,
    }
    if (payload.name.length < 2 || payload.code.length < 2) {
      setFormError('Nombre y código deben tener al menos 2 caracteres')
      return
    }
    if (payload.validFrom && payload.validUntil && payload.validFrom > payload.validUntil) {
      setFormError('La fecha de inicio de vigencia no puede ser posterior a la de fin')
      return
    }
    mutation.mutate(payload)
  }

  const fieldClass =
    'w-full px-3 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-focus-ring)] focus:border-[var(--color-primary)] text-sm'

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-lg shadow-2xl max-h-[calc(100vh-4rem)] overflow-y-auto overscroll-contain">
        <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between">
          <h2 className="text-lg font-condensed font-semibold text-neutral-800">
            {isEditing ? 'Editar Lista' : 'Nueva Lista'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 transition-colors" aria-label="Cerrar">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={submit} className="p-6 space-y-4">
          {formError && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2.5 text-sm" role="alert">
              {formError}
            </div>
          )}

          <div>
            <label htmlFor="lista-name" className="block text-sm font-medium text-neutral-800 mb-1.5">Nombre</label>
            <input id="lista-name" type="text" value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })} className={fieldClass} required minLength={2} />
          </div>

          <div>
            <label htmlFor="lista-code" className="block text-sm font-medium text-neutral-800 mb-1.5">Código</label>
            <input id="lista-code" type="text" value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })} className={fieldClass} required minLength={2} disabled={isEditing} aria-disabled={isEditing} />
            {isEditing && <p className="text-xs text-neutral-400 mt-1">El código no puede modificarse.</p>}
          </div>

          <div>
            <label htmlFor="lista-currency" className="block text-sm font-medium text-neutral-800 mb-1.5">Moneda</label>
            <select id="lista-currency" value={form.currency}
              onChange={(e) => setForm({ ...form, currency: e.target.value })} className={fieldClass} required>
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="lista-type" className="block text-sm font-medium text-neutral-800 mb-1.5">Tipo</label>
            <select id="lista-type" value={form.type ?? ''}
              onChange={(e) => setForm({ ...form, type: e.target.value })} className={fieldClass}>
              <option value="">Sin tipo</option>
              {LISTA_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-neutral-800 cursor-pointer">
              <input type="checkbox" checked={!!form.defaultVisibility}
                onChange={(e) => setForm({ ...form, defaultVisibility: e.target.checked })}
                className="h-4 w-4 accent-[var(--color-primary)] cursor-pointer" />
              Visibilidad por defecto para productos nuevos
            </label>
          </div>

          <div>
            <label htmlFor="lista-responsible" className="block text-sm font-medium text-neutral-800 mb-1.5">Responsable</label>
            <select id="lista-responsible" value={form.responsibleId ?? ''}
              onChange={(e) => setForm({ ...form, responsibleId: e.target.value })} className={fieldClass}>
              <option value="">Sin responsable</option>
              {isLoadingUsers
                ? <option value="" disabled>Cargando usuarios...</option>
                : usersList.map((u) => (
                  <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="lista-valid-from" className="block text-sm font-medium text-neutral-800 mb-1.5">Vigencia desde</label>
              <input id="lista-valid-from" type="date" value={form.validFrom ?? ''}
                onChange={(e) => setForm({ ...form, validFrom: e.target.value })} className={fieldClass} />
            </div>
            <div>
              <label htmlFor="lista-valid-until" className="block text-sm font-medium text-neutral-800 mb-1.5">Vigencia hasta</label>
              <input id="lista-valid-until" type="date" value={form.validUntil ?? ''}
                onChange={(e) => setForm({ ...form, validUntil: e.target.value })} className={fieldClass} />
            </div>
          </div>

          <div>
            <label htmlFor="lista-description" className="block text-sm font-medium text-neutral-800 mb-1.5">Descripción</label>
            <textarea id="lista-description" value={form.description || ''}
              onChange={(e) => setForm({ ...form, description: e.target.value })} className={`${fieldClass} resize-none`} rows={3} />
          </div>

          {isEditing && (
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-neutral-800 cursor-pointer">
                <input type="checkbox" checked={!!form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  className="h-4 w-4 accent-[var(--color-primary)] cursor-pointer" />
                Lista activa
              </label>
            </div>
          )}

          <div className="flex gap-3 justify-end pt-4 border-t border-neutral-200">
            <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
            <Button type="submit" loading={mutation.isPending}>{isEditing ? 'Actualizar' : 'Crear'}</Button>
          </div>
        </form>
      </div>
    </div>
  )
}
