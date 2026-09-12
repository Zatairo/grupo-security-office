import api from './api'
import type {
  Customer,
  CustomerFilters,
  CustomerListResponse,
  CustomerPayload,
} from '../features/customers/types/customer.types'

const BASE = '/commercial/customers'

export const fetchCustomers = async (
  filters: CustomerFilters = {},
  page = 1,
  pageSize = 20
): Promise<CustomerListResponse> => {
  const params = new URLSearchParams()
  params.set('skip', String((page - 1) * pageSize))
  params.set('take', String(pageSize))
  if (filters.search?.trim()) params.set('search', filters.search.trim())
  if (filters.status) params.set('status', filters.status)
  if (filters.ownerId) params.set('ownerId', filters.ownerId)

  const res = await api.get(`${BASE}?${params}`)
  return res.data as CustomerListResponse
}

export const fetchCustomer = async (id: string): Promise<Customer> => {
  const res = await api.get(`${BASE}/${id}`)
  return res.data as Customer
}

export const createCustomer = async (payload: CustomerPayload): Promise<Customer> => {
  const res = await api.post(BASE, payload)
  return res.data as Customer
}

export const updateCustomer = async (
  id: string,
  payload: CustomerPayload
): Promise<Customer> => {
  const res = await api.patch(`${BASE}/${id}`, payload)
  return res.data as Customer
}

export const convertCustomer = async (id: string): Promise<Customer> => {
  const res = await api.patch(`${BASE}/${id}/convert`)
  return res.data as Customer
}

export const deleteCustomer = async (id: string): Promise<void> => {
  await api.delete(`${BASE}/${id}`)
}
