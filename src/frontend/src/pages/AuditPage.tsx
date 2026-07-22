import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '../services/api'

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-syscom-700">Auditoría</h1>
        <p className="text-sm text-gray-500 mt-1">Historial de cambios y actividad del sistema</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <select
            value={entity}
            onChange={(e) => setEntity(e.target.value)}
            className="px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-syscom-500 focus:border-transparent"
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
            className="px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-syscom-500 focus:border-transparent"
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
              <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Fecha</th>
              <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Usuario</th>
              <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Acción</th>
              <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Entidad</th>
              <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">ID</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {isLoading ? (
              <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-400">Cargando...</td></tr>
            ) : logs?.data?.length === 0 ? (
              <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-400">No hay registros</td></tr>
            ) : (
              logs?.data?.map((log: any) => (
                <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 text-sm text-gray-500">{new Date(log.createdAt).toLocaleString()}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 bg-syscom-100 rounded-full flex items-center justify-center">
                        <span className="text-xs font-semibold text-syscom-700">
                          {log.user?.name?.charAt(0).toUpperCase() || 'S'}
                        </span>
                      </div>
                      <span className="text-sm text-gray-900">{log.user?.name || 'Sistema'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded ${
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
                  <td className="px-6 py-4 text-sm text-gray-600">{log.entity}</td>
                  <td className="px-6 py-4 text-sm font-mono text-gray-500">{log.entityId?.substring(0, 8)}...</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
