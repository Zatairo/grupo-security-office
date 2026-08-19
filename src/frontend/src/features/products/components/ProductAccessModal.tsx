import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Modal, Alert } from '../../../components/ui'
import {
  fetchAssignments,
  createAssignment,
  updateAssignment,
  deleteAssignment,
  type Assignment,
} from '../../../services/assignments.service'
import { fetchUsers, type UserListItem } from '../../../services/users.service'
import { getApiErrorMessage } from '../../../lib/apiError'

export const PRODUCT_ACCESS_LEVELS = [
  { value: 'view', label: 'Vista' },
  { value: 'edit_products', label: 'Edición' },
  { value: 'manage', label: 'Administrar' },
  { value: 'manage_access', label: 'Gestionar accesos' },
] as const

interface ProductAccessModalProps {
  productId: string
  productName: string
  onClose: () => void
}

/**
 * Asignación de accesos por producto (checklist). Contrato real (assignments.controller):
 * - GET  /api/assignments?resourceType=PRODUCT  → { data: Assignment[] }
 * - POST /api/assignments  { userId, resourceType: 'PRODUCT', resourceId, level } (409 si activa → reactiva)
 * - PATCH /api/assignments/:id  { level?, isActive? }
 * - DELETE /api/assignments/:id  (desactivación lógica)
 * Los nombres de usuario se resuelven con GET /api/users (el Assignment no trae user).
 */
