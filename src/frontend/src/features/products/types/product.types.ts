export interface ProductImage {
  id: string
  url: string
  isPrimary: boolean
  alt?: string | null
}

export interface ProductDocument {
  name: string
  url: string
  type?: string
  size?: number
}

export interface ProductPrice {
  id: string
  value: number
  currency: string
  validFrom: string | null
  validUntil: string | null
  priceList: { id: string; name: string; code: string }
}

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

/** Estados de la FSM de ciclo de vida (fuente de verdad, etapa 2 backend). */
export type LifecycleStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'

/**
 * Eventos de negocio de la FSM que un usuario puede disparar. Solo el contrato
 * canónico del backend. DELETE se gestiona aparte (borrado físico), no como
 * evento de transición.
 */
export type LifecycleEvent = 'PUBLISH' | 'UNPUBLISH' | 'ARCHIVE' | 'RESTORE'

export interface Product {
  id: string
  sku: string
  name: string
  description: string | null
  categoryId: string
  brandId: string
  listaId?: string | null
  technicalSpecs: Record<string, unknown> | null
  extraAttributes?: Record<string, unknown> | null
  isActive: boolean
  isVisible: boolean
  publishStatus?: 'borrador' | 'listo' | 'programado' | 'publicado' | 'archivado' | string | null
  /** Estado FSM (backend). Puede llegar null/undefined en registros legacy hasta backfill. */
  lifecycleStatus?: LifecycleStatus | null
  /** Eventos que el usuario puede disparar dado su rol+ACL+estado (findOne/transition). */
  allowedActions?: LifecycleEvent[]
  publishedAt?: string | null
  publishAt?: string | null
  unpublishAt?: string | null
  unpublishReason?: string | null
  stockStatus?: 'in_stock' | 'out_of_stock' | 'no_stock_data' | string | null
  availableQty?: number | null
  category: { id: string; name: string; slug: string }
  brand: { id: string; name: string; slug: string }
  images: ProductImage[]
  documents?: ProductDocument[]
  prices: ProductPrice[]
  createdAt: string
  updatedAt: string
}

export interface ProductPriceInput {
  priceListId: string
  value: number
  currency: string
  validFrom?: string
  validUntil?: string
}

export interface ProductPayload {
  sku: string
  name: string
  description?: string | null
  categoryId: string
  brandId: string
  listaId?: string
  technicalSpecs?: Record<string, unknown> | null
  extraAttributes?: Record<string, unknown> | null
  isActive?: boolean
  isVisible?: boolean
  prices?: ProductPriceInput[]
}

export interface ProductListResponse {
  data: Product[]
  meta: { total: number; skip: number; take: number }
}

export interface Category {
  id: string
  name: string
  slug: string
}

export interface Brand {
  id: string
  name: string
  slug: string
}
