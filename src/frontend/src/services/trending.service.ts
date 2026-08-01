import api from './api'

export const fetchTrendingProducts = async (params?: {
  take?: number
  categoryId?: string
  search?: string
}) => {
  const queryParams = new URLSearchParams()
  if (params?.take) queryParams.set('take', params.take.toString())
  if (params?.categoryId) queryParams.set('categoryId', params.categoryId)
  if (params?.search) queryParams.set('search', params.search)

  const res = await api.get(`/products/trending?${queryParams.toString()}`)
  return res.data
}