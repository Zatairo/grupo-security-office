import { useQuery } from '@tanstack/react-query'
import api from '../../../services/api'
import type { Category, Brand, ProductListResponse } from '../types/product.types'

export interface ProductFilters {
  search?: string
  categoryId?: string
  brandId?: string
  catalogId?: string
  isVisible?: boolean
  isActive?: boolean
}

interface UseProductsOptions {
  filters: ProductFilters
  page: number
  pageSize: number
}

export function useProducts({ filters, page, pageSize }: UseProductsOptions) {
  const skip = (page - 1) * pageSize

  const productsQuery = useQuery({
    queryKey: ['products', filters, page, pageSize],
    queryFn: async () => {
      const params = new URLSearchParams()
      params.set('skip', String(skip))
      params.set('take', String(pageSize))
      if (filters.search) params.set('search', filters.search)
      if (filters.categoryId) params.set('categoryId', filters.categoryId)
      if (filters.brandId) params.set('brandId', filters.brandId)
      if (filters.catalogId) params.set('catalogId', filters.catalogId)
      if (filters.isVisible !== undefined) params.set('isVisible', String(filters.isVisible))
      if (filters.isActive !== undefined) params.set('isActive', String(filters.isActive))
      const res = await api.get(`/products?${params}`)
      return res.data as ProductListResponse
    },
  })

  const categoriesQuery = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const res = await api.get('/categories')
      return res.data.data as Category[]
    },
  })

  const brandsQuery = useQuery({
    queryKey: ['brands'],
    queryFn: async () => {
      const res = await api.get('/brands')
      return res.data.data as Brand[]
    },
  })

  return {
    products: productsQuery.data?.data,
    meta: productsQuery.data?.meta,
    total: productsQuery.data?.meta?.total ?? 0,
    categories: categoriesQuery.data ?? [],
    brands: brandsQuery.data ?? [],
    isLoading: productsQuery.isLoading,
    error: productsQuery.error ?? categoriesQuery.error ?? brandsQuery.error,
  }
}
