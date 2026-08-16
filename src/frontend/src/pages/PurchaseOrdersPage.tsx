import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../services/api'
import {
  fetchPurchaseOrders,
  fetchPurchaseOrder,
  createPurchaseOrder,
  updatePurchaseOrderStatus,
  parsePoItems,
  PURCHASE_ORDER_STATUSES,
  type PurchaseOrderStatus,
  type PurchaseOrderItem,
  type PurchaseOrderPayload,
} from '../services/purchase-orders.service'
import { fetchSuppliers } from '../services/suppliers.service'
import { hasPermission, hasRole } from '../lib/rbac'
import { ROLES } from '../lib/roles'
import { getApiErrorMessage } from '../lib/apiError'
import { formatDate } from '../lib/format'
import { Button, Modal, Alert } from '../components/ui'

const PO_STATUS_LABELS: Record<PurchaseOrderStatus, string> = {
  solicitada: 'Solicitada',
  aprobada: 'Aprobada',
  en_transito: 'En tránsito',
  recibida: 'Recibida',
  cerrada: 'Cerrada',
  cancelada: 'Cancelada',
}

const PO_TRANSITIONS: Partial<
  Record<PurchaseOrderStatus, Array<{ to: PurchaseOrderStatus; label: string; danger?: boolean }>>
> = {
  solicitada: [
    { to: 'aprobada', label: 'Aprobar' },
    { to: 'cancelada', label: 'Cancelar', danger: true },
  ],
  aprobada: [
    { to: 'en_transito', label: 'En tránsito' },
    { to: 'cancelada', label: 'Cancelar', danger: true },
  ],
  en_transito: [
    { to: 'recibida', label: 'Recibir' },
    { to: 'cancelada', label: 'Cancelar', danger: true },
  ],
  recibida: [{ to: 'cerrada', label: 'Cerrar' }],
  cerrada: [],
  cancelada: [],
}

function poBadgeClasses(status: PurchaseOrderStatus): string {
  switch (status) {
    case 'solicitada':
      return 'bg-blue-100 text-blue-700'
    case 'aprobada':
      return 'bg-emerald-100 text-emerald-700'
    case 'en_transito':
      return 'bg-amber-100 text-amber-700'
    case 'recibida':
      return 'bg-purple-100 text-purple-700'
    case 'cerrada':
      return 'bg-neutral-200 text-neutral-600'
    case 'cancelada':
      return 'bg-red-100 text-red-700'
  }
}

function PoBadge({ status }: { status: PurchaseOrderStatus }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full ${poBadgeClasses(status)}`}>
      {PO_STATUS_LABELS[status]}
    </span>
  )
}

const fieldClass =
  'w-full px-3 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-focus-ring)] focus:border-[var(--color-primary)] text-sm'

export default function PurchaseOrdersPage() {
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilter] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const canWrite = hasPermission('products:write') || hasRole(ROLES.SUPER_ADMIN)
  const canDelete = hasRole(ROLES.SUPER_ADMIN)

  const { data: orders, isLoading } = useQuery({
    queryKey: ['purchase-orders', statusFilter],
    queryFn: () => fetchPurchaseOrders({ status: statusFilter || undefined }),
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
    queryClient.invalidateQueries({ queryKey: ['purchase-order'] })
    queryClient.invalidateQueries({ queryKey: ['purchase-dashboard'] })
  }

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/purchase-orders/${id}`)
    },
    onSuccess: () => {
      invalidate()
      setDetailId(null)
      setActionError(null)
    },
    onError: (err) => {
      setActionError(getApiErrorMessage(err, 'No se pudo eliminar la orden'))
    },
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-condensed font-bold text-security-800">Órdenes de Compra</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Gestión de órdenes de compra y sus estados
          </p>
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
              setCreateOpen(true)
            }}
          >
            Nueva Orden
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
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-focus-ring)] focus:border-[var(--color-primary)] text-sm bg-white"
          aria-label="Filtrar por estado"
        >
          <option value="">Todos los estados</option>
          {PURCHASE_ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {PO_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-neutral-200">
            <thead className="bg-neutral-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider">Código</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider">Proveedor</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider">Estado</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-neutral-600 uppercase tracking-wider">Items</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider">Creada</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-neutral-600 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-neutral-400">Cargando...</td>
                </tr>
              ) : !orders || orders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-neutral-400">
                    {statusFilter
                      ? 'No hay órdenes en este estado'
                      : 'No hay órdenes de compra registradas'}
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr
                    key={order.id}
                    className="hover:bg-neutral-50 transition-colors cursor-pointer"
                    onClick={() => {
                      setActionError(null)
                      setDetailId(order.id)
                    }}
                  >
                    <td className="px-6 py-4 text-sm font-mono font-medium text-neutral-800">{order.code}</td>
                    <td className="px-6 py-4 text-sm text-neutral-700">
                      {order.supplier?.name ?? '—'}
                      {order.supplier?.nit && (
                        <span className="text-xs text-neutral-400 font-mono ml-1">({order.supplier.nit})</span>
                      )}
                    </td>
                    <td className="px-6 py-4"><PoBadge status={order.status} /></td>
                    <td className="px-6 py-4 text-right text-sm text-neutral-600 tabular-nums">
                      {parsePoItems(order.items).length}
                    </td>
                    <td className="px-6 py-4 text-sm text-neutral-500">{formatDate(order.createdAt)}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setActionError(null)
                            setDetailId(order.id)
                          }}
                          className="p-2 text-neutral-400 hover:text-[var(--color-primary)] hover:bg-[var(--color-primary-bg-subtle)] rounded-lg transition-colors"
                          title="Ver detalle"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {createOpen && (
        <CreatePurchaseOrderModal
          onClose={() => setCreateOpen(false)}
          onSaved={() => {
            invalidate()
            setCreateOpen(false)
            setActionError(null)
          }}
          onError={(err) => setActionError(getApiErrorMessage(err, 'No se pudo crear la orden'))}
        />
      )}

      {detailId && (
        <PurchaseOrderDetailModal
          orderId={detailId}
          onClose={() => setDetailId(null)}
          onChanged={invalidate}
          canWrite={canWrite}
          canDelete={canDelete}
          onDelete={() => removeMutation.mutate(detailId)}
          onError={(err) => setActionError(getApiErrorMessage(err, 'Error'))}
        />
      )}
    </div>
  )
}

