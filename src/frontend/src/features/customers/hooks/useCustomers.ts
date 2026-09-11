import { useQuery } from '@tanstack/react-query'
import { fetchCustomers } from '../../../services/customers.service'
import type { CustomerFilters } from '../types/customer.types'

interface UseCustomersOptions {
  filters: CustomerFilters
  page: number
  pageSize: number
}

export function useCustomers({ filters, page, pageSize }: UseCustomersOptions) {
  const customersQuery = useQuery({
    queryKey: ['customers', filters, page, pageSize],
    queryFn: () => fetchCustomers(filters, page, pageSize),
  })

  return {
    customers: customersQuery.data?.data ?? [],
    meta: customersQuery.data?.meta,
    total: customersQuery.data?.meta?.total ?? 0,
    totalPages: customersQuery.data?.meta?.totalPages ?? 1,
    isLoading: customersQuery.isLoading,
    error: customersQuery.error,
  }
}
