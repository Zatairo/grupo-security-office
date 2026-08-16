import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  fetchPurchaseOrderDashboard,
  type PurchaseOrderDashboard,
  type PurchaseOrderStatus,
} from '../services/purchase-orders.service'
import { getApiErrorMessage } from '../lib/apiError'
import { formatDate } from '../lib/format'
import { Alert } from '../components/ui'

const PO_STATUS_LABELS: Record<PurchaseOrderStatus, string> = {
  solicitada: 'Solicitada',
  aprobada: 'Aprobada',
  en_transito: 'En tránsito',
  recibida: 'Recibida',
  cerrada: 'Cerrada',
  cancelada: 'Cancelada',
}

const PO_STATUS_ORDER: PurchaseOrderStatus[] = [
  'solicitada',
  'aprobada',
  'en_transito',
  'recibida',
  'cerrada',
  'cancelada',
]

function poBadgeClasses(status: string): string {
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
    default:
      return 'bg-neutral-100 text-neutral-600'
  }
}

function KpiCard({
  label,
  value,
  accent,
  hint,
}: {
  label: string
  value: string | number
  accent: string
  hint?: string
}) {
  return (
    <div className="bg-white rounded-xl border border-neutral-200 p-5">
      <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">{label}</p>
      <p className={`mt-2 text-3xl font-bold tabular-nums ${accent}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-neutral-400">{hint}</p>}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="bg-white rounded-xl border border-neutral-200 p-10 text-center">
      <p className="text-sm font-medium text-neutral-600">Sin datos de compras aún</p>
      <p className="text-xs text-neutral-400 mt-1">
        Cuando existan órdenes de compra, precios por vencer o stock bajo, verás aquí el resumen.
      </p>
      <Link
        to="/commercial/purchase-orders"
        className="inline-flex items-center gap-2 mt-4 px-4 py-2 text-sm font-medium text-white bg-security-700 rounded-md hover:bg-security-800 transition-colors"
      >
        Ver órdenes de compra
      </Link>
    </div>
  )
}

export default function PurchasingDashboardPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['purchase-dashboard'],
    queryFn: fetchPurchaseOrderDashboard,
  })

  const dashboard: PurchaseOrderDashboard | undefined = data

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-6 bg-neutral-100 rounded w-1/4 animate-pulse"></div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 bg-neutral-100 rounded-xl animate-pulse"></div>
          ))}
        </div>
        <div className="h-48 bg-neutral-100 rounded-xl animate-pulse"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-condensed font-bold text-security-800">Panel de Compras</h1>
        <Alert variant="error">{getApiErrorMessage(error, 'No se pudo cargar el panel de compras')}</Alert>
      </div>
    )
  }

  if (!dashboard) return null

  const hasAnyData =
    dashboard.openOrders > 0 ||
    dashboard.expiringPrices > 0 ||
    dashboard.lowStock > 0 ||
    dashboard.pendingSupplierEvaluations.count > 0 ||
    dashboard.recentOrders.length > 0

  if (!hasAnyData) return <EmptyState />

  const statusEntries = PO_STATUS_ORDER.filter((s) => (dashboard.ordersByStatus[s] ?? 0) > 0).map(
    (s) => ({ status: s, count: dashboard.ordersByStatus[s] ?? 0 }),
  )
  const maxStatusCount = Math.max(1, ...statusEntries.map((e) => e.count))
  const totalOrders = Object.values(dashboard.ordersByStatus).reduce((a, b) => a + b, 0)

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-condensed font-bold text-security-800">Panel de Compras</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Indicadores de órdenes de compra, proveedores y stock
          </p>
        </div>
        <Link
          to="/commercial/purchase-orders"
          className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-security-700 bg-security-50 rounded-lg hover:bg-security-100 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
          Ver órdenes
        </Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Órdenes abiertas"
          value={dashboard.openOrders}
          accent="text-security-700"
          hint="No cerradas ni canceladas"
        />
        <KpiCard
          label="Precios por vencer"
          value={dashboard.expiringPrices}
          accent="text-amber-600"
          hint="Próximos 30 días"
        />
        <KpiCard
          label="Stock bajo"
          value={dashboard.lowStock}
          accent="text-red-600"
          hint="Disponible ≤ mínimo"
        />
        <KpiCard
          label="Evaluaciones pendientes"
          value={dashboard.pendingSupplierEvaluations.count}
          accent="text-purple-600"
          hint="Sin evaluación o con más de 90 días"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-neutral-200 p-5">
          <h2 className="text-sm font-semibold text-neutral-700 mb-4">
            Órdenes por estado ({totalOrders})
          </h2>
          {statusEntries.length === 0 ? (
            <p className="text-sm text-neutral-400 py-4 text-center">Sin órdenes registradas.</p>
          ) : (
            <div className="space-y-3">
              {statusEntries.map(({ status, count }) => (
                <div key={status}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-neutral-600">{PO_STATUS_LABELS[status]}</span>
                    <span className="font-medium text-neutral-800 tabular-nums">{count}</span>
                  </div>
                  <div className="w-full h-2 bg-neutral-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${poBadgeClasses(status).split(' ')[0]}`}
                      style={{ width: `${(count / maxStatusCount) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-neutral-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-neutral-700">Evaluaciones pendientes de proveedores</h2>
            <Link to="/commercial/suppliers" className="text-xs font-medium text-security-700 hover:text-security-800">
              Ver proveedores
            </Link>
          </div>
          {dashboard.pendingSupplierEvaluations.suppliers.length === 0 ? (
            <p className="text-sm text-neutral-400 py-4 text-center">
              Todos los proveedores tienen evaluación reciente.
            </p>
          ) : (
            <ul className="space-y-2">
              {dashboard.pendingSupplierEvaluations.suppliers.slice(0, 6).map((s) => (
                <li key={s.id} className="flex items-center justify-between text-sm">
                  <span className="text-neutral-700">
                    {s.name}
                    {s.nit && <span className="text-xs text-neutral-400 font-mono ml-1">({s.nit})</span>}
                  </span>
                  <span className="text-xs text-neutral-400">
                    {s.lastEvaluationDate ? `Última: ${formatDate(s.lastEvaluationDate)}` : 'Sin evaluar'}
                  </span>
                </li>
              ))}
              {dashboard.pendingSupplierEvaluations.suppliers.length > 6 && (
                <li className="text-xs text-neutral-400 pt-1">
                  + {dashboard.pendingSupplierEvaluations.suppliers.length - 6} más
                </li>
              )}
            </ul>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-neutral-700">Últimas órdenes de compra</h2>
          <Link to="/commercial/purchase-orders" className="text-xs font-medium text-security-700 hover:text-security-800">
            Ver todas
          </Link>
        </div>
        {dashboard.recentOrders.length === 0 ? (
          <p className="text-sm text-neutral-400 py-6 text-center">Sin órdenes recientes.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-neutral-200 text-sm">
              <thead className="bg-neutral-50">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-neutral-600 uppercase">Código</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-neutral-600 uppercase">Proveedor</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-neutral-600 uppercase">Estado</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-neutral-600 uppercase">Productos</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-neutral-600 uppercase">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {dashboard.recentOrders.map((o) => (
                  <tr key={o.id}>
                    <td className="px-5 py-3 font-mono font-medium text-neutral-800">{o.code}</td>
                    <td className="px-5 py-3 text-neutral-700">{o.supplier?.name ?? '—'}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full ${poBadgeClasses(o.status)}`}>
                        {PO_STATUS_LABELS[o.status as PurchaseOrderStatus] ?? o.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-neutral-600">
                      {o.products.length === 0
                        ? '—'
                        : o.products.slice(0, 2).map((p) => p.name).join(', ') +
                          (o.products.length > 2 ? ` (+${o.products.length - 2})` : '')}
                    </td>
                    <td className="px-5 py-3 text-neutral-500 text-xs">{formatDate(o.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}