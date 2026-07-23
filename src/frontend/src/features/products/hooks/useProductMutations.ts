import { useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../../services/api'

export function useProductMutations() {
  const queryClient = useQueryClient()

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['products'] })

  const toggleVisibility = useMutation({
    mutationFn: (id: string) => api.patch(`/products/${id}/toggle-visibility`),
    onSuccess: invalidate,
  })

  const toggleActive = useMutation({
    mutationFn: (id: string) => api.patch(`/products/${id}/toggle-active`),
    onSuccess: invalidate,
  })

  const deleteProduct = useMutation({
    mutationFn: (id: string) => api.delete(`/products/${id}`),
    onSuccess: invalidate,
  })

  return { toggleVisibility, toggleActive, deleteProduct }
}