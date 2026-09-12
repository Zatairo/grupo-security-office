import { useEffect, useState, type FormEvent } from 'react'
import { Modal, Button, Alert, Input } from '../../../components/ui'
import type { QuoteItem, UpdateQuoteItemPayload } from '../types/quote.types'
import { formatMoney } from '../utils/format'

interface EditQuoteItemModalProps {
  open: boolean
  onClose: () => void
  item: QuoteItem | null
  currency: string
  onSubmit: (itemId: string, payload: UpdateQuoteItemPayload) => Promise<unknown>
  isSubmitting?: boolean
}

function errorMessage(err: unknown): string {
  const response = (err as { response?: { data?: { message?: string | string[] } } })
    ?.response?.data
  const message = response?.message
  if (Array.isArray(message)) return message.join('. ')
  return message || 'No se pudo actualizar el ítem'
}

export default function EditQuoteItemModal({
  open,
  onClose,
  item,
  currency,
  onSubmit,
  isSubmitting = false,
}: EditQuoteItemModalProps) {
  const [quantity, setQuantity] = useState('1')
  const [discountPct, setDiscountPct] = useState('0')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open && item) {
      setQuantity(String(item.quantity))
      setDiscountPct(item.discountPct !== null && item.discountPct !== undefined ? String(item.discountPct) : '0')
      setError(null)
    }
  }, [open, item])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!item) return
    setError(null)

    const qty = Number(quantity)
    if (!Number.isInteger(qty) || qty < 1) {
      setError('La cantidad debe ser un entero mayor o igual a 1.')
      return
    }

    try {
      await onSubmit(item.id, {
        quantity: qty,
        discountPct: discountPct.trim() || '0',
      })
      onClose()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={item ? `Editar ${item.name}` : 'Editar ítem'}
      size="sm"
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="quote-item-edit-form" loading={isSubmitting}>
            Guardar
          </Button>
        </>
      }
    >
      <form id="quote-item-edit-form" onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <Alert variant="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {item && (
          <p className="text-xs text-neutral-500">
            Precio unitario (snapshot del backend):{' '}
            <span className="font-medium text-neutral-800">
              {formatMoney(item.unitPrice, currency)}
            </span>
          </p>
        )}

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Cantidad"
            name="quantity"
            type="number"
            min={1}
            step={1}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            required
          />
          <Input
            label="Descuento de línea (%)"
            name="discountPct"
            value={discountPct}
            onChange={(e) => setDiscountPct(e.target.value)}
            inputMode="decimal"
          />
        </div>

        <p className="text-xs text-neutral-400">
          El total de la línea lo recalcula el backend al guardar.
        </p>
      </form>
    </Modal>
  )
}
