import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  fetchCatalogs,
  createCatalog,
  updateCatalog,
  deleteCatalog,
  productCountOf,
  type Catalog,
  type CatalogPayload,
} from '../services/catalogs.service'
import { hasRole } from '../lib/rbac'
import { getApiErrorMessage } from '../lib/apiError'
import { formatDate } from '../lib/format'
import { Button } from '../components/ui'

const canManageCatalogs = () => hasRole('Super Admin') || hasRole('Admin Comercial')
const canDeleteCatalogs = () => hasRole('Super Admin')

function StatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full ${
        isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
      }`}
    >
      {isActive ? 'Activo' : 'Inactivo'}
    </span>
  )
}

export default function CatalogsPage() {
  const queryClient = useQueryClient()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingCatalog, setEditingCatalog] = useState<Catalog | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['catalogs'] })

  const { data: catalogs, isLoading, error } = useQuery({
    queryKey: ['catalogs'],
    queryFn: fetchCatalogs,
  })

  const toggleCatalog = useMutation({
    mutationFn: (catalog: Catalog) => updateCatalog(catalog.id, { isActive: !catalog.isActive }),
    onSuccess: invalidate,
    onError: (err) => setActionError(getApiErrorMessage(err, 'No se pudo cambiar el estado del catálogo')),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCatalog(id),
    onSuccess: () => {
      setActionError(null)
      invalidate()
    },
    onError: (err, id) => {
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 409) {
        const catalog = catalogs?.find((c) => c.id === id)
        setActionError(
          `No se puede eliminar: el catálogo tiene ${productCountOf(catalog)} producto(s) asignados`
        )
      } else {
        setActionError(getApiErrorMessage(err, 'No se pudo eliminar el catálogo'))
      }
    },
  })

  const handleDelete = (catalog: Catalog) => {
    if (!window.confirm(`¿Eliminar el catálogo "${catalog.name}"?`)) return
    setActionError(null)
    deleteMutation.mutate(catalog.id)
  }

  const listError = error ? getApiErrorMessage(error, 'No se pudieron cargar los catálogos') : null

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-condensed font-bold text-security-800">Catálogos</h1>
          <p className="text-sm text-neutral-500 mt-1">Gestión de catálogos comerciales y asignación de productos</p>
        </div>
        {canManageCatalogs() && (
          <Button
            variant="primary"
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            }
            onClick={() => {
              setActionError(null)
              setShowCreateModal(true)
            }}
          >
            Nuevo Catálogo
          </Button>
        )}
      </div>

      {actionError && (
        <div
          className="flex items-start gap-3 p-3.5 rounded-lg border text-sm bg-red-50 border-red-200 text-red-800"
          role="alert"
        >
          <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="flex-1">{actionError}</span>
          <button
            onClick={() => setActionError(null)}
            className="flex-shrink-0 p-0.5 rounded hover:bg-red-100/60 transition-colors"
            aria-label="Cerrar"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {listError && (
        <div
          className="flex items-start gap-3 p-3.5 rounded-lg border text-sm bg-red-50 border-red-200 text-red-800"
          role="alert"
        >
          <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
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
          : !catalogs || catalogs.length === 0 ? (
            <div className="bg-white rounded-xl border border-neutral-200 text-center py-16">
              <svg className="w-16 h-16 text-neutral-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <p className="text-neutral-500 font-medium">No hay catálogos</p>
              <p className="text-neutral-400 text-sm mt-1">Crea tu primer catálogo para comenzar</p>
            </div>
          ) : (
            catalogs?.map((catalog) => (
              <div
                key={catalog.id}
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
                        to={`/commercial/catalogs/${catalog.id}`}
                        className="text-sm font-semibold text-gray-900 hover:text-[var(--color-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus-ring)] rounded transition-colors"
                      >
                        {catalog.name}
                      </Link>
                      <p className="text-xs text-neutral-400 font-mono">{catalog.code}</p>
                      {catalog.description && (
                        <p className="text-sm text-neutral-500 mt-1 line-clamp-2">{catalog.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <StatusBadge isActive={catalog.isActive} />
                    <span className="text-xs text-neutral-500 whitespace-nowrap">
                      {productCountOf(catalog)} producto(s)
                    </span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-neutral-100 flex flex-wrap items-center justify-between gap-3">
                  <span className="text-xs text-neutral-400">Actualizado: {formatDate(catalog.updatedAt)}</span>
                  <div className="flex items-center gap-1">
                    {canManageCatalogs() && (
                      <button
                        onClick={() => {
                          setActionError(null)
                          setEditingCatalog(catalog)
                        }}
                        className="p-2 text-neutral-400 hover:text-[var(--color-primary)] hover:bg-[var(--color-primary-bg-subtle)] rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus-ring)]"
                        title="Editar catálogo"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                    )}
                    {canManageCatalogs() && (
                      <button
                        onClick={() => {
                          setActionError(null)
                          toggleCatalog.mutate(catalog)
                        }}
                        className="p-2 text-neutral-400 hover:text-[var(--color-primary)] hover:bg-[var(--color-primary-bg-subtle)] rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus-ring)]"
                        title={catalog.isActive ? 'Desactivar catálogo' : 'Activar catálogo'}
                      >
                        {catalog.isActive ? (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636M12 3a9 9 0 019 9 9 9 0 01-9 9 9 9 0 01-9-9 9 9 0 019-9z" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        )}
                      </button>
                    )}
                    {canDeleteCatalogs() && (
                      <button
                        onClick={() => handleDelete(catalog)}
                        className="p-2 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus-ring)]"
                        title="Eliminar catálogo"
                      >
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

      {(showCreateModal || editingCatalog) && (
        <CatalogFormModal
          catalog={editingCatalog}
          onClose={() => {
            setShowCreateModal(false)
            setEditingCatalog(null)
          }}
          onSaved={() => {
            invalidate()
            setShowCreateModal(false)
            setEditingCatalog(null)
          }}
          onError={(err) => setActionError(getApiErrorMessage(err, 'No se pudo guardar el catálogo'))}
        />
      )}
    </div>
  )
}

function CatalogFormModal({
  catalog,
  onClose,
  onSaved,
  onError,
}: {
  catalog?: Catalog | null
  onClose: () => void
  onSaved: () => void
  onError: (error: unknown) => void
}) {
  const [form, setForm] = useState({
    name: catalog?.name || '',
    code: catalog?.code || '',
    description: catalog?.description || '',
    isActive: catalog?.isActive ?? true,
  })
  const [formError, setFormError] = useState<string | null>(null)
  const isEditing = Boolean(catalog)

  const mutation = useMutation({
    mutationFn: (payload: CatalogPayload) =>
      isEditing && catalog ? updateCatalog(catalog.id, payload) : createCatalog(payload),
    onSuccess: onSaved,
    onError: (err) => {
      const message = getApiErrorMessage(err, 'No se pudo guardar el catálogo')
      setFormError(message)
      onError(err)
    },
  })

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    const payload: CatalogPayload = {
      name: form.name.trim(),
      code: form.code.trim(),
      description: form.description.trim() || null,
      ...(isEditing && { isActive: form.isActive }),
    }
    if (payload.name.length < 2 || payload.code.length < 2) {
      setFormError('Nombre y código deben tener al menos 2 caracteres')
      return
    }
    mutation.mutate(payload)
  }

  const fieldClass =
    'w-full px-3 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-focus-ring)] focus:border-[var(--color-primary)] text-sm'

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-lg shadow-2xl">
        <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between">
          <h2 className="text-lg font-condensed font-semibold text-neutral-800">
            {isEditing ? 'Editar Catálogo' : 'Nuevo Catálogo'}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 transition-colors"
            aria-label="Cerrar"
          >
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
            <label htmlFor="catalog-name" className="block text-sm font-medium text-neutral-800 mb-1.5">
              Nombre
            </label>
            <input
              id="catalog-name"
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className={fieldClass}
              required
              minLength={2}
            />
          </div>

          <div>
            <label htmlFor="catalog-code" className="block text-sm font-medium text-neutral-800 mb-1.5">
              Código
            </label>
            <input
              id="catalog-code"
              type="text"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              className={fieldClass}
              required
              minLength={2}
              disabled={isEditing}
              aria-disabled={isEditing}
            />
            {isEditing && <p className="text-xs text-neutral-400 mt-1">El código no puede modificarse.</p>}
          </div>

          <div>
            <label htmlFor="catalog-description" className="block text-sm font-medium text-neutral-800 mb-1.5">
              Descripción
            </label>
            <textarea
              id="catalog-description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className={`${fieldClass} resize-none`}
              rows={3}
            />
          </div>

          {isEditing && (
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-neutral-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  className="h-4 w-4 accent-[var(--color-primary)] cursor-pointer"
                />
                Catálogo activo
              </label>
            </div>
          )}

          <div className="flex gap-3 justify-end pt-4 border-t border-neutral-200">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" loading={mutation.isPending}>
              {isEditing ? 'Actualizar' : 'Crear'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
