import { useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../../services/api'
import { deleteProduct } from '../../../services/product-detail.service'

export function useProductMutations() {
  const queryClient = useQueryClient()

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['products'], refetchType: 'all' })

  const toggleVisibility = useMutation({
    mutationFn: (id: string) => api.patch(`/products/${id}/toggle-visibility`),
    onSuccess: invalidate,
  })

  const toggleActive = useMutation({
    mutationFn: (id: string) => api.patch(`/products/${id}/toggle-active`),
    onSuccess: invalidate,
  })

  // Borrado físico con confirm: true (obligatorio por el backend);
  // Si el usuario tiene clave configurada, el backend responde 409 sin clave.
  const deleteProductWithMasterKey = useMutation({
    mutationFn: ({ id, clave }: { id: string; clave?: string }) =>
      deleteProduct(id, { clave }),
    onSuccess: invalidate,
  })

  return { toggleVisibility, toggleActive, deleteProduct: undefined as any, deleteProductWithMasterKey }
}