export function ProductAccessModal({ productId, productName, onClose }: ProductAccessModalProps) {
  const queryClient = useQueryClient()
  const [selectedUserId, setSelectedUserId] = useState('')
  const [selectedLevel, setSelectedLevel] = useState<string>('view')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const { data: assignments = [], isLoading: loadingAssignments, error: assignmentsError } = useQuery({
    queryKey: ['product-assignments', productId],
    queryFn: async () => {
      const all = await fetchAssignments({ resourceType: 'PRODUCT' })
      return all.filter((a) => a.resourceId === productId)
    },
    retry: false,
  })

  const { data: users = [], isLoading: loadingUsers } = useQuery({
    queryKey: ['users'],
    queryFn: () => fetchUsers(),
  })

  const unavailable = assignmentsError
    ? [403, 404, 405, 501].includes(
        (assignmentsError as { response?: { status?: number } })?.response?.status ?? 0
      )
    : false

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['product-assignments', productId] })
    queryClient.invalidateQueries({ queryKey: ['access-matrix'] })
  }

  const handleCreate = async () => {
    if (!selectedUserId) {
      setError('Selecciona un usuario.')
      return
    }
    setPending(true)
    setError(null)
    setNotice(null)
    try {
      await createAssignment({
        userId: selectedUserId,
        resourceType: 'PRODUCT' as never,
        resourceId: productId,
        level: selectedLevel as never,
      })
      setNotice('Acceso creado correctamente.')
      setSelectedUserId('')
      invalidate()
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 409) {
        setError('El usuario ya tiene un acceso activo en este producto (usa la palanca para reactivar).')
      } else {
        setError(getApiErrorMessage(err, 'No se pudo crear el acceso'))
      }
    } finally {
      setPending(false)
    }
  }

  const handleToggleActive = async (a: Assignment) => {
    setPending(true)
    setError(null)
    try {
      await updateAssignment(a.id, { isActive: !a.isActive })
      setNotice(a.isActive ? 'Acceso desactivado.' : 'Acceso reactivado.')
      invalidate()
    } catch (err) {
      setError(getApiErrorMessage(err, 'No se pudo actualizar el acceso'))
    } finally {
      setPending(false)
    }
  }

  const handleRevoke = async (a: Assignment) => {
    if (!window.confirm('¿Revocar (desactivar) este acceso?')) return
    setPending(true)
    setError(null)
    try {
      await deleteAssignment(a.id)
      setNotice('Acceso revocado.')
      invalidate()
    } catch (err) {
      setError(getApiErrorMessage(err, 'No se pudo revocar el acceso'))
    } finally {
      setPending(false)
    }
  }

  const userName = (userId: string) => {
    const u = (users as UserListItem[]).find((x) => x.id === userId)
    return u ? `${u.name} (${u.email})` : userId.slice(0, 8)
  }

  return (
    <Modal
      open
      onClose={() => {
        if (!pending) onClose()
      }}
      title={`Accesos del producto: ${productName}`}
      size="lg"
      footer={
        <>
          <Button variant="secondary" disabled={pending} onClick={onClose}>
            Cerrar
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {error && <Alert variant="error">{error}</Alert>}
        {notice && <Alert variant="success">{notice}</Alert>}

        {unavailable ? (
          <Alert variant="error">
            No tienes permisos para gestionar accesos por producto. Solo Super Admin y Admin
            Comercial pueden gestionar asignaciones.
          </Alert>
        ) : (
          <>
            <div>
              <h3 className="text-sm font-semibold text-neutral-700 mb-2">
                Asignaciones actuales ({assignments.length})
              </h3>
              {loadingAssignments ? (
                <p className="text-sm text-neutral-400 py-3">Cargando accesos...</p>
              ) : assignments.length === 0 ? (
                <p className="text-sm text-neutral-400 py-3">Sin accesos asignados a este producto.</p>
              ) : (
                <div className="overflow-x-auto border border-neutral-200 rounded-lg">
                  <table className="min-w-full divide-y divide-neutral-200 text-sm">
                    <thead className="bg-neutral-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-neutral-600 uppercase">Usuario</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-neutral-600 uppercase">Nivel</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-neutral-600 uppercase">Estado</th>
                        <th className="px-4 py-2 text-right text-xs font-semibold text-neutral-600 uppercase">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {assignments.map((a) => (
                        <tr key={a.id} className="hover:bg-neutral-50">
                          <td className="px-4 py-2.5 text-neutral-800">{userName(a.userId)}</td>
                          <td className="px-4 py-2.5">
                            <span className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full bg-[var(--color-primary-bg-subtle)] text-[var(--color-primary)]">
                              {a.level}
                            </span>
                          </td>
                          <td className="px-4 py-2.5">
                            <span
                              className={`inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full ${
                                a.isActive
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : 'bg-red-100 text-red-700'
                              }`}
                            >
                              {a.isActive ? 'Activo' : 'Inactivo'}
                            </span>
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center justify-end gap-3">
                              <button
                                disabled={pending}
                                onClick={() => handleToggleActive(a)}
                                className="text-xs font-medium text-neutral-500 hover:text-[var(--color-primary)] disabled:opacity-50"
                              >
                                {a.isActive ? 'Desactivar' : 'Reactivar'}
                              </button>
                              <button
                                disabled={pending}
                                onClick={() => handleRevoke(a)}
                                className="text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
                              >
                                Revocar
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="border-t border-neutral-200 pt-4">
              <h3 className="text-sm font-semibold text-neutral-700 mb-2">Nuevo acceso</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-neutral-800 mb-1.5">Usuario</label>
                  <select
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    className="w-full px-3 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-focus-ring)] focus:border-[var(--color-primary)] text-sm bg-white"
                  >
                    <option value="">Seleccionar usuario...</option>
                    {loadingUsers ? (
                      <option disabled>Cargando usuarios...</option>
                    ) : (
                      (users as UserListItem[]).map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name} ({u.email})
                        </option>
                      ))
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-800 mb-1.5">Nivel</label>
                  <select
                    value={selectedLevel}
                    onChange={(e) => setSelectedLevel(e.target.value)}
                    className="w-full px-3 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-focus-ring)] focus:border-[var(--color-primary)] text-sm bg-white"
                  >
                    {PRODUCT_ACCESS_LEVELS.map((l) => (
                      <option key={l.value} value={l.value}>
                        {l.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex justify-end mt-3">
                <Button loading={pending} disabled={!selectedUserId} onClick={handleCreate}>
                  Asignar acceso
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}