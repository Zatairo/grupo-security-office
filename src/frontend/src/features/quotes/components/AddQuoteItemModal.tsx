import { useMemo, useState, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Modal, Button, Alert, Input } from '../../../components/ui'
import { fetchListaProducts } from '../../../services/listas.service'
import type { AddQuoteItemPayload } from '../types/quote.types'
import { formatMoney, toNumber } from '../utils/format'

interface ListaProductForQuote {
  id: string
  sku: string
  name: string
  prices?: Array<{
    priceListId: string
    value: string | number
    currency?: string
  }>
}

interface AddQuoteItemModalProps {
  open: boolean
  onClose: () => void
  listaId: string
  priceListId: string | null
  currency: string
  onSubmit: (payload: AddQuoteItemPayload) => Promise<unknown>
  isSubmitting?: boolean
}

function errorMessage(err: unknown): string {
  const response = (err as { response?: { data?: { message?: string | string[] } } })
    ?.response?.data
  const message = response?.message
  if (Array.isArray(message)) return message.join('. ')
  return message || 'No se pudo agregar el producto'
}

export default function AddQuoteItemModal({
  open,
  onClose,
  listaId,
  priceListId,
  currency,
  onSubmit,
  isSubmitting = false,
}: AddQuoteItemModalProps) {
  const [search, setSearch] = useState('')
  const [productId, setProductId] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [discountPct, setDiscountPct] = useState('')
  const [error, setError] = useState<string | null>(null)

  const productsQuery = useQuery({
    queryKey: ['lista-products', listaId, 'quote-picker'],
    queryFn: () => fetchListaProducts(listaId),
    enabled: open && Boolean(listaId),
  })

  const products = useMemo(
    () => (productsQuery.data ?? []) as ListaProductForQuote[],
    [productsQuery.data]
  )

  const visibleProducts = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return products
    return products.filter(
      (p) =>
        p.name?.toLowerCase().includes(term) ||
        p.sku?.toLowerCase().includes(term)
    )
  }, [products, search])

  // Precio de referencia de la tarifa elegida, solo para orientar al
  // comercial. El precio real lo resuelve el backend al agregar (snapshot).
  const referentialPrice = useMemo(() => {
    if (!productId || !priceListId) return null
    const product = products.find((p) => p.id === productId)
    const price = product?.prices?.find((pr) => pr.priceListId === priceListId)
    return price ? toNumber(price.value) : null
  }, [productId, priceListId, products])

  const reset = () => {
    setSearch('')
    setProductId('')
    setQuantity('1')
    setDiscountPct('')
    setError(null)
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)

    const qty = Number(quantity)
    if (!productId || !Number.isInteger(qty) || qty < 1) {
      setError('Selecciona un producto e indica una cantidad válida.')
      return
    }

    try {
      await onSubmit({
        productId,
        quantity: qty,
        discountPct: discountPct.trim() || undefined,
      })
      handleClose()
    } catch (err) {
      // 409 del backend (sin precio vigente) u otros: se muestra tal cual,
      // incluido el SKU que reporta el backend.
      setError(errorMessage(err))
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Agregar producto"
      size="lg"
      footer={
        <>
          <Button type="button" variant="ghost" onClick={handleClose}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form="quote-item-form"
            loading={isSubmitting}
            disabled={!productId}
          >
            Agregar
          </Button>
        </>
      }
    >
      <form id="quote-item-form" onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <Alert variant="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <div className="relative">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o SKU"
            aria-label="Buscar producto"
            className="w-full rounded-lg border border-neutral-300 bg-white py-2.5 px-4 text-sm text-neutral-800 placeholder:text-neutral-400 focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-focus-ring)]"
          />
        </div>

        <ul
          className="max-h-64 overflow-y-auto divide-y divide-neutral-100 rounded-lg border border-neutral-200"
          aria-label="Productos de la Lista"
        >
          {productsQuery.isLoading && (
            <li className="p-4 text-sm text-neutral-500">Cargando productos…</li>
          )}
          {!productsQuery.isLoading && visibleProducts.length === 0 && (
            <li className="p-4 text-sm text-neutral-500">
              No hay productos con ese criterio.
            </li>
          )}
          {visibleProducts.map((p) => (
            <li key={p.id}>
              <label
                className={`flex cursor-pointer items-center justify-between gap-3 px-4 py-2.5 text-sm transition-colors ${
                  productId === p.id
                    ? 'bg-[var(--color-primary-bg-subtle)]'
                    : 'hover:bg-neutral-50'
                }`}
              >
                <span className="flex min-w-0 items-center gap-3">
                  <input
                    type="radio"
                    name="quote-product"
                    value={p.id}
                    checked={productId === p.id}
                    onChange={() => setProductId(p.id)}
                    className="h-4 w-4"
                  />
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-neutral-800">
                      {p.name}
                    </span>
                    <span className="block font-mono text-xs text-neutral-500">
                      {p.sku}
                    </span>
                  </span>
                </span>
              </label>
            </li>
          ))}
        </ul>

        {productId && (
          <p className="text-xs text-neutral-500">
            {referentialPrice !== null
              ? `Precio referencial en la tarifa elegida: ${formatMoney(referentialPrice, currency)}. El precio final lo fija el backend al agregar.`
              : 'Sin precio referencial visible; el precio final lo resuelve el backend al agregar.'}
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
            placeholder="0.00"
            inputMode="decimal"
          />
        </div>
      </form>
    </Modal>
  )
}
