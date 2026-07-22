import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '../services/api'

export default function UsersPage() {
  const [search, setSearch] = useState('')

  const { data: users, isLoading } = useQuery({
    queryKey: ['users', search],
    queryFn: async () => {
      const params = new URLSearchParams()
      params.set('take', '100')
      if (search) params.set('search', search)
      const res = await api.get(`/users?${params}`)
      return res.data
    },
  })

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Usuarios</h1>

      <div className="bg-white p-4 rounded-lg shadow">
        <input
          type="text"
          placeholder="Buscar por nombre o email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nombre</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Roles</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {isLoading ? (
              <tr><td colSpan={4} className="px-6 py-4 text-center text-gray-500">Cargando...</td></tr>
            ) : users?.data?.length === 0 ? (
              <tr><td colSpan={4} className="px-6 py-4 text-center text-gray-500">No hay usuarios</td></tr>
            ) : (
              users?.data?.map((user: any) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{user.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{user.email}</td>
                  <td className="px-6 py-4 text-sm">
                    <div className="flex gap-1 flex-wrap">
                      {user.roles?.map((role: any) => (
                        <span key={role.id} className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                          {role.name}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs rounded-full ${user.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {user.isActive ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
