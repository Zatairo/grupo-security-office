import api from './api'
import type {
  AddQuoteItemPayload,
  CreateQuotePayload,
  Quote,
  QuoteFilters,
  QuoteListResponse,
  UpdateQuoteItemPayload,
  UpdateQuoteStatusPayload,
} from '../features/quotes/types/quote.types'

const BASE = '/commercial/quotes'

/**
 * Parseo defensivo del listado: el interceptor de `api.ts` des-envuelve
 * cualquier body con prop `data` (`{ data, meta }` → array), así que la
 * `meta` puede perderse en tránsito. Si no hay meta, se devuelve null y la
 * página solo oculta la paginación (mismo patrón defensivo de
 * prices.service.ts `asList`).
 */
function parseListResponse(raw: unknown): QuoteListResponse {
  if (Array.isArray(raw)) {
    return { data: raw as Quote[], meta: null }
  }
  if (raw && typeof raw === 'object') {
    const body = raw as { data?: Quote[]; meta?: QuoteListResponse['meta'] }
    if (Array.isArray(body.data)) {
      return { data: body.data, meta: body.meta ?? null }
    }
  }
  return { data: [], meta: null }
}

export const fetchQuotes = async (
  filters: QuoteFilters = {},
  page = 1,
  pageSize = 20
): Promise<QuoteListResponse> => {
  const params = new URLSearchParams()
  params.set('skip', String((page - 1) * pageSize))
  params.set('take', String(pageSize))
  if (filters.search?.trim()) params.set('search', filters.search.trim())
  if (filters.status) params.set('status', filters.status)
  if (filters.customerId) params.set('customerId', filters.customerId)
  if (filters.ownerId) params.set('ownerId', filters.ownerId)

  const res = await api.get(`${BASE}?${params}`)
  return parseListResponse(res.data)
}

export const fetchQuote = async (id: string): Promise<Quote> => {
  const res = await api.get(`${BASE}/${id}`)
  return res.data as Quote
}

export const createQuote = async (payload: CreateQuotePayload): Promise<Quote> => {
  const res = await api.post(BASE, payload)
  return res.data as Quote
}

export const addQuoteItem = async (
  id: string,
  payload: AddQuoteItemPayload
): Promise<Quote> => {
  const res = await api.post(`${BASE}/${id}/items`, payload)
  return res.data as Quote
}

export const updateQuoteItem = async (
  id: string,
  itemId: string,
  payload: UpdateQuoteItemPayload
): Promise<Quote> => {
  const res = await api.patch(`${BASE}/${id}/items/${itemId}`, payload)
  return res.data as Quote
}

export const removeQuoteItem = async (
  id: string,
  itemId: string
): Promise<Quote> => {
  const res = await api.delete(`${BASE}/${id}/items/${itemId}`)
  return res.data as Quote
}

export const updateQuoteStatus = async (
  id: string,
  payload: UpdateQuoteStatusPayload
): Promise<Quote> => {
  const res = await api.patch(`${BASE}/${id}/status`, payload)
  return res.data as Quote
}
