import { useEffect, useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchAssignments,
  createAssignment,
  updateAssignment,
  deleteAssignment,
  ASSIGNMENT_LEVELS,
  type Assignment,
  type AssignmentLevel,
  type AssignmentResourceType,
  type CreateAssignmentPayload,
} from '../services/assignments.service'
import { fetchListas } from '../services/listas.service'
import { fetchUsers, type UserListItem } from '../services/users.service'
import { getApiErrorMessage } from '../lib/apiError'
import { formatDate } from '../lib/format'
import { canManageListaAccess } from '../lib/rbac'
import { Button } from '../components/ui'

const RESOURCE_TYPE_LABELS: Record<AssignmentResourceType, string> = {
  CATALOG: 'Catálogo',
  PRICE_LIST: 'Lista de precios',
  CATEGORY: 'Categoría',
  LISTA: 'Lista',
}

const LEVEL_LABELS: Record<AssignmentLevel, string> = {
  view: 'Vista',
  edit: 'Edición',
  manage: 'Administrar',
}

const LEVEL_STYLES: Record<AssignmentLevel, string> = {
  view: 'bg-[var(--color-primary-bg-subtle)] text-[var(--color-primary)]',
  edit: 'bg-[var(--color-warning-bg-subtle)] text-[var(--color-warning)]',
  manage: 'bg-[var(--color-error-bg-subtle)] text-[var(--color-error)]',
}

function assignmentErrorFallback(error: unknown, fallback: string): string {
  const status = (error as { response?: { status?: number } })?.response?.status
  if (status === 409) return 'Ya existe una asignación activa para este usuario y recurso'
  if (status === 403) return 'No tienes permisos para realizar esta acción'
  if (status === 404) return 'El usuario o recurso no existe'
  return getApiErrorMessage(error, fallback)
}

const shortId = (id: string) => `${id.slice(0, 8)}…`

function resourceName(a: Assignment, listaNames: Map<string, string>): string {
  if (a.resourceType === 'LISTA') {
    return listaNames.get(a.resourceId) ?? shortId(a.resourceId)
  }
  return shortId(a.resourceId)
}

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

