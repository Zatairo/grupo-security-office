export interface Product {
  id: string
  sku: string
  name: string
  description: string | null
  categoryId: string
  brandId: string
  technicalSpecs: Record<string, unknown> | null
  isActive: boolean
  isVisible: boolean
  category: { id: string; name: string; slug: string }
  brand: { id: string; name: string; slug: string }
  images: Array<{ id: string; url: string; isPrimary: boolean }>
  prices: Array<{
    id: string
    value: number
    currency: string
    priceList: { id: string; name: string; code: string }
  }>
  createdAt: string
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
