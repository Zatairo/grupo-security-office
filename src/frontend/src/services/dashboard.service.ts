import api from './api'
import type { Product } from '../features/products/types/product.types'

export interface DashboardListResult {
  data: Product[]
  total: number
}

export interface UserSummary {
  id: string
  name: string
  email: string
  isActive: boolean
  roles: Array<{ id: string; name: string }>
}

interface PaginatedResponse<T> {
  data: T[]
  meta?: { total: number; skip: number; take: number }
}

export const fetchLatestProducts = async (take = 6): Promise<DashboardListResult> => {
  const res = await api.get(`/products?take=${take}`)
  const body = res.data as PaginatedResponse<Product>
  return { data: body.data ?? [], total: body.meta?.total ?? 0 }
}

export const fetchPendingPublication = async (take = 5): Promise<DashboardListResult> => {
  const res = await api.get(`/products?take=${take}&isVisible=false`)
  const body = res.data as PaginatedResponse<Product>
  return { data: body.data ?? [], total: body.meta?.total ?? 0 }
}

export const fetchActiveUsers = async (take = 100): Promise<number> => {
  const res = await api.get(`/users?take=${take}`)
  const body = res.data as PaginatedResponse<UserSummary>
  return (body.data ?? []).filter((user) => user.isActive).length
}

export const fetchAuditEventsTotal = async (): Promise<number> => {
  const res = await api.get('/audit?take=1')
  const body = res.data as PaginatedResponse<unknown>
  return body.meta?.total ?? 0
}