export default function AssignmentsPage() {
  const queryClient = useQueryClient()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<'active' | 'inactive' | 'all'>('active')

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['assignments'] })

  const { data: assignments, isLoading, error } = useQuery({
    queryKey: ['assignments'],
    queryFn: () => fetchAssignments(),
  })

  const { data: listas } = useQuery({
    queryKey: ['listas'],
    queryFn: fetchListas,
  })

  const { data: users } = useQuery({
    queryKey: ['users', 'assignments-resolve'],
    queryFn: () => fetchUsers('', 500),
  })

  const listaNames = useMemo(() => {
    const map = new Map<string, string>()
    listas?.forEach((l) => map.set(l.id, l.name))
    return map
  }, [listas])

  const userMap = useMemo(() => {
    const map = new Map<string, UserListItem>()
    users?.forEach((u) => map.set(u.id, u))
    return map
  }, [users])

  const visibleAssignments = useMemo(() => {
    if (!assignments) return []
    if (statusFilter === 'all') return assignments
    return assignments.filter((a) => a.isActive === (statusFilter === 'active'))
  }, [assignments, statusFilter])

  const activeCount = useMemo(() => (assignments ?? []).filter((a) => a.isActive).length, [assignments])
  const inactiveCount = (assignments?.length ?? 0) - activeCount

  const toggleMutation = useMutation({
    mutationFn: (a: Assignment) => updateAssignment(a.id, { isActive: !a.isActive }),
    onSuccess: invalidate,
    onError: (err) =>
      setActionError(assignmentErrorFallback(err, 'No se pudo cambiar el estado de la asignación')),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteAssignment(id),
    onSuccess: () => {
      setActionError(null)
      invalidate()
    },
    onError: (err) =>
      setActionError(assignmentErrorFallback(err, 'No se pudo eliminar la asignación')),
  })

  const handleDelete = (a: Assignment) => {
    const user = userMap.get(a.userId)
    const target = resourceName(a, listaNames)
    if (!window.confirm(`¿Eliminar la asignación de ${user?.email ?? a.userId} a ${target}?`)) return
    setActionError(null)
    deleteMutation.mutate(a.id)
  }

  const listError = error ? assignmentErrorFallback(error, 'No se pudieron cargar las asignaciones') : null

  const emptyMessage =
    statusFilter === 'active'
      ? 'No hay asignaciones activas'
      : statusFilter === 'inactive'
        ? 'No hay asignaciones inactivas'
        : 'No hay asignaciones'

  const filterBar = (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <select
        value={statusFilter}
        onChange={(e) => setStatusFilter(e.target.value as 'active' | 'inactive' | 'all')}
        className="px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-focus-ring)] focus:border-[var(--color-primary)] text-sm"
        aria-label="Filtrar asignaciones por estado"
      >
        <option value="active">Activos</option>
        <option value="inactive">Inactivos</option>
        <option value="all">Todos</option>
      </select>
      <span className="text-xs text-neutral-400">
        {activeCount} activa{activeCount === 1 ? '' : 's'} · {inactiveCount} inactiva{inactiveCount === 1 ? '' : 's'}
      </span>
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-condensed font-bold text-security-800">Asignaciones</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Controla qué usuarios pueden ver y editar los recursos comerciales
          </p>
        </div>
        {canManageListaAccess() && (
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
            Nueva Asignación
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

      {isLoading ? (
        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-neutral-200">
              <thead className="bg-neutral-100">
                <tr>
                  {['Usuario', 'Recurso', 'Tipo', 'Nivel', 'Estado', 'Actualizado', ''].map((h) => (
                    <th
                      key={h || 'actions'}
                      className={`px-4 py-3 text-left text-xs font-condensed font-semibold text-neutral-500 uppercase tracking-wider ${h === '' ? 'text-right' : ''}`}
                    >
                      {h || 'Acciones'}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 7 }).map((__, j) => (
                      <td key={j} className="px-4 py-4">
                        <div className="h-4 bg-neutral-100 rounded animate-pulse w-24"></div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : !assignments || assignments.length === 0 ? (
        <div className="bg-white rounded-xl border border-neutral-200 text-center py-16">
          <svg className="w-16 h-16 text-neutral-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <p className="text-neutral-500 font-medium">No hay asignaciones</p>
          <p className="text-neutral-400 text-sm mt-1">Crea tu primera asignación para comenzar</p>
        </div>
      ) : visibleAssignments.length === 0 ? (
        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-neutral-200">{filterBar}</div>
          <div className="text-center py-16">
            <p className="text-neutral-500 font-medium">{emptyMessage}</p>
            <p className="text-neutral-400 text-sm mt-1">Cambia el filtro para ver otras asignaciones</p>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-neutral-200">{filterBar}</div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-neutral-200">
              <thead className="bg-neutral-100">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-condensed font-semibold text-neutral-500 uppercase tracking-wider">
                    Usuario
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-condensed font-semibold text-neutral-500 uppercase tracking-wider">
                    Recurso
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-condensed font-semibold text-neutral-500 uppercase tracking-wider">
                    Tipo
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-condensed font-semibold text-neutral-500 uppercase tracking-wider">
                    Nivel
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-condensed font-semibold text-neutral-500 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-condensed font-semibold text-neutral-500 uppercase tracking-wider">
                    Actualizado
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-condensed font-semibold text-neutral-500 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {visibleAssignments.map((a) => {
                  const user = userMap.get(a.userId)
                  const isToggling = toggleMutation.isPending && toggleMutation.variables?.id === a.id
                  const isDeleting = deleteMutation.isPending && deleteMutation.variables === a.id
                  const busy = isToggling || isDeleting
                  return (
                    <tr key={a.id} className="hover:bg-neutral-50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-gray-900">{user?.name ?? shortId(a.userId)}</p>
                        <p className="text-xs text-neutral-400">{user?.email ?? 'Usuario no encontrado'}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-neutral-700">{resourceName(a, listaNames)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full bg-neutral-100 text-neutral-600">
                          {RESOURCE_TYPE_LABELS[a.resourceType] ?? a.resourceType}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full ${LEVEL_STYLES[a.level] ?? ''}`}
                        >
                          {LEVEL_LABELS[a.level] ?? a.level}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge isActive={a.isActive} />
                      </td>
                      <td className="px-4 py-3 text-sm text-neutral-500">{formatDate(a.updatedAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => {
                              setActionError(null)
                              toggleMutation.mutate(a)
                            }}
                            disabled={busy}
                            className="p-2 text-neutral-400 hover:text-[var(--color-primary)] hover:bg-[var(--color-primary-bg-subtle)] rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus-ring)] disabled:opacity-50 disabled:cursor-not-allowed"
                            title={a.isActive ? 'Desactivar asignación' : 'Activar asignación'}
                            aria-label={a.isActive ? 'Desactivar asignación' : 'Activar asignación'}
                          >
                            {a.isActive ? (
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636M12 3a9 9 0 019 9 9 9 0 01-9 9 9 9 0 01-9-9 9 9 0 019-9z" />
                              </svg>
                            ) : (
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            )}
                          </button>
                          <button
                            onClick={() => handleDelete(a)}
                            disabled={busy}
                            className="p-2 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus-ring)] disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Eliminar asignación"
                            aria-label="Eliminar asignación"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showCreateModal && (
        <AssignmentFormModal
          onClose={() => setShowCreateModal(false)}
          onSaved={() => {
            invalidate()
            setShowCreateModal(false)
          }}
          onError={(err) => setActionError(assignmentErrorFallback(err, 'No se pudo crear la asignación'))}
        />
      )}
    </div>
  )
}

function AssignmentFormModal({
  onClose,
  onSaved,
  onError,
}: {
  onClose: () => void
  onSaved: () => void
  onError: (error: unknown) => void
}) {
  const [form, setForm] = useState({
    userId: '',
    resourceType: 'LISTA' as AssignmentResourceType,
    resourceId: '',
    level: 'view' as AssignmentLevel,
  })
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ['users', 'assignment-form', debouncedSearch],
    queryFn: () => fetchUsers(debouncedSearch),
  })

  const { data: listas } = useQuery({
    queryKey: ['listas'],
    queryFn: fetchListas,
  })

  const activeListas = useMemo(() => (listas ?? []).filter((l) => l.isActive && !l.archivedAt), [listas])

  const mutation = useMutation({
    mutationFn: (payload: CreateAssignmentPayload) => createAssignment(payload),
    onSuccess: onSaved,
    onError: (err) => {
      const message = assignmentErrorFallback(err, 'No se pudo crear la asignación')
      setFormError(message)
      onError(err)
    },
  })

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    if (!form.userId) {
      setFormError('Selecciona un usuario')
      return
    }
    if (!form.resourceId) {
      setFormError('Selecciona una Lista')
      return
    }
    mutation.mutate({
      userId: form.userId,
      resourceType: form.resourceType,
      resourceId: form.resourceId,
      level: form.level,
    })
  }

  const fieldClass =
    'w-full px-3 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-focus-ring)] focus:border-[var(--color-primary)] text-sm disabled:bg-neutral-100 disabled:cursor-not-allowed'

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-lg shadow-2xl">
        <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between">
          <h2 className="text-lg font-condensed font-semibold text-neutral-800">Nueva Asignación</h2>
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
            <label htmlFor="assignment-user" className="block text-sm font-medium text-neutral-800 mb-1.5">
              Usuario
            </label>
            <div className="relative mb-2">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                id="assignment-user-search"
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nombre o email..."
                className={`${fieldClass} pl-9`}
                aria-label="Buscar usuario"
              />
            </div>
            <select
              id="assignment-user"
              value={form.userId}
              onChange={(e) => setForm({ ...form, userId: e.target.value })}
              className={fieldClass}
              required
            >
              <option value="" disabled>
                {usersLoading ? 'Cargando usuarios...' : 'Selecciona un usuario'}
              </option>
              {(users ?? []).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.email})
                </option>
              ))}
            </select>
            {!usersLoading && users?.length === 0 && (
              <p className="text-xs text-neutral-400 mt-1">No se encontraron usuarios para la búsqueda.</p>
            )}
          </div>

          <div>
            <label htmlFor="assignment-resource-type" className="block text-sm font-medium text-neutral-800 mb-1.5">
              Tipo de recurso
            </label>
            <select
              id="assignment-resource-type"
              value={form.resourceType}
              onChange={(e) =>
                setForm({ ...form, resourceType: e.target.value as AssignmentResourceType, resourceId: '' })
              }
              className={fieldClass}
              disabled
              aria-describedby="assignment-resource-type-hint"
            >
              <option value="LISTA">Lista</option>
            </select>
            <p id="assignment-resource-type-hint" className="text-xs text-neutral-400 mt-1">
              Actualmente solo se asignan Listas desde esta vista.
            </p>
          </div>

          <div>
            <label htmlFor="assignment-lista" className="block text-sm font-medium text-neutral-800 mb-1.5">
              Lista
            </label>
            <select
              id="assignment-lista"
              value={form.resourceId}
              onChange={(e) => setForm({ ...form, resourceId: e.target.value })}
              className={fieldClass}
              required
            >
              <option value="" disabled>
                {activeListas.length === 0 ? 'No hay Listas activas' : 'Selecciona una Lista'}
              </option>
              {activeListas.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} ({l.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="assignment-level" className="block text-sm font-medium text-neutral-800 mb-1.5">
              Nivel de acceso
            </label>
            <select
              id="assignment-level"
              value={form.level}
              onChange={(e) => setForm({ ...form, level: e.target.value as AssignmentLevel })}
              className={fieldClass}
            >
              {ASSIGNMENT_LEVELS.map((l) => (
                <option key={l} value={l}>
                  {LEVEL_LABELS[l] ?? l}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t border-neutral-200">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" loading={mutation.isPending}>
              Crear
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
