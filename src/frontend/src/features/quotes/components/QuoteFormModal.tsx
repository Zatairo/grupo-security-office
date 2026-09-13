import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Modal, Select, Input, Button, Alert } from '../../../components/ui'
import { useQuoteBuilderStore } from '../store/quote-builder.store'
import { fetchCustomers } from '../../../services/customers.service'
import { fetchListas } from '../../../services/listas.service'
import { fetchPriceLists } from '../../../services/prices.service'
import type { CreateQuotePayload } from '../types/quote.types'

interface QuoteFormModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (payload: CreateQuotePayload) => Promise<unknown>
  isSubmitting?: boolean
}

function errorMessage(err: unknown): string {
  const response = (err as { response?: { data?: { message?: string | string[] } } })
    ?.response?.data
  const message = response?.message
  if (Array.isArray(message)) return message.join('. ')
  return message || 'No se pudo crear la cotización'
}

export default function QuoteFormModal({
  open,
  onClose,
  onSubmit,
  isSubmitting = false,
}: QuoteFormModalProps) {
  const builder = useQuoteBuilderStore()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) setError(null)
  }, [open])

  const customersQuery = useQuery({
    queryKey: ['customers', 'quote-builder-options'],
    queryFn: () => fetchCustomers({}, 1, 100),
    enabled: open,
  })
  const listasQuery = useQuery({
    queryKey: ['listas', 'quote-builder-options'],
    queryFn: () => fetchListas(),
    enabled: open,
  })
  const priceListsQuery = useQuery({
    queryKey: ['price-lists', 'quote-builder-options'],
    queryFn: () => fetchPriceLists(),
    enabled: open,
  })

  const customerOptions = useMemo(
    () =>
      (customersQuery.data?.data ?? [])
        .filter((c) => c.isActive)
        .map((c) => ({ value: c.id, label: `${c.name} (${c.code})` })),
    [customersQuery.data]
  )
  const listaOptions = useMemo(
    () =>
      (listasQuery.data ?? [])
        .filter((l) => l.isActive && !l.archivedAt)
        .map((l) => ({ value: l.id, label: `${l.name} (${l.code})` })),
    [listasQuery.data]
  )
  const priceListOptions = useMemo(
    () =>
      (priceListsQuery.data ?? [])
        .filter((p) => p.isActive)
        .map((p) => ({ value: p.id, label: `${p.name} (${p.currency})` })),
    [priceListsQuery.data]
  )

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)

    const payload: CreateQuotePayload = {
      customerId: builder.customerId,
      listaId: builder.listaId,
      // priceListId se exige en el formulario: sin tarifa el backend
      // rechaza (409) cualquier addItem posterior.
      priceListId: builder.priceListId,
      validUntil: builder.validUntil || undefined,
      taxRate: builder.taxRate.trim() || undefined,
      notes: builder.notes.trim() || undefined,
    }

    try {
      await onSubmit(payload)
      builder.reset()
      onClose()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  const handleClose = () => {
    builder.reset()
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Nueva cotización"
      size="lg"
      footer={
        <>
          <Button type="button" variant="ghost" onClick={handleClose}>
            Cancelar
          </Button>
          <Button type="submit" form="quote-form" loading={isSubmitting}>
            Crear cotización
          </Button>
        </>
      }
    >
      <form id="quote-form" onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <Alert variant="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Select
          label="Cliente"
          name="customerId"
          value={builder.customerId}
          onChange={(e) => builder.setField('customerId', e.target.value)}
          options={customerOptions}
          placeholder={
            customersQuery.isLoading ? 'Cargando clientes…' : 'Selecciona un cliente'
          }
          required
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select
            label="Lista comercial"
            name="listaId"
            value={builder.listaId}
            onChange={(e) => builder.setField('listaId', e.target.value)}
            options={listaOptions}
            placeholder={
              listasQuery.isLoading ? 'Cargando listas…' : 'Selecciona una Lista'
            }
            required
          />
          <Select
            label="Tarifa (price list)"
            name="priceListId"
            value={builder.priceListId}
            onChange={(e) => builder.setField('priceListId', e.target.value)}
            options={priceListOptions}
            placeholder={
              priceListsQuery.isLoading ? 'Cargando tarifas…' : 'Selecciona la tarifa'
            }
            required
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Válida hasta"
            name="validUntil"
            type="date"
            value={builder.validUntil}
            onChange={(e) => builder.setField('validUntil', e.target.value)}
          />
          <Input
            label="IVA (%) — opcional, por defecto 19"
            name="taxRate"
            value={builder.taxRate}
            onChange={(e) => builder.setField('taxRate', e.target.value)}
            placeholder="19.00"
            inputMode="decimal"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="quote-notes" className="block text-sm font-medium text-neutral-800">
            Notas
          </label>
          <textarea
            id="quote-notes"
            name="notes"
            rows={3}
            value={builder.notes}
            onChange={(e) => builder.setField('notes', e.target.value)}
            className="w-full px-4 py-2.5 rounded-lg border border-neutral-300 text-sm transition-all placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
            placeholder="Condiciones comerciales, tiempos de entrega, etc."
          />
        </div>
      </form>
    </Modal>
  )
}
