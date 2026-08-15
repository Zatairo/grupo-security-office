import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  fetchSupplierEvaluations,
  createSupplierEvaluation,
  type Supplier,
  type SupplierPayload,
  type SupplierEvaluation,
} from '../services/suppliers.service'
import { hasPermission, hasRole } from '../lib/rbac'
import { ROLES } from '../lib/roles'
import { getApiErrorMessage } from '../lib/apiError'
import { Button } from '../components/ui'

const CRITERIA_SPECS = [
  { key: 'calidad', label: 'Calidad', weight: 0.4 },
  { key: 'tiempoEntrega', label: 'Tiempo de entrega', weight: 0.2 },
  { key: 'cumplimiento', label: 'Cumplimiento', weight: 0.2 },
  { key: 'precio', label: 'Precio', weight: 0.2 },
] as const

type CriterionKey = (typeof CRITERIA_SPECS)[number]['key']

const fieldClass =
  'w-full px-3 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-focus-ring)] focus:border-[var(--color-primary)] text-sm'

const actionButtonClass =
  'p-2 text-neutral-400 hover:text-[var(--color-primary)] hover:bg-[var(--color-primary-bg-subtle)] rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus-ring)]'

const dangerButtonClass =
  'p-2 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus-ring)]'

function errorStatus(err: unknown): number | undefined {
  return (err as { response?: { status?: number } })?.response?.status
}

/**
 * Fórmula del score (documentada): promedio ponderado de los 4 criterios,
 * cada uno 0-100, con pesos calidad 40%, tiempo de entrega 20%, cumplimiento
 * 20% y precio 20%. Resultado redondeado al entero más cercano.
 */
function computeScore(values: Record<CriterionKey, number>): number {
  const total = CRITERIA_SPECS.reduce(
    (acc, spec) => acc + (values[spec.key] || 0) * spec.weight,
    0
  )
  return Math.round(total)
}

function SupplierModalShell({
  title,
  onClose,
  children,
  maxWidth = 'max-w-lg',
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
  maxWidth?: string
}) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className={`bg-white rounded-xl w-full ${maxWidth} shadow-2xl max-h-[calc(100vh-4rem)] overflow-y-auto overscroll-contain`}>
        <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between">
          <h2 className="text-lg font-condensed font-semibold text-neutral-800">{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 transition-colors" aria-label="Cerrar">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function SupplierFormError({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2.5 text-sm" role="alert">
      {message}
    </div>
  )
}

function ratingColor(rating: number | null | undefined): string {
  if (rating === null || rating === undefined) return 'bg-neutral-100 text-neutral-500'
  if (rating >= 70) return 'bg-emerald-100 text-emerald-700'
  if (rating >= 40) return 'bg-amber-100 text-amber-700'
  return 'bg-red-100 text-red-700'
}

