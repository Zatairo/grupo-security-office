import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  createCustomer,
  updateCustomer,
  convertCustomer,
  deleteCustomer,
} from '../../../services/customers.service'
import type { CustomerPayload } from '../types/customer.types'

export function useCustomerMutations() {
  const queryClient = useQueryClient()

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['customers'], refetchType: 'all' })

  const create = useMutation({
    mutationFn: (payload: CustomerPayload) => createCustomer(payload),
    onSuccess: invalidate,
  })

  const update = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: CustomerPayload }) =>
      updateCustomer(id, payload),
    onSuccess: invalidate,
  })

  const convert = useMutation({
    mutationFn: (id: string) => convertCustomer(id),
    onSuccess: invalidate,
  })

  const remove = useMutation({
    mutationFn: (id: string) => deleteCustomer(id),
    onSuccess: invalidate,
  })

  return { create, update, convert, remove }
}
