import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Button, Card } from '../components/ui'
import QuoteStatusBadge from '../features/quotes/components/QuoteStatusBadge'
import QuoteStatusActions from '../features/quotes/components/QuoteStatusActions'
import QuoteItemsTable from '../features/quotes/components/QuoteItemsTable'
import AddQuoteItemModal from '../features/quotes/components/AddQuoteItemModal'
import { useQuote } from '../features/quotes/hooks/useQuotes'
import { useQuoteMutations } from '../features/quotes/hooks/useQuoteMutations'
import { itemsEditable } from '../features/quotes/types/quote.types'
import { formatDate } from '../features/quotes/utils/format'
import { useAuthStore } from '../stores/auth.store'

export default function QuoteDetailPage() {
  const { id } = useParams<{ id: string }>()
  const quoteQuery = useQuote(id)
  const { addItem, updateItem, removeItem, changeStatus } = useQuoteMutations(id)
  const [addItemOpen, setAddItemOpen] = useState(false)

  const currentUser = useAuthStore((state) => state.user)
  const roles = currentUser?.roles ?? []

  const quote = quoteQuery.data
  const mutating =
    addItem.isPending ||
    updateItem.isPending ||
    removeItem.isPending ||
    changeStatus.isPending

  if (quoteQuery.isLoading) {
    return <p className="text-sm text-neutral-500">Cargando cotización…</p>
  }

  if (quoteQuery.isError || !quote) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-[var(--color-error)]">
          No se pudo cargar la cotización (o no está en tu alcance).
        </p>
        <Link
          to="/commercial/quotes"
          className="text-sm font-medium text-[var(--color-primary)] hover:underline"
        >
          Volver a cotizaciones
        </Link>
      </div>
    )
  }

  const editable = itemsEditable(quote.status)

  return (
    <div className="space-y-5">
      <nav className="text-xs text-neutral-500" aria-label="Breadcrumb">
        <Link to="/commercial/quotes" className="hover:underline">
          Cotizaciones
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-neutral-700">{quote.code}</span>
      </nav>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-condensed font-semibold text-neutral-800">
              {quote.code}
            </h1>
            <QuoteStatusBadge status={quote.status} />
          </div>
          <p className="text-sm text-neutral-600">
            {quote.customer?.name ?? 'Cliente desconocido'}
            {quote.lista ? ` · Lista ${quote.lista.name}` : ''}
            {quote.priceList ? ` · Tarifa ${quote.priceList.name}` : ''}
          </p>
          <p className="text-xs text-neutral-400">
            Responsable: {quote.owner?.name ?? '—'} · Válida hasta:{' '}
            {formatDate(quote.validUntil)} · Creada: {formatDate(quote.createdAt)}
          </p>
          {quote.lostReason && (
            <p className="text-xs text-[var(--color-error)]">
              Motivo de pérdida: {quote.lostReason}
            </p>
          )}
        </div>

        <div className="flex flex-col items-start gap-3 sm:items-end">
          <QuoteStatusActions
            quote={quote}
            currentUserRoles={roles}
            onChangeStatus={async (payload) => {
              await changeStatus.mutateAsync(payload)
            }}
            isMutating={changeStatus.isPending}
          />
          {editable && (
            <Button type="button" onClick={() => setAddItemOpen(true)}>
              Agregar producto
            </Button>
          )}
        </div>
      </div>

      {quote.notes && (
        <Card className="p-4">
          <p className="text-sm text-neutral-700 whitespace-pre-line">{quote.notes}</p>
        </Card>
      )}

      <QuoteItemsTable
        quote={quote}
        editable={editable}
        onUpdateItem={async (itemId, payload) => {
          await updateItem.mutateAsync({ itemId, payload })
        }}
        onRemoveItem={(itemId) => removeItem.mutate(itemId)}
        isMutating={mutating}
      />

      <AddQuoteItemModal
        open={addItemOpen}
        onClose={() => setAddItemOpen(false)}
        listaId={quote.listaId}
        priceListId={quote.priceListId}
        currency={quote.currency}
        onSubmit={async (payload) => {
          await addItem.mutateAsync(payload)
        }}
        isSubmitting={addItem.isPending}
      />
    </div>
  )
}
