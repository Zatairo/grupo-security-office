import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  bulkTransitionProducts,
  transitionProduct,
  type BulkTransitionPayload,
  type TransitionPayload,
} from '../../../services/product-detail.service'

/** Extrae el código HTTP de un error axios para tipar 400/403/409/429. */
export function getTransitionHttpStatus(
  error: unknown
): 400 | 403 | 409 | 429 | 404 | 500 | 'network' | 'unknown' {
  const status = (error as { response?: { status?: number } })?.response?.status
  if (status === 400 || status === 403 || status === 409 || status === 429 || status === 404 || status === 500) {
    return status
  }
  if (status !== undefined) return 'unknown'
  return 'network'
}

/**
 * Transición FSM de un producto. Mutación NO optimista: al éxito invalida las
 * queries de listado y de detalle para re-sincronizar lifecycleStatus/allowedActions.
 */
export function useTransitionProduct(id?: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: TransitionPayload) => {
      if (!id) return Promise.reject(new Error('Se requiere el id del producto'))
      return transitionProduct(id, payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'], refetchType: 'all' })
      if (id) queryClient.invalidateQueries({ queryKey: ['product', id] })
    },
  })
}

/**
 * Transición FSM en lote (1..500 productos). Al éxito expone
 * `data.applied` y `data.rejected` (los rechazados llegan con motivo del backend:
 * 400/403/409 por producto). Invalida el listado de productos.
 */
export function useBulkTransition() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: BulkTransitionPayload) => bulkTransitionProducts(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'], refetchType: 'all' })
    },
  })
}