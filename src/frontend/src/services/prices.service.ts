import api from './api'

export interface PriceList {
  id: string
  name: string
  code: string
  currency: string
  isActive: boolean
  validFrom: string | null
  validUntil: string | null
  priceCount?: number
}

export interface Price {
  id: string
  productId: string
  priceListId: string
  listaId?: string | null
  value: number
  currency: string
  validFrom: string | null
  validUntil: string | null
  createdAt: string
  updatedAt: string
  product?: { id: string; sku: string; name: string }
  priceList?: { id: string; name: string; code: string; currency: string }
}

export interface PricePayload {
  productId: string
  priceListId: string
  value: number
  currency: string
  listaId?: string
  validFrom?: string
  validUntil?: string
}

export interface UpdatePricePayload {
  value?: number
  currency?: string
  listaId?: string
  validFrom?: string | null
  validUntil?: string | null
}

function asList(res: unknown): any[] {
  if (Array.isArray(res)) return res
  if (res && typeof res === 'object' && Array.isArray((res as { data?: unknown }).data)) {
    return (res as { data: any[] }).data
  }
  return []
}

export const fetchPriceLists = async (): Promise<PriceList[]> => {
  const res = await api.get('/prices/lists')
  return asList(res.data) as PriceList[]
}

export const fetchPricesByProduct = async (productId: string): Promise<Price[]> => {
  const res = await api.get(`/prices/product/${productId}`)
  return asList(res.data) as Price[]
}

export const createPrice = async (payload: PricePayload): Promise<Price> => {
  const res = await api.post('/prices', payload)
  return res.data as Price
}

export const updatePrice = async (id: string, payload: UpdatePricePayload): Promise<Price> => {
  const res = await api.put(`/prices/${id}`, payload)
  return res.data as Price
}

export const deletePrice = async (id: string): Promise<void> => {
  await api.delete(`/prices/${id}`)
}

export interface PriceListPayload {
  name: string
  code: string
  currency?: string
  isActive?: boolean
  validFrom?: string | null
  validUntil?: string | null
}

export const createPriceList = async (payload: PriceListPayload): Promise<PriceList> => {
  const res = await api.post('/prices/lists', payload)
  return res.data as PriceList
}

export const updatePriceList = async (id: string, payload: Partial<PriceListPayload>): Promise<PriceList> => {
  const res = await api.put(`/prices/lists/${id}`, payload)
  return res.data as PriceList
}

export const togglePriceListActive = async (id: string): Promise<PriceList> => {
  const res = await api.patch(`/prices/lists/${id}/toggle-active`)
  return res.data as PriceList
}

export const deletePriceList = async (id: string): Promise<void> => {
  await api.delete(`/prices/lists/${id}`)
}