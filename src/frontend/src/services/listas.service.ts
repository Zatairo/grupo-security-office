import api from './api'

export interface Lista {
  id: string
  code: string
  name: string
  description: string | null
  currency: string
  isActive: boolean
  archivedAt: string | null
  type?: string | null
  defaultVisibility?: boolean
  responsibleId?: string | null
  validFrom?: string | null
  validUntil?: string | null
  createdAt: string
  updatedAt: string
  productCount?: number
}

export interface ListaPayload {
  name: string
  code: string
  description?: string | null
  currency?: string
  isActive?: boolean
  archivedAt?: string | null
  type?: string | null
  defaultVisibility?: boolean
  responsibleId?: string | null
  validFrom?: string | null
  validUntil?: string | null
}

interface ListaListResponse {
  data: Lista[]
}

export const fetchListas = async (): Promise<Lista[]> => {
  const res = await api.get('/listas')
  const body = res.data as ListaListResponse
  return body.data ?? []
}

export const fetchListaById = async (id: string): Promise<Lista> => {
  const res = await api.get(`/listas/${id}`)
  return res.data as Lista
}

export const createLista = async (payload: ListaPayload): Promise<Lista> => {
  const res = await api.post('/listas', payload)
  return res.data as Lista
}

export const updateLista = async (id: string, payload: Partial<ListaPayload>): Promise<Lista> => {
  const res = await api.patch(`/listas/${id}`, payload)
  return res.data as Lista
}

export const toggleListaActive = async (id: string, isActive: boolean): Promise<Lista> => {
  const res = await api.patch(`/listas/${id}/toggle-active`, { isActive })
  return res.data as Lista
}

export const archiveLista = async (id: string): Promise<Lista> => {
  const res = await api.patch(`/listas/${id}/archive`)
  return res.data as Lista
}

export const restoreLista = async (id: string): Promise<Lista> => {
  const res = await api.patch(`/listas/${id}/restore`)
  return res.data as Lista
}

export const fetchListaProducts = async (id: string): Promise<any[]> => {
  const res = await api.get(`/listas/${id}/products`)
  return (res.data as any)?.data ?? []
}

export const fetchListaPrices = async (id: string): Promise<any[]> => {
  const res = await api.get(`/listas/${id}/prices`)
  return (res.data as any)?.data ?? []
}

export const fetchListaAssignments = async (id: string): Promise<any[]> => {
  const res = await api.get(`/listas/${id}/assignments`)
  return (res.data as any)?.data ?? []
}

export const fetchListaAudit = async (id: string): Promise<any[]> => {
  const res = await api.get(`/listas/${id}/audit`)
  return (res.data as any)?.data ?? []
}

export function productCountOf(lista: Lista | undefined | null): number {
  if (!lista) return 0
  return lista.productCount ?? 0
}
