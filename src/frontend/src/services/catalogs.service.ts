import api from './api'

export interface Catalog {
  id: string
  name: string
  code: string
  description: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
  productCount?: number
  _count?: { products: number }
}

export interface CatalogPayload {
  name: string
  code: string
  description?: string | null
  isActive?: boolean
}

interface CatalogListResponse {
  data: Catalog[]
}

export function productCountOf(catalog: Catalog | undefined | null): number {
  if (!catalog) return 0
  return catalog.productCount ?? catalog._count?.products ?? 0
}

export const fetchCatalogs = async (): Promise<Catalog[]> => {
  const res = await api.get('/catalogs')
  const body = res.data as CatalogListResponse
  return body.data ?? []
}

export const fetchMyCatalogs = async (): Promise<Catalog[]> => {
  const res = await api.get('/catalogs/mine')
  const body = res.data as CatalogListResponse
  return body.data ?? []
}

export const fetchCatalogById = async (id: string): Promise<Catalog> => {
  const res = await api.get(`/catalogs/${id}`)
  return res.data as Catalog
}

export const createCatalog = async (payload: CatalogPayload): Promise<Catalog> => {
  const res = await api.post('/catalogs', payload)
  return res.data as Catalog
}

export const updateCatalog = async (
  id: string,
  payload: Partial<CatalogPayload>
): Promise<Catalog> => {
  const res = await api.patch(`/catalogs/${id}`, payload)
  return res.data as Catalog
}

export const deleteCatalog = async (id: string): Promise<void> => {
  await api.delete(`/catalogs/${id}`)
}
