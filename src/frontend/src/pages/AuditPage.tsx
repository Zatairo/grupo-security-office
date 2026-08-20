import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '../services/api'
import { canViewAudit } from '../lib/rbac'

function formatAuditTimestamp(value: string | Date): string {
  const date = new Date(value)
  return `${date.toLocaleString()}.${String(date.getMilliseconds()).padStart(3, '0')}`
}

export default function AuditPage() {
  const [entity, setEntity] = useState('')
  const [action, setAction] = useState('')

  const { data: logs, isLoading } = useQuery({
    queryKey: ['audit', entity, action],
    queryFn: async () => {
      const params = new URLSearchParams()
      params.set('take', '100')
      if (entity) params.set('entity', entity)
      if (action) params.set('action', action)
      const res = await api.get(`/audit?${params}`)
      return res.data
    },
  })

  if (!canViewAudit()) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <svg className="w-16 h-16 text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        <p className="text-gray-500 font-medium">No tienes permisos para ver esta sección</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-security-700">Auditoría</h1>
        <p className="text-sm text-gray-500 mt-1">Historial de cambios y actividad del sistema</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <select
            value={entity}
            onChange={(e) => setEntity(e.target.value)}
            className="px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
          >
            <option value="">Todas las entidades</option>
            <option value="Product">Productos</option>
            <option value="Category">Categorías</option>
            <option value="Brand">Marcas</option>
            <option value="User">Usuarios</option>
            <option value="Price">Precios</option>
          </select>
          <select
            value={action}
            onChange={(e) => setAction(e.target.value)}
            className="px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
          >
            <option value="">Todas las acciones</option>
            <option value="CREATE">Crear</option>
            <option value="UPDATE">Actualizar</option>
            <option value="DELETE">Eliminar</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Fecha</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Usuario</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Acción</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Entidad</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">ID</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {isLoading ? (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-gray-400">Cargando...</td></tr>
            ) : logs?.data?.length === 0 ? (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-gray-400">No hay registros</td></tr>
            ) : (
              logs?.data?.map((log: any) => (
                <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-3 py-1.5 text-xs text-gray-500">{formatAuditTimestamp(log.createdAt)}</td>
                  <td className="px-3 py-1.5">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 bg-security-100 rounded-full flex items-center justify-center">
                        <span className="text-xs font-semibold text-security-700">
                          {log.user?.name?.charAt(0).toUpperCase() || 'S'}
                        </span>
                      </div>
                      <span className="text-xs text-gray-900">{log.user?.name || 'Sistema'}</span>
                    </div>
                  </td>
                  <td className="px-3 py-1.5">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded ${
                      log.action === 'CREATE' ? 'bg-emerald-100 text-emerald-700' :
                      log.action === 'UPDATE' ? 'bg-amber-100 text-amber-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        log.action === 'CREATE' ? 'bg-emerald-500' :
                        log.action === 'UPDATE' ? 'bg-amber-500' :
                        'bg-red-500'
                      }`}></span>
                      {log.action}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 text-xs text-gray-600">{log.entity}</td>
                  <td className="px-3 py-1.5 text-xs font-mono text-gray-500">{log.entityId?.substring(0, 8)}...</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
