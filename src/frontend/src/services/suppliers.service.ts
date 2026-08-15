import api from './api'

export interface SupplierContact {
  phone?: string
  email?: string
  address?: string
  [key: string]: unknown
}

export interface Supplier {
  id: string
  name: string
  nit: string | null
  contact: SupplierContact | null
  category: string | null
  status: 'active' | 'inactive'
  rating: number | null
  evaluationCount?: number
  createdAt: string
  updatedAt: string
}

export interface SupplierPayload {
  name: string
  nit?: string | null
  contact?: SupplierContact | null
  category?: string | null
  status?: 'active' | 'inactive'
  rating?: number | null
}

export interface SupplierEvaluation {
  id: string
  supplierId: string
  score: number
  criteria: Record<string, unknown>
  date?: string | null
  createdAt: string
  evaluator?: { id: string; name: string; email: string } | null
}

export interface EvaluationPayload {
  criteria: Record<string, unknown>
  score: number
  date?: string | null
}

function asList(res: unknown): any[] {
  if (Array.isArray(res)) return res
  if (res && typeof res === 'object' && Array.isArray((res as { data?: unknown }).data)) {
    return (res as { data: any[] }).data
  }
  return []
}

export const fetchSuppliers = async (params?: { search?: string; status?: string }): Promise<Supplier[]> => {
  const searchParams = new URLSearchParams()
  if (params?.search) searchParams.set('search', params.search)
  if (params?.status) searchParams.set('status', params.status)
  const qs = searchParams.toString()
  const res = await api.get(qs ? `/suppliers?${qs}` : '/suppliers')
  return asList(res.data) as Supplier[]
}

export const createSupplier = async (payload: SupplierPayload): Promise<Supplier> => {
  const res = await api.post('/suppliers', payload)
  return res.data as Supplier
}

export const updateSupplier = async (id: string, payload: Partial<SupplierPayload>): Promise<Supplier> => {
  const res = await api.put(`/suppliers/${id}`, payload)
  return res.data as Supplier
}

export const deleteSupplier = async (id: string): Promise<void> => {
  await api.delete(`/suppliers/${id}`)
}

export const fetchSupplierEvaluations = async (supplierId: string): Promise<SupplierEvaluation[]> => {
  const res = await api.get(`/suppliers/${supplierId}/evaluations`)
  return asList(res.data) as SupplierEvaluation[]
}

export const createSupplierEvaluation = async (
  supplierId: string,
  payload: EvaluationPayload
): Promise<SupplierEvaluation> => {
  const res = await api.post(`/suppliers/${supplierId}/evaluations`, payload)
  return res.data as SupplierEvaluation
}