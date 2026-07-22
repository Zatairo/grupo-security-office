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
      <div>
        <h1 className="text-2xl font-bold text-navy-900">Usuarios</h1>
        <p className="text-sm text-navy-500 mt-1">Gestiona los usuarios internos del sistema</p>
      </div>

      <div className="bg-white rounded-xl border border-navy-100 p-4">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-navy-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Buscar por nombre o email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-navy-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-transparent"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-navy-100 overflow-hidden">
        <table className="min-w-full divide-y divide-navy-100">
          <thead className="bg-navy-50">
            <tr>
              <th className="px-6 py-3.5 text-left text-xs font-semibold text-navy-600 uppercase tracking-wider">Usuario</th>
              <th className="px-6 py-3.5 text-left text-xs font-semibold text-navy-600 uppercase tracking-wider">Email</th>
              <th className="px-6 py-3.5 text-left text-xs font-semibold text-navy-600 uppercase tracking-wider">Roles</th>
              <th className="px-6 py-3.5 text-left text-xs font-semibold text-navy-600 uppercase tracking-wider">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-navy-100">
            {isLoading ? (
              <tr><td colSpan={4} className="px-6 py-12 text-center text-navy-400">Cargando...</td></tr>
            ) : users?.data?.length === 0 ? (
              <tr><td colSpan={4} className="px-6 py-12 text-center text-navy-400">No hay usuarios</td></tr>
            ) : (
              users?.data?.map((user: any) => (
                <tr key={user.id} className="hover:bg-navy-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-navy-100 rounded-full flex items-center justify-center">
                        <span className="text-sm font-semibold text-navy-600">
                          {user.name?.charAt(0).toUpperCase() || 'U'}
                        </span>
                      </div>
                      <span className="text-sm font-semibold text-navy-900">{user.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-navy-500">{user.email}</td>
                  <td className="px-6 py-4">
                    <div className="flex gap-1.5 flex-wrap">
                      {user.roles?.map((role: any) => (
                        <span key={role.id} className="px-2 py-1 text-xs font-medium bg-navy-100 text-navy-700 rounded-full">
                          {role.name}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full ${user.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${user.isActive ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
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
