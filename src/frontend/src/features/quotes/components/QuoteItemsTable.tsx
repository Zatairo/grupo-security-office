import { useMemo, useState } from 'react'
import { Table, Button, Card } from '../../../components/ui'
import EditQuoteItemModal from './EditQuoteItemModal'
import type { Quote, QuoteItem, UpdateQuoteItemPayload } from '../types/quote.types'
import { formatMoney, formatPercent } from '../utils/format'

interface QuoteItemsTableProps {
  quote: Quote
  editable: boolean
  onUpdateItem: (itemId: string, payload: UpdateQuoteItemPayload) => Promise<unknown>
  onRemoveItem: (itemId: string) => void
  isMutating?: boolean
}

/**
 * Tabla de ítems + totales. Todos los montos vienen del backend
 * (`unitPrice`, `lineTotal`, `subtotal`, `discount`, `taxAmount`, `total`);
 * aquí solo se formatean para mostrar.
 */
export default function QuoteItemsTable({
  quote,
  editable,
  onUpdateItem,
  onRemoveItem,
  isMutating = false,
}: QuoteItemsTableProps) {
  const [editing, setEditing] = useState<QuoteItem | null>(null)

  const currency = quote.currency
  const items = quote.items ?? []

  const columns = useMemo(() => {
    const cols = [
      {
        key: 'product',
        header: 'Producto',
        render: (item: QuoteItem) => (
          <div className="min-w-0">
            <p className="font-medium text-neutral-800 truncate">{item.name}</p>
            <p className="font-mono text-xs text-neutral-500">{item.sku}</p>
          </div>
        ),
      },
      {
        key: 'unitPrice',
        header: 'Precio unitario',
        render: (item: QuoteItem) => (
          <span className="text-sm text-neutral-700">
            {formatMoney(item.unitPrice, currency)}
          </span>
        ),
      },
      {
        key: 'quantity',
        header: 'Cant.',
        render: (item: QuoteItem) => (
          <span className="text-sm text-neutral-700">{item.quantity}</span>
        ),
      },
      {
        key: 'discountPct',
        header: 'Dto.',
        render: (item: QuoteItem) => (
          <span className="text-sm text-neutral-700">
            {formatPercent(item.discountPct)}
          </span>
        ),
      },
      {
        key: 'lineTotal',
        header: 'Total línea',
        render: (item: QuoteItem) => (
          <span className="text-sm font-medium text-neutral-800">
            {formatMoney(item.lineTotal, currency)}
          </span>
        ),
      },
    ]

    if (editable) {
      cols.push({
        key: 'actions',
        header: '',
        render: (item: QuoteItem) => (
          <div className="flex items-center justify-end gap-1">
            <Button
              type="button"
              variant="ghost"
              className="px-2 py-1 text-xs"
              disabled={isMutating}
              onClick={() => setEditing(item)}
            >
              Editar
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="px-2 py-1 text-xs text-[var(--color-error)]"
              disabled={isMutating}
              onClick={() => {
                if (window.confirm(`¿Quitar "${item.name}" de la cotización?`)) {
                  onRemoveItem(item.id)
                }
              }}
            >
              Quitar
            </Button>
          </div>
        ),
      })
    }

    return cols
  }, [currency, editable, isMutating, onRemoveItem])

  return (
    <div className="space-y-4">
      <Table
        columns={columns}
        data={items}
        isLoading={false}
        emptyMessage="Sin productos todavía. Agrega el primero."
        keyExtractor={(item) => item.id}
      />

      <Card>
        <dl className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-neutral-500">Subtotal</dt>
            <dd className="font-medium text-neutral-800">
              {formatMoney(quote.subtotal, currency)}
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-neutral-500">Descuentos</dt>
            <dd className="font-medium text-neutral-800">
              {formatMoney(quote.discount, currency)}
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-neutral-500">
              Impuestos ({formatPercent(quote.taxRate)})
            </dt>
            <dd className="font-medium text-neutral-800">
              {formatMoney(quote.taxAmount, currency)}
            </dd>
          </div>
          <div className="flex items-center justify-between border-t border-neutral-200 pt-2">
            <dt className="font-semibold text-neutral-800">Total</dt>
            <dd className="text-lg font-semibold text-neutral-900">
              {formatMoney(quote.total, currency)}
            </dd>
          </div>
        </dl>
      </Card>

      <EditQuoteItemModal
        open={editing !== null}
        onClose={() => setEditing(null)}
        item={editing}
        currency={currency}
        onSubmit={async (itemId, payload) => {
          await onUpdateItem(itemId, payload)
        }}
        isSubmitting={isMutating}
      />
    </div>
  )
}
