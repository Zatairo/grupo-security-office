import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button, Modal, Alert } from '../../../components/ui'
import api from '../../../services/api'
import { fetchPriceLists, fetchPricesByProduct } from '../../../services/prices.service'
import { getApiErrorMessage } from '../../../lib/apiError'

const BATCH_LIMIT = 50

interface BulkPriceUpdateModalProps {
  productIds: string[]
  onClose: () => void
  onDone: (summary: string) => void
}

/**
 * Actualización masiva de precios (TAREA 3).
 * El backend NO tiene upsert masivo: por cada producto se usa el upsert por
 * (productId, priceListId) del PUT /api/products/:id { prices: [...] }.
 * Con "sobrescribir solo si existe" se consulta GET /api/prices/product/:id antes.
 * Lotes defensivos de 50 → Promise.allSettled → resumen "X OK / Y fallaron".
 */
export function BulkPriceUpdateModal({ productIds, onClose, onDone }: BulkPriceUpdateModalProps) {
  const [priceListId, setPriceListId] = useState('')
  const [value, setValue] = useState('')
  const [currency, setCurrency] = useState('')
  const [validFrom, setValidFrom] = useState('')
  const [validUntil, setValidUntil] = useState('')
  const [onlyIfExists, setOnlyIfExists] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { data: priceLists = [], isLoading: listsLoading, isError: listsError } = useQuery({
    queryKey: ['priceLists'],
    queryFn: fetchPriceLists,
  })

  const selectedList = priceLists.find((pl) => pl.id === priceListId)

  const handlePriceListChange = (v: string) => {
    setPriceListId(v)
    const pl = priceLists.find((item) => item.id === v)
    setCurrency(pl?.currency ?? '')
  }

  const handleConfirm = async () => {
    const num = Number(value)
    if (!priceListId) {
      setError('Selecciona la tarifa destino.')
      return
    }
    if (!value || !Number.isFinite(num) || num <= 0) {
      setError('El valor debe ser mayor que 0.')
      return
    }
    if (validFrom && validUntil && validUntil < validFrom) {
      setError('La fecha de fin no puede ser anterior a la fecha de inicio.')
      return
    }

    setPending(true)
    setError(null)

    let ok = 0
    let failed = 0
    let skipped = 0
    const errors: string[] = []

    const applyPrice = async (productId: string) => {
      if (onlyIfExists) {
        const existing = await fetchPricesByProduct(productId).catch(() => [] as any[])
        const hasPrice = existing.some((p: any) => p.priceListId === priceListId)
        if (!hasPrice) {
          skipped += 1
          return
        }
      }
      await api.put(`/products/${productId}`, {
        prices: [
          {
            priceListId,
            value: num,
            ...(currency ? { currency } : {}),
            ...(validFrom ? { validFrom } : {}),
            ...(validUntil ? { validUntil } : {}),
          },
        ],
      })
    }

    const runBatch = async (batch: string[]) => {
      const results = await Promise.allSettled(batch.map(applyPrice))
      for (const r of results) {
        if (r.status === 'fulfilled') ok += 1
        else {
          failed += 1
          if (errors.length < 3) {
            errors.push(getApiErrorMessage(r.reason, 'Error al guardar precio'))
          }
        }
      }
    }

    for (let i = 0; i < productIds.length; i += BATCH_LIMIT) {
      await runBatch(productIds.slice(i, i + BATCH_LIMIT))
    }

    setPending(false)
    const parts = [`${ok} OK, ${failed} fallaron`]
    if (onlyIfExists && skipped > 0) parts.push(`${skipped} sin precio previo (omitidos)`)
    onDone(`Actualización de precios: ${parts.join('. ')}.`)
    if (failed > 0) setError(errors.join(' • '))
    onClose()
  }

  return (
    <Modal
      open
      onClose={() => {
        if (!pending) onClose()
      }}
      title={`Actualizar precios de ${productIds.length} producto(s)`}
      footer={
        <>
          <Button variant="secondary" disabled={pending} onClick={onClose}>
            Cancelar
          </Button>
          <Button loading={pending} disabled={!priceListId || !value} onClick={handleConfirm}>
            Aplicar precios
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <Alert variant="error">{error}</Alert>}
        {listsError && (
          <Alert variant="error">No se pudieron cargar las tarifas.</Alert>
        )}
        <div>
          <label className="block text-sm font-medium text-neutral-800 mb-1.5">
            Tarifa <span className="text-red-500">*</span>
          </label>
          <select
            value={priceListId}
            onChange={(e) => handlePriceListChange(e.target.value)}
            className="w-full px-3 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-focus-ring)] focus:border-[var(--color-primary)] text-sm bg-white"
          >
            <option value="">Seleccionar tarifa...</option>
            {listsLoading ? (
              <option disabled>Cargando...</option>
            ) : (
              priceLists.map((pl) => (
                <option key={pl.id} value={pl.id}>
                  {pl.name} ({pl.code})
                </option>
              ))
            )}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-neutral-800 mb-1.5">
              Valor nuevo <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-full px-3 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-focus-ring)] focus:border-[var(--color-primary)] text-sm"
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-800 mb-1.5">Moneda</label>
            <input
              value={currency}
              onChange={(e) => setCurrency(e.target.value.toUpperCase())}
              className="w-full px-3 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-focus-ring)] focus:border-[var(--color-primary)] text-sm"
              placeholder={selectedList?.currency ?? 'COP'}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-neutral-800 mb-1.5">Vigencia desde</label>
            <input
              type="date"
              value={validFrom}
              onChange={(e) => setValidFrom(e.target.value)}
              className="w-full px-3 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-focus-ring)] focus:border-[var(--color-primary)] text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-800 mb-1.5">Vigencia hasta</label>
            <input
              type="date"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
              className="w-full px-3 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-focus-ring)] focus:border-[var(--color-primary)] text-sm"
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-neutral-700 cursor-pointer">
          <input
            type="checkbox"
            checked={onlyIfExists}
            onChange={(e) => setOnlyIfExists(e.target.checked)}
            className="h-4 w-4 accent-[var(--color-primary)] cursor-pointer"
          />
          Sobrescribir solo si ya existe un precio en esta tarifa
        </label>

        <p className="text-xs text-neutral-400">
          El backend no expone un upsert masivo: se actualiza por producto mediante el upsert del
          PUT /api/products/:id con arreglo de precios. Procesa en lotes de {BATCH_LIMIT}.
        </p>
      </div>
    </Modal>
  )
}