// ------------------------------ Productos para los selects ------------------------------
function useProductsForPo() {
  return useQuery({
    queryKey: ['products-for-po'],
    queryFn: async () => {
      const res = await api.get('/products', { params: { take: 200 } })
      const body = res.data as { data?: Array<{ id: string; sku: string; name: string }> }
      return Array.isArray(res.data) ? (res.data as any[]) : (body.data ?? [])
    },
    staleTime: 5 * 60 * 1000,
  })
}

// ------------------------------ Crear orden ------------------------------
function CreatePurchaseOrderModal({
  onClose,
  onSaved,
  onError,
}: {
  onClose: () => void
  onSaved: () => void
  onError: (error: unknown) => void
}) {
  const [supplierId, setSupplierId] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<PurchaseOrderItem[]>([{ productId: '', quantity: 1 }])
  const [error, setError] = useState<string | null>(null)

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => fetchSuppliers(),
  })
  const { data: products = [] } = useProductsForPo()

  const mutation = useMutation({
    mutationFn: (payload: PurchaseOrderPayload) => createPurchaseOrder(payload),
    onSuccess: onSaved,
    onError: (err) => {
      setError(getApiErrorMessage(err, 'No se pudo crear la orden'))
      onError(err)
    },
  })

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!supplierId) {
      setError('Selecciona un proveedor')
      return
    }
    const cleanItems = items
      .filter((i) => i.productId && Number(i.quantity) > 0)
      .map((i) => ({ productId: i.productId, quantity: Number(i.quantity) }))
    if (cleanItems.length === 0) {
      setError('Agrega al menos un producto con cantidad mayor a 0')
      return
    }
    mutation.mutate({
      supplierId,
      items: cleanItems,
      notes: notes.trim() || undefined,
    })
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Nueva Orden de Compra"
      size="lg"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" form="po-create-form" loading={mutation.isPending}>Crear orden</Button>
        </>
      }
    >
      <form id="po-create-form" onSubmit={submit} className="space-y-4">
        {(error || mutation.isError) && (
          <Alert variant="error">
            {error || getApiErrorMessage(mutation.error, 'No se pudo crear la orden')}
          </Alert>
        )}

        <div>
          <label className="block text-sm font-medium text-neutral-800 mb-1.5">
            Proveedor <span className="text-red-500">*</span>
          </label>
          <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className={fieldClass}>
            <option value="">Seleccionar proveedor...</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.nit ? ` (${s.nit})` : ''}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-800 mb-1.5">Productos</label>
          <div className="space-y-2">
            {items.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <select
                  value={item.productId}
                  onChange={(e) =>
                    setItems(items.map((it, i) => (i === idx ? { ...it, productId: e.target.value } : it)))
                  }
                  className={fieldClass}
                  aria-label={`Producto ${idx + 1}`}
                >
                  <option value="">Seleccionar producto...</option>
                  {products.map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.sku} — {p.name}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min="1"
                  value={item.quantity}
                  onChange={(e) =>
                    setItems(items.map((it, i) => (i === idx ? { ...it, quantity: Number(e.target.value) } : it)))
                  }
                  className={`${fieldClass} w-24`}
                  aria-label={`Cantidad ${idx + 1}`}
                />
                <button
                  type="button"
                  disabled={items.length === 1}
                  onClick={() => setItems(items.filter((_, i) => i !== idx))}
                  className="p-2 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40"
                  title="Quitar producto"
                  aria-label="Quitar producto"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setItems([...items, { productId: '', quantity: 1 }])}
            className="mt-2 px-3 py-2 border border-dashed border-neutral-300 rounded-lg text-sm text-neutral-500 hover:text-[var(--color-primary)] hover:border-[var(--color-primary)] transition-colors"
          >
            + Agregar producto
          </button>
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-800 mb-1.5">Notas</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={`${fieldClass} resize-none`}
            rows={3}
            maxLength={500}
            placeholder="Observaciones de la orden (opcional)"
          />
        </div>
      </form>
    </Modal>
  )
}

