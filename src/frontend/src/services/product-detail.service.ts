import api from './api'
import type { ProductImage } from '../features/products/types/product.types'

export interface ProductStock {
  id: string
  productId: string
  availableQty: number
  reservedQty: number
  location: string | null
  updatedAt: string
}

export interface AuditLog {
  id: string
  userId: string | null
  action: string
  entity: string
  entityId: string
  oldValues: Record<string, unknown> | null
  newValues: Record<string, unknown> | null
  createdAt: string
  user?: { id: string; name: string | null; email: string } | null
}

function asList(res: unknown): any[] {
  if (Array.isArray(res)) return res
  if (res && typeof res === 'object' && Array.isArray((res as { data?: unknown }).data)) {
    return (res as { data: any[] }).data
  }
  return []
}

export function isNotImplemented(error: unknown): boolean {
  const status = (error as { response?: { status?: number } })?.response?.status
  return status === 404 || status === 405 || status === 501
}

// ------------------------------ Stock ------------------------------
export const fetchProductStock = async (productId: string): Promise<ProductStock[]> => {
  const res = await api.get(`/products/${productId}/stock`)
  return asList(res.data) as ProductStock[]
}

export const updateProductStock = async (
  productId: string,
  payload: {
    quantity: number
    location?: string
    adjustmentType?: 'in' | 'out' | 'adjust'
    reason?: string
  }
): Promise<ProductStock> => {
  const res = await api.post(`/products/${productId}/stock`, payload)
  return res.data as ProductStock
}

// ------------------------------ Auditoría ------------------------------
export const fetchProductAudit = async (
  entity: string,
  entityId: string
): Promise<AuditLog[]> => {
  const res = await api.get(`/audit/${entity}/${entityId}`)
  return asList(res.data) as AuditLog[]
}

// ------------------------------ Proveedores (defensivo) ------------------------------
export const fetchProductSuppliers = async (productId: string): Promise<unknown[]> => {
  const res = await api.get(`/products/${productId}/suppliers`)
  return asList(res.data)
}

// ------------------------------ Publicación (defensivo) ------------------------------
export const publishProduct = async (
  productId: string,
  payload?: { publishAt?: string; unpublishAt?: string }
) => {
  const res = await api.patch(`/products/${productId}/publish`, payload ?? {})
  return res.data
}

export const unpublishProduct = async (productId: string, reason?: string) => {
  const res = await api.patch(`/products/${productId}/unpublish`, reason ? { reason } : {})
  return res.data
}

export const schedulePublish = async (
  productId: string,
  payload: { publishAt: string; unpublishAt?: string }
) => {
  const res = await api.patch(`/products/${productId}/publish`, payload)
  return res.data
}

// ------------------------------ Imágenes ------------------------------
export const uploadProductImage = async (
  productId: string,
  file: File,
  isPrimary = false
): Promise<ProductImage> => {
  const fd = new FormData()
  fd.append('file', file)
  if (isPrimary) fd.append('isPrimary', 'true')
  const res = await api.post(`/products/${productId}/images`, fd)
  return res.data as ProductImage
}

export const deleteProductImage = async (imageId: string): Promise<void> => {
  await api.delete(`/products/images/${imageId}`)
}

export const markProductImagePrimary = async (imageId: string) => {
  const res = await api.patch(`/products/images/${imageId}`, { isPrimary: true })
  return res.data
}