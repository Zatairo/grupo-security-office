import api from './api'
import type {
  LifecycleEvent,
  LifecycleStatus,
  Product,
  ProductImage,
} from '../features/products/types/product.types'

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

// ------------------------------ Ciclo de vida FSM ------------------------------
export interface TransitionPayload {
  event: LifecycleEvent
  reason?: string
  confirm?: boolean
}

export interface BulkTransitionPayload extends TransitionPayload {
  ids: string[]
}

export interface BulkTransitionApplied {
  id: string
  lifecycleStatus: LifecycleStatus
}

export interface BulkTransitionRejected {
  id: string
  reason: string
}

export interface BulkTransitionResult {
  applied: BulkTransitionApplied[]
  rejected: BulkTransitionRejected[]
}

/** Aplica una transición FSM sobre un producto. Devuelve el producto con allowedActions. */
export const transitionProduct = async (
  productId: string,
  payload: TransitionPayload
): Promise<Product> => {
  const res = await api.post(`/products/${productId}/transition`, payload)
  return res.data as Product
}

/** Aplica un evento FSM a varios productos (1..500). Devuelve { applied, rejected }. */
export const bulkTransitionProducts = async (
  payload: BulkTransitionPayload
): Promise<BulkTransitionResult> => {
  const res = await api.post('/products/bulk-transition', payload)
  return res.data as BulkTransitionResult
}

/**
 * Borrado físico de un producto.
 * El body viaja en `data` de axios (requisito del DTO DeleteProductDto).
 * - Si el usuario tiene clave personal configurada y no se envía `clave`, el backend
 *   responde 409 (code CLAVE_USUARIO_REQUERIDA); clave incorrecta -> 403 (code CLAVE_USUARIO_INCORRECTA).
 */
export const deleteProduct = async (
  productId: string,
  options?: { clave?: string },
): Promise<{ message: string }> => {
  const res = await api.delete(`/products/${productId}`, {
    data: {
      confirm: true,
      ...(options?.clave ? { clave: options.clave } : {}),
    },
  })
  return res.data as { message: string }
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
export interface ProductSupplier {
  id: string
  name: string
  nit: string | null
  category: string | null
  lastOrderAt?: string | null
}

export const fetchProductSuppliers = async (productId: string): Promise<ProductSupplier[]> => {
  const res = await api.get(`/products/${productId}/suppliers`)
  return asList(res.data) as ProductSupplier[]
}

// ------------------------------ Publicación (defensivo) ------------------------------
export const publishProduct = async (
  productId: string,
  payload?: { publishAt?: string }
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
  payload: { publishAt: string }
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

export const updateProductImageAlt = async (imageId: string, alt: string) => {
  const res = await api.patch(`/products/images/${imageId}`, { alt })
  return res.data
}