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
        <h1 className="text-2xl font-bold text-syscom-700">Usuarios</h1>
        <p className="text-sm text-gray-500 mt-1">Gestiona los usuarios internos del sistema</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Buscar por nombre o email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-syscom-500 focus:border-transparent"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gray-100 rounded-full"></div>
                <div className="flex-1">
                  <div className="h-4 bg-gray-100 rounded w-1/2 mb-2"></div>
                  <div className="h-3 bg-gray-100 rounded w-1/3"></div>
                </div>
              </div>
            </div>
          ))
        ) : users?.data?.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            <p className="text-gray-500 font-medium">No hay usuarios</p>
          </div>
        ) : (
          users?.data?.map((user: any) => (
            <div key={user.id} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-lg transition-shadow">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-syscom-100 rounded-full flex items-center justify-center">
                  <span className="text-sm font-bold text-syscom-700">
                    {user.name?.charAt(0).toUpperCase() || 'U'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-gray-900 truncate">{user.name}</h3>
                  <p className="text-xs text-gray-500 truncate">{user.email}</p>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <div className="flex gap-1.5 flex-wrap">
                  {user.roles?.map((role: any) => (
                    <span key={role.id} className="px-2 py-1 text-xs font-medium bg-syscom-100 text-syscom-700 rounded">
                      {role.name}
                    </span>
                  ))}
                </div>
                <span className={`px-2 py-1 text-xs font-medium rounded ${user.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                  {user.isActive ? 'Activo' : 'Inactivo'}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
