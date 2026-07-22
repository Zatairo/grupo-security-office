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
      <h1 className="text-2xl font-bold text-gray-900">Auditoría</h1>

      <div className="bg-white p-4 rounded-lg shadow flex gap-4">
        <select value={entity} onChange={(e) => setEntity(e.target.value)} className="px-3 py-2 border rounded-lg">
          <option value="">Todas las entidades</option>
          <option value="Product">Productos</option>
          <option value="Category">Categorías</option>
          <option value="Brand">Marcas</option>
          <option value="User">Usuarios</option>
          <option value="Price">Precios</option>
        </select>
        <select value={action} onChange={(e) => setAction(e.target.value)} className="px-3 py-2 border rounded-lg">
          <option value="">Todas las acciones</option>
          <option value="CREATE">Crear</option>
          <option value="UPDATE">Actualizar</option>
          <option value="DELETE">Eliminar</option>
        </select>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Usuario</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acción</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Entidad</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {isLoading ? (
              <tr><td colSpan={5} className="px-6 py-4 text-center text-gray-500">Cargando...</td></tr>
            ) : logs?.data?.length === 0 ? (
              <tr><td colSpan={5} className="px-6 py-4 text-center text-gray-500">No hay registros</td></tr>
            ) : (
              logs?.data?.map((log: any) => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-500">{new Date(log.createdAt).toLocaleString()}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{log.user?.name || 'Sistema'}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      log.action === 'CREATE' ? 'bg-green-100 text-green-800' :
                      log.action === 'UPDATE' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {log.action}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{log.entity}</td>
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
