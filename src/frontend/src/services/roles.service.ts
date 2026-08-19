import api from './api'

export interface Role {
  id: string
  name: string
  description?: string | null
  permissions: string[]
  userCount?: number
}

export interface RoleDetail extends Role {
  users: { id: string; name: string; email: string }[]
}

export interface RolePayload {
  name: string
  description?: string
  permissions: string[]
}

function asList(res: unknown): any[] {
  if (Array.isArray(res)) return res
  if (res && typeof res === 'object' && Array.isArray((res as { data?: unknown }).data)) {
    return (res as { data: any[] }).data
  }
  return []
}

export const fetchRoles = async (): Promise<Role[]> => {
  const res = await api.get('/roles')
  return asList(res.data) as Role[]
}

export const fetchRole = async (id: string): Promise<RoleDetail> => {
  const res = await api.get(`/roles/${id}`)
  return res.data as RoleDetail
}

export const createRole = async (payload: RolePayload): Promise<Role> => {
  const res = await api.post('/roles', payload)
  return res.data as Role
}

export const updateRole = async (id: string, payload: RolePayload): Promise<Role> => {
  const res = await api.put(`/roles/${id}`, payload)
  return res.data as Role
}

export const deleteRole = async (id: string): Promise<void> => {
  await api.delete(`/roles/${id}`)
}