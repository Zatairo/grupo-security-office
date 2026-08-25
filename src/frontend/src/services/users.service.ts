import api from './api'

export interface UserListItem {
  id: string
  email: string
  name: string
  isActive: boolean
  createdAt: string
  updatedAt: string
  roles: { id: string; name: string }[]
}

interface UserListResponse {
  data: UserListItem[]
  meta?: { total: number; skip: number; take: number }
}

export const fetchUsers = async (search = '', take = 200): Promise<UserListItem[]> => {
  const params = new URLSearchParams()
  params.set('take', String(take))
  if (search.trim()) params.set('search', search.trim())
  const res = await api.get(`/users?${params}`)
  const body = res.data as UserListResponse
  return body.data ?? []
}