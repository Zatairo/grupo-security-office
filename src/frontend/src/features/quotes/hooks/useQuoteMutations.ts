import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  addQuoteItem,
  createQuote,
  removeQuoteItem,
  updateQuoteItem,
  updateQuoteStatus,
} from '../../../services/quotes.service'
import type {
  AddQuoteItemPayload,
  CreateQuotePayload,
  Quote,
  UpdateQuoteItemPayload,
  UpdateQuoteStatusPayload,
} from '../types/quote.types'

export function useQuoteMutations(quoteId?: string) {
  const queryClient = useQueryClient()

  // Cada mutación del backend devuelve la Quote completa y fresca:
  // sembramos el caché del detalle con ella y refrescamos el listado.
  const applyQuote = (quote: Quote) => {
    queryClient.setQueryData(['quotes', quote.id], quote)
    void queryClient.invalidateQueries({ queryKey: ['quotes'], refetchType: 'all' })
  }

  const create = useMutation({
    mutationFn: (payload: CreateQuotePayload) => createQuote(payload),
    onSuccess: applyQuote,
  })

  const addItem = useMutation({
    mutationFn: (payload: AddQuoteItemPayload) =>
      addQuoteItem(quoteId as string, payload),
    onSuccess: applyQuote,
  })

  const updateItem = useMutation({
    mutationFn: ({
      itemId,
      payload,
    }: {
      itemId: string
      payload: UpdateQuoteItemPayload
    }) => updateQuoteItem(quoteId as string, itemId, payload),
    onSuccess: applyQuote,
  })

  const removeItem = useMutation({
    mutationFn: (itemId: string) => removeQuoteItem(quoteId as string, itemId),
    onSuccess: applyQuote,
  })

  const changeStatus = useMutation({
    mutationFn: (payload: UpdateQuoteStatusPayload) =>
      updateQuoteStatus(quoteId as string, payload),
    onSuccess: applyQuote,
  })

  return { create, addItem, updateItem, removeItem, changeStatus }
}
