import { useQuery } from '@tanstack/react-query'
import api from '../../../services/api'
import type { PriceList } from '../types/product.types'

export function usePriceLists() {
  const query = useQuery({
    queryKey: ['priceLists'],
    queryFn: async () => {
      const res = await api.get('/prices/lists')
      return res.data.data as PriceList[]
    },
  })

  return {
    priceLists: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
  }
}
