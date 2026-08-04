export interface ProductImage {
  id: string
  url: string
  isPrimary: boolean
  alt?: string | null
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

export interface Product {
  id: string
  sku: string
  name: string
  description: string | null
  categoryId: string
  brandId: string
  technicalSpecs: Record<string, unknown> | null
  extraAttributes?: Record<string, unknown> | null
  isActive: boolean
  isVisible: boolean
  category: { id: string; name: string; slug: string }
  brand: { id: string; name: string; slug: string }
  images: ProductImage[]
  prices: ProductPrice[]
  createdAt: string
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
