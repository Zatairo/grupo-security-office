import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../services/api'
import { hasRole, hasPermission } from '../lib/rbac'
import { ROLES } from '../lib/roles'

interface User {
  id: string
  name: string
  email: string
  isActive: boolean
  roles: { id: string; name: string }[]
}

interface Role {
  id: string
  name: string
  permissions: string[]
  userCount?: number
}

export default function UsersPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(() => new Set())

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

  const { data: rolesData } = useQuery({
    queryKey: ['roles'],
    queryFn: async () => {
      const res = await api.get('/roles')
      return res.data.data
    },
    enabled: hasRole(ROLES.SUPER_ADMIN),
  })

  const toggleActive = useMutation({
    mutationFn: (user: User) =>
      api.put(`/users/${user.id}`, { isActive: !user.isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  })

  const deleteUser = useMutation({
    mutationFn: (id: string) => api.delete(`/users/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  })

  const toggleSelectUser = (id: string) => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const bulkDeleteUsers = () => {
    const count = selectedUserIds.size
    if (count === 0) return
    if (!window.confirm(`¿Eliminar ${count} usuario(s) seleccionado(s)? Esta acción no se puede deshacer.`)) return
    void Promise.allSettled(Array.from(selectedUserIds).map((id) => deleteUser.mutateAsync(id))).then(() => {
      setSelectedUserIds(new Set())
    })
  }

  if (!hasRole(ROLES.SUPER_ADMIN) && !hasPermission('users:read')) {
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-security-700">Usuarios</h1>
          <p className="text-sm text-gray-500 mt-1">Gestiona los usuarios internos del sistema</p>
        </div>
        {hasRole(ROLES.SUPER_ADMIN) && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-security-500 text-white rounded-lg font-semibold hover:bg-security-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nuevo Usuario
          </button>
        )}
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
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
          />
        </div>
      </div>

      {hasRole(ROLES.SUPER_ADMIN) && selectedUserIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 px-4 py-3 bg-white rounded-xl border border-gray-200">
          <span className="text-sm font-medium text-neutral-600">{selectedUserIds.size} seleccionado(s)</span>
          <button
            onClick={() => setSelectedUserIds(new Set())}
            className="text-sm text-neutral-500 hover:text-neutral-800 underline underline-offset-2"
          >
            Limpiar selección
          </button>
          <div className="ml-auto">
            <button
              onClick={bulkDeleteUsers}
              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 font-semibold text-sm transition-colors"
            >
              Eliminar seleccionados
            </button>
          </div>
        </div>
      )}

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
          users?.data?.map((user: User) => (
            <div key={user.id} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-lg transition-shadow">
              <div className="flex items-center gap-3">
                {hasRole(ROLES.SUPER_ADMIN) && (
                  <input
                    type="checkbox"
                    checked={selectedUserIds.has(user.id)}
                    onChange={() => toggleSelectUser(user.id)}
                    aria-label={`Seleccionar ${user.name}`}
                    className="h-4 w-4 accent-security-600 cursor-pointer"
                  />
                )}
                <div className="w-12 h-12 bg-security-100 rounded-full flex items-center justify-center">
                  <span className="text-sm font-bold text-security-700">
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
                  {user.roles?.map((role) => (
                    <span key={role.id} className="px-2 py-1 text-xs font-medium bg-security-100 text-security-700 rounded">
                      {role.name}
                    </span>
                  ))}
                </div>
                <span className={`px-2 py-1 text-xs font-medium rounded ${user.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                  {user.isActive ? 'Activo' : 'Inactivo'}
                </span>
              </div>

              {hasRole(ROLES.SUPER_ADMIN) && (
                <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
                  <button
                    onClick={() => setEditingUser(user)}
                    className="text-xs text-security-600 hover:text-security-800 font-medium"
                  >
                    Editar
                  </button>
                  <div className="flex gap-2">
                    <button
                      onClick={() => toggleActive.mutate(user)}
                      disabled={toggleActive.isPending}
                      className={`text-xs font-medium px-2 py-1 rounded ${
                        user.isActive
                          ? 'text-amber-600 hover:bg-amber-50'
                          : 'text-emerald-600 hover:bg-emerald-50'
                      }`}
                    >
                      {user.isActive ? 'Desactivar' : 'Activar'}
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`¿Eliminar usuario ${user.name}?`)) deleteUser.mutate(user.id)
                      }}
                      className="text-xs text-red-500 hover:bg-red-50 px-2 py-1 rounded"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {showCreateModal && (
        <UserModal
          roles={rolesData || []}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['users'] })
            setShowCreateModal(false)
          }}
        />
      )}

      {editingUser && (
        <UserModal
          user={editingUser}
          roles={rolesData || []}
          onClose={() => setEditingUser(null)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['users'] })
            setEditingUser(null)
          }}
        />
      )}
    </div>
  )
}

function UserModal({ user, roles, onClose, onSuccess }: { user?: User; roles: Role[]; onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    password: '',
    roleIds: user?.roles?.map(r => r.id) || [] as string[],
    isActive: user?.isActive ?? true,
  })

  const mutation = useMutation({
    mutationFn: (data: typeof form) => {
      const payload: Record<string, unknown> = {
        name: data.name,
        email: data.email,
        isActive: data.isActive,
        roleIds: data.roleIds,
      }
      if (data.password) payload.password = data.password
      return user ? api.put(`/users/${user.id}`, payload) : api.post('/users', payload)
    },
    onSuccess,
  })

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-lg shadow-2xl">
        <div className="px-6 py-4 border-b border-gray-200 bg-security-700 rounded-t-xl">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">{user ? 'Editar Usuario' : 'Nuevo Usuario'}</h2>
            <button onClick={onClose} className="p-2 text-security-200 hover:text-white hover:bg-security-600 rounded-lg transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(form) }} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Nombre</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              {user ? 'Nueva contraseña (dejar vacío para no cambiar)' : 'Contraseña'}
            </label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
              {...(!user ? { required: true, minLength: 8 } : { minLength: 8 })}
              placeholder={user ? '••••••••' : 'Mínimo 8 caracteres'}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Roles</label>
            <div className="space-y-2">
              {roles.map((role) => (
                <label key={role.id} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.roleIds.includes(role.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setForm({ ...form, roleIds: [...form.roleIds, role.id] })
                      } else {
                        setForm({ ...form, roleIds: form.roleIds.filter(id => id !== role.id) })
                      }
                    }}
                    className="w-4 h-4 text-security-600 border-gray-300 rounded focus:ring-brand-primary/30"
                  />
                  <span className="text-sm text-gray-700">{role.name}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                className="w-4 h-4 text-security-600 border-gray-300 rounded focus:ring-brand-primary/30"
              />
              <span className="text-sm font-medium text-gray-700">Usuario activo</span>
            </label>
          </div>
          <div className="flex gap-3 justify-end pt-4 border-t border-gray-200">
            <button type="button" onClick={onClose} className="px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={mutation.isPending} className="px-4 py-2.5 bg-security-500 text-white rounded-lg hover:bg-security-600 disabled:opacity-50 font-semibold transition-colors">
              {mutation.isPending ? 'Guardando...' : user ? 'Actualizar' : 'Crear'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