// ------------------------------ Detalle ------------------------------
function PurchaseOrderDetailModal({
  orderId,
  onClose,
  onChanged,
  canWrite,
  canDelete,
  onDelete,
  onError,
}: {
  orderId: string
  onClose: () => void
  onChanged: () => void
  canWrite: boolean
  canDelete: boolean
  onDelete: () => void
  onError: (error: unknown) => void
}) {
  const queryClient = useQueryClient()
  const [comment, setComment] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)

  const { data: order, isLoading, error } = useQuery({
    queryKey: ['purchase-order', orderId],
    queryFn: () => fetchPurchaseOrder(orderId),
  })

  const { data: products = [] } = useProductsForPo()

  const statusMutation = useMutation({
    mutationFn: ({ status, comment: c }: { status: PurchaseOrderStatus; comment?: string }) =>
      updatePurchaseOrderStatus(orderId, { status, comment: c }),
    onSuccess: () => {
      setComment('')
      setActionError(null)
      onChanged()
      queryClient.invalidateQueries({ queryKey: ['purchase-order', orderId] })
    },
    onError: (err) => {
      setActionError(getApiErrorMessage(err, 'No se pudo actualizar el estado'))
      onError(err)
    },
  })

  const productMap = new Map<string, { id: string; sku: string; name: string }>()
  for (const p of products) productMap.set(p.id, p)

  const transitions = (order ? PO_TRANSITIONS[order.status] : undefined) ?? []
  const history = order?.history ?? []

  return (
    <Modal
      open
      onClose={onClose}
      title={order ? `Orden ${order.code}` : 'Detalle de la orden'}
      size="xl"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>Cerrar</Button>
        </>
      }
    >
      {isLoading ? (
        <p className="text-sm text-neutral-400 text-center py-8">Cargando orden...</p>
      ) : error || !order ? (
        <Alert variant="error">
          {getApiErrorMessage(error, 'No se pudo cargar la orden')}
        </Alert>
      ) : (
        <div className="space-y-6">
          {(actionError || statusMutation.isError) && (
            <Alert variant="error">
              {actionError || getApiErrorMessage(statusMutation.error, 'No se pudo actualizar el estado')}
            </Alert>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-neutral-400 uppercase tracking-wide">Proveedor</p>
              <p className="text-sm font-medium text-neutral-800">
                {order.supplier?.name ?? '—'}
                {order.supplier?.nit && (
                  <span className="text-xs text-neutral-400 font-mono ml-1">({order.supplier.nit})</span>
                )}
              </p>
            </div>
            <div>
              <p className="text-xs text-neutral-400 uppercase tracking-wide">Estado</p>
              <PoBadge status={order.status} />
            </div>
            <div>
              <p className="text-xs text-neutral-400 uppercase tracking-wide">Creada</p>
              <p className="text-sm text-neutral-700">{formatDate(order.createdAt)}</p>
            </div>
            <div>
              <p className="text-xs text-neutral-400 uppercase tracking-wide">Solicitada por</p>
              <p className="text-sm text-neutral-700">
                {order.requestedBy?.name ?? order.requestedBy?.email ?? 'Sistema'}
              </p>
            </div>
          </div>

          {order.notes && (
            <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-3 text-sm text-neutral-600">
              <span className="font-medium text-neutral-700">Notas: </span>
              {order.notes}
            </div>
          )}

          <div>
            <h3 className="text-sm font-medium text-neutral-700 mb-2">Productos ({parsePoItems(order.items).length})</h3>
            <div className="border border-neutral-200 rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-neutral-200 text-sm">
                <thead className="bg-neutral-50">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-neutral-600 uppercase">SKU</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-neutral-600 uppercase">Producto</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-neutral-600 uppercase">Cantidad</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {parsePoItems(order.items).map((item, idx) => {
                    const product = productMap.get(item.productId)
                    return (
                      <tr key={idx}>
                        <td className="px-4 py-2.5 font-mono text-xs text-neutral-500">
                          {product?.sku ?? item.productId.slice(0, 8)}
                        </td>
                        <td className="px-4 py-2.5 text-neutral-700">
                          {product?.name ?? item.productId}
                        </td>
                        <td className="px-4 py-2.5 text-right text-neutral-700 tabular-nums">{item.quantity}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {canWrite && transitions.length > 0 && (
            <div className="border border-neutral-200 rounded-lg p-4">
              <h3 className="text-sm font-medium text-neutral-700 mb-2">Transición de estado</h3>
              <div className="flex flex-wrap items-center gap-2">
                {transitions.map((t) => (
                  <Button
                    key={t.to}
                    variant={t.danger ? 'danger' : 'primary'}
                    loading={statusMutation.isPending}
                    onClick={() => statusMutation.mutate({ status: t.to, comment: comment.trim() || undefined })}
                  >
                    {t.label}
                  </Button>
                ))}
                <input
                  type="text"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className={`${fieldClass} flex-1 min-w-[200px]`}
                  placeholder="Comentario (opcional)"
                  maxLength={500}
                />
              </div>
              {order.status === 'en_transito' && (
                <p className="text-xs text-neutral-400 mt-2">
                  Al recibir la orden se incrementará el stock de los productos incluidos.
                </p>
              )}
            </div>
          )}

          <div>
            <h3 className="text-sm font-medium text-neutral-700 mb-2">Historial</h3>
            {history.length === 0 ? (
              <p className="text-sm text-neutral-400 py-2">Sin eventos registrados.</p>
            ) : (
              <ol className="space-y-3">
                {[...history].reverse().map((entry) => {
                  const isStatusChange = entry.action === 'status_change'
                  const fromStatus = (entry.oldValues as { status?: string } | null)?.status
                  const toStatus = (entry.newValues as { status?: string } | null)?.status
                  const entryComment = (entry.newValues as { comment?: string } | null)?.comment
                  return (
                    <li key={entry.id} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <span className={`w-2 h-2 rounded-full mt-1.5 ${isStatusChange ? 'bg-[var(--color-primary)]' : 'bg-neutral-300'}`} />
                        <span className="w-px flex-1 bg-neutral-200" />
                      </div>
                      <div className="pb-1">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-medium text-neutral-800">
                            {isStatusChange
                              ? `${fromStatus ? PO_STATUS_LABELS[fromStatus as PurchaseOrderStatus] ?? fromStatus : '—'} → ${toStatus ? PO_STATUS_LABELS[toStatus as PurchaseOrderStatus] ?? toStatus : '—'}`
                              : entry.action === 'create'
                                ? 'Orden creada'
                                : entry.action}
                          </span>
                        </div>
                        <p className="text-xs text-neutral-400">
                          {new Date(entry.createdAt).toLocaleString('es-CL')}
                          {entry.user && ` · ${entry.user.name ?? entry.user.email}`}
                        </p>
                        {entryComment && (
                          <p className="text-xs text-neutral-600 mt-0.5">“{entryComment}”</p>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ol>
            )}
          </div>

          {canDelete && (
            <div className="flex justify-end border-t border-neutral-100 pt-4">
              <Button
                variant="danger"
                onClick={() => {
                  if (window.confirm(`¿Eliminar la orden ${order.code}?`)) onDelete()
                }}
              >
                Eliminar orden
              </Button>
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}