import { useQuery } from '@tanstack/react-query'
import api from '../../../services/api'
import type { Product, Category, Brand } from '../types/product.types'

export function useProducts(search: string) {
  const productsQuery = useQuery({
    queryKey: ['products', search],
    queryFn: async () => {
      const params = new URLSearchParams()
      params.set('take', '100')
      if (search) params.set('search', search)
      const res = await api.get(`/products?${params}`)
      return res.data as { data: Product[] }
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
    products: productsQuery.data,
    categories: categoriesQuery.data ?? [],
    brands: brandsQuery.data ?? [],
    isLoading: productsQuery.isLoading,
    error: productsQuery.error ?? categoriesQuery.error ?? brandsQuery.error,
  }
}