export default function SuppliersPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Supplier | null>(null)
  const [evaluating, setEvaluating] = useState<Supplier | null>(null)
  const [historyFor, setHistoryFor] = useState<Supplier | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const canWrite = hasPermission('products:write') || hasRole(ROLES.SUPER_ADMIN)
  const canDelete = hasRole(ROLES.SUPER_ADMIN)

  const { data: suppliers, isLoading } = useQuery({
    queryKey: ['suppliers', search, status],
    queryFn: () => fetchSuppliers({ search: search || undefined, status: status || undefined }),
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['suppliers'] })

  const removeMutation = useMutation({
    mutationFn: (id: string) => deleteSupplier(id),
    onSuccess: () => {
      invalidate()
      setActionError(null)
    },
    onError: (err) => {
      const statusCode = errorStatus(err)
      setActionError(
        statusCode === 409
          ? 'No se puede eliminar: el proveedor tiene pedidos asociados.'
          : getApiErrorMessage(err, 'No se pudo eliminar el proveedor')
      )
    },
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-condensed font-bold text-security-800">Proveedores</h1>
          <p className="text-sm text-neutral-500 mt-1">Gestión de proveedores y sus evaluaciones</p>
        </div>
        {canWrite && (
          <Button
            variant="primary"
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            }
            onClick={() => {
              setActionError(null)
              setEditing(null)
              setShowModal(true)
            }}
          >
            Nuevo Proveedor
          </Button>
        )}
      </div>

      {actionError && (
        <div className="flex items-start gap-3 p-3.5 rounded-lg border text-sm bg-red-50 border-red-200 text-red-800" role="alert">
          <span className="flex-1">{actionError}</span>
          <button onClick={() => setActionError(null)} className="p-0.5 rounded hover:bg-red-100/60" aria-label="Cerrar" />
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Buscar por nombre, NIT o categoría..."
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
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="px-3 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-focus-ring)] focus:border-[var(--color-primary)] text-sm bg-white"
          aria-label="Filtrar por estado"
        >
          <option value="">Todos los estados</option>
          <option value="active">Activo</option>
          <option value="inactive">Inactivo</option>
        </select>
      </div>

      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-neutral-200">
            <thead className="bg-neutral-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider">Proveedor</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider">NIT</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider">Categoría</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider">Estado</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider">Rating</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider">Evaluaciones</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-neutral-600 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-neutral-400">Cargando...</td>
                </tr>
              ) : !suppliers || suppliers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-neutral-400">
                    {search || status
                      ? 'No hay proveedores que coincidan con los filtros'
                      : 'No hay proveedores registrados'}
                  </td>
                </tr>
              ) : (
                suppliers.map((supplier) => (
                  <tr key={supplier.id} className="hover:bg-neutral-50 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-neutral-800">{supplier.name}</td>
                    <td className="px-6 py-4 text-xs font-mono text-neutral-500">{supplier.nit ?? '—'}</td>
                    <td className="px-6 py-4 text-sm text-neutral-600">{supplier.category ?? '—'}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full ${
                        supplier.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {supplier.status === 'active' ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full ${ratingColor(supplier.rating)}`}>
                        {supplier.rating === null || supplier.rating === undefined ? 'Sin rating' : `${supplier.rating}/100`}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-neutral-600">{supplier.evaluationCount ?? 0}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => {
                            setActionError(null)
                            setEvaluating(supplier)
                          }}
                          className={actionButtonClass}
                          title="Evaluar proveedor"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => {
                            setActionError(null)
                            setHistoryFor(supplier)
                          }}
                          className={actionButtonClass}
                          title="Ver historial de evaluaciones"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </button>
                        {canWrite && (
                          <button
                            onClick={() => {
                              setActionError(null)
                              setEditing(supplier)
                              setShowModal(true)
                            }}
                            className={actionButtonClass}
                            title="Editar proveedor"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => {
                              if (window.confirm(`¿Eliminar el proveedor "${supplier.name}"?`)) {
                                removeMutation.mutate(supplier.id)
                              }
                            }}
                            className={dangerButtonClass}
                            title="Eliminar proveedor"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <SupplierModal
          supplier={editing}
          onClose={() => {
            setShowModal(false)
            setEditing(null)
          }}
          onSaved={() => {
            invalidate()
            setShowModal(false)
            setEditing(null)
          }}
          onError={(err) => setActionError(getApiErrorMessage(err, 'No se pudo guardar el proveedor'))}
        />
      )}

      {evaluating && (
        <EvaluationModal
          supplier={evaluating}
          onClose={() => setEvaluating(null)}
          onSaved={() => {
            invalidate()
            setEvaluating(null)
          }}
          onError={(err) => setActionError(getApiErrorMessage(err, 'No se pudo guardar la evaluación'))}
        />
      )}

      {historyFor && (
        <EvaluationsHistoryModal supplier={historyFor} onClose={() => setHistoryFor(null)} />
      )}
    </div>
  )
}

function SupplierModal({
  supplier,
  onClose,
  onSaved,
  onError,
}: {
  supplier?: Supplier | null
  onClose: () => void
  onSaved: () => void
  onError: (error: unknown) => void
}) {
  const isEditing = Boolean(supplier)
  const [name, setName] = useState(supplier?.name ?? '')
  const [nit, setNit] = useState(supplier?.nit ?? '')
  const [category, setCategory] = useState(supplier?.category ?? '')
  const [statusValue, setStatusValue] = useState<'active' | 'inactive'>(supplier?.status ?? 'active')
  const [rating, setRating] = useState(supplier?.rating === null || supplier?.rating === undefined ? '' : String(supplier.rating))
  const [contactJson, setContactJson] = useState(
    supplier?.contact ? JSON.stringify(supplier.contact, null, 2) : ''
  )
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: () => {
      const payload: SupplierPayload = {
        name: name.trim(),
        nit: nit.trim() || null,
        category: category.trim() || null,
        status: statusValue,
        rating: rating.trim() === '' ? null : Math.min(100, Math.max(0, Number(rating))),
      }
      const trimmedContact = contactJson.trim()
      if (trimmedContact) {
        try {
          payload.contact = JSON.parse(trimmedContact) as Record<string, unknown>
        } catch {
          throw new Error('El contacto debe ser JSON válido')
        }
      } else {
        payload.contact = null
      }
      return isEditing && supplier ? updateSupplier(supplier.id, payload) : createSupplier(payload)
    },
    onSuccess: onSaved,
    onError: (err) => {
      const message =
        err instanceof Error && err.message === 'El contacto debe ser JSON válido'
          ? err.message
          : getApiErrorMessage(err, 'No se pudo guardar el proveedor')
      setError(message)
      onError(err)
    },
  })

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (name.trim().length < 2) {
      setError('El nombre debe tener al menos 2 caracteres')
      return
    }
    mutation.mutate()
  }

  return (
    <SupplierModalShell title={isEditing ? 'Editar Proveedor' : 'Nuevo Proveedor'} onClose={onClose}>
      <form onSubmit={submit} className="p-6 space-y-4">
        <SupplierFormError message={error} />
        <div>
          <label htmlFor="sup-name" className="block text-sm font-medium text-neutral-800 mb-1.5">Nombre</label>
          <input
            id="sup-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={fieldClass}
            required
            minLength={2}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="sup-nit" className="block text-sm font-medium text-neutral-800 mb-1.5">NIT</label>
            <input
              id="sup-nit"
              type="text"
              value={nit}
              onChange={(e) => setNit(e.target.value)}
              className={fieldClass}
            />
          </div>
          <div>
            <label htmlFor="sup-category" className="block text-sm font-medium text-neutral-800 mb-1.5">Categoría</label>
            <input
              id="sup-category"
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className={fieldClass}
              placeholder="Ej: Seguridad electrónica"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="sup-status" className="block text-sm font-medium text-neutral-800 mb-1.5">Estado</label>
            <select
              id="sup-status"
              value={statusValue}
              onChange={(e) => setStatusValue(e.target.value as 'active' | 'inactive')}
              className={fieldClass}
            >
              <option value="active">Activo</option>
              <option value="inactive">Inactivo</option>
            </select>
          </div>
          <div>
            <label htmlFor="sup-rating" className="block text-sm font-medium text-neutral-800 mb-1.5">Rating (0-100)</label>
            <input
              id="sup-rating"
              type="number"
              min={0}
              max={100}
              value={rating}
              onChange={(e) => setRating(e.target.value)}
              className={fieldClass}
            />
          </div>
        </div>
        <div>
          <label htmlFor="sup-contact" className="block text-sm font-medium text-neutral-800 mb-1.5">
            Contacto (JSON)
          </label>
          <textarea
            id="sup-contact"
            value={contactJson}
            onChange={(e) => setContactJson(e.target.value)}
            className={`${fieldClass} resize-none font-mono text-xs`}
            rows={4}
            placeholder={'{\n  "phone": "...",\n  "email": "...",\n  "address": "..."\n}'}
          />
          <p className="text-xs text-neutral-400 mt-1">Opcional. Debe ser JSON válido.</p>
        </div>
        <div className="flex gap-3 justify-end pt-4 border-t border-neutral-200">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={mutation.isPending}>{isEditing ? 'Actualizar' : 'Crear'}</Button>
        </div>
      </form>
    </SupplierModalShell>
  )
}

function EvaluationModal({
  supplier,
  onClose,
  onSaved,
  onError,
}: {
  supplier: Supplier
  onClose: () => void
  onSaved: () => void
  onError: (error: unknown) => void
}) {
  const [values, setValues] = useState<Record<CriterionKey, number>>({
    calidad: 0,
    tiempoEntrega: 0,
    cumplimiento: 0,
    precio: 0,
  })
  const [observaciones, setObservaciones] = useState('')
  const [error, setError] = useState<string | null>(null)

  const score = computeScore(values)

  const mutation = useMutation({
    mutationFn: () =>
      createSupplierEvaluation(supplier.id, {
        criteria: {
          ...values,
          observaciones: observaciones.trim(),
        },
        score,
      }),
    onSuccess: onSaved,
    onError: (err) => {
      setError(getApiErrorMessage(err, 'No se pudo guardar la evaluación'))
      onError(err)
    },
  })

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    mutation.mutate()
  }

  return (
    <SupplierModalShell title={`Evaluar: ${supplier.name}`} onClose={onClose}>
      <form onSubmit={submit} className="p-6 space-y-4">
        <SupplierFormError message={error} />
        <div className="space-y-4">
          {CRITERIA_SPECS.map((spec) => (
            <div key={spec.key}>
              <label htmlFor={`crit-${spec.key}`} className="flex items-center justify-between text-sm font-medium text-neutral-800 mb-1.5">
                <span>{spec.label}</span>
                <span className="text-xs text-neutral-400 font-normal">Peso {Math.round(spec.weight * 100)}%</span>
              </label>
              <input
                id={`crit-${spec.key}`}
                type="range"
                min={0}
                max={100}
                step={1}
                value={values[spec.key]}
                onChange={(e) => setValues({ ...values, [spec.key]: Number(e.target.value) })}
                className="w-full accent-[var(--color-primary)]"
              />
              <div className="flex justify-between text-xs text-neutral-400 mt-0.5">
                <span>0</span>
                <span className="font-mono text-neutral-600">{values[spec.key]}/100</span>
                <span>100</span>
              </div>
            </div>
          ))}
        </div>
        <div>
          <label htmlFor="crit-obs" className="block text-sm font-medium text-neutral-800 mb-1.5">Observaciones</label>
          <textarea
            id="crit-obs"
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            className={`${fieldClass} resize-none`}
            rows={3}
          />
        </div>
        <div className="bg-neutral-50 border border-neutral-200 rounded-lg px-4 py-3 flex items-center justify-between">
          <span className="text-sm font-medium text-neutral-600">Score calculado</span>
          <span className={`inline-flex items-center px-2.5 py-1 text-sm font-semibold rounded-full ${ratingColor(score)}`}>
            {score}/100
          </span>
        </div>
        <div className="flex gap-3 justify-end pt-4 border-t border-neutral-200">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={mutation.isPending}>Guardar evaluación</Button>
        </div>
      </form>
    </SupplierModalShell>
  )
}

function EvaluationsHistoryModal({ supplier, onClose }: { supplier: Supplier; onClose: () => void }) {
  const { data: evaluations, isLoading } = useQuery({
    queryKey: ['supplier-evaluations', supplier.id],
    queryFn: () => fetchSupplierEvaluations(supplier.id),
  })

  const list = (evaluations ?? []) as SupplierEvaluation[]

  return (
    <SupplierModalShell title={`Evaluaciones de ${supplier.name}`} onClose={onClose} maxWidth="max-w-2xl">
      <div className="p-6 space-y-4">
        {isLoading ? (
          <p className="text-sm text-neutral-400 text-center py-8">Cargando evaluaciones...</p>
        ) : list.length === 0 ? (
          <p className="text-sm text-neutral-400 text-center py-8">Este proveedor aún no tiene evaluaciones.</p>
        ) : (
          <ul className="space-y-3">
            {list.map((ev) => (
              <li key={ev.id} className="bg-neutral-50 border border-neutral-200 rounded-lg p-4">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <span className="text-sm text-neutral-500">{new Date(ev.date ?? ev.createdAt).toLocaleString()}</span>
                  <span className={`inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-full ${ratingColor(ev.score)}`}>
                    {ev.score}/100
                  </span>
                </div>
                {ev.criteria && Object.keys(ev.criteria).length > 0 && (
                  <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    {CRITERIA_SPECS.map((spec) => {
                      const value = (ev.criteria as Record<string, unknown>)[spec.key]
                      if (typeof value !== 'number') return null
                      return (
                        <div key={spec.key}>
                          <dt className="text-neutral-400">{spec.label}</dt>
                          <dd className="text-neutral-700 font-mono mt-0.5">{value}/100</dd>
                        </div>
                      )
                    })}
                  </dl>
                )}
                {typeof (ev.criteria as Record<string, unknown> | undefined)?.observaciones === 'string' &&
                  (ev.criteria as Record<string, unknown>).observaciones !== '' && (
                    <p className="text-xs text-neutral-500 mt-2">
                      {(ev.criteria as Record<string, unknown>).observaciones as string}
                    </p>
                  )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </SupplierModalShell>
  )
}