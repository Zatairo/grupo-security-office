import { useState } from 'react'
import type { Product, Category } from '../types/product.types'
import { Button, Modal, Alert } from '../../../components/ui'
import api from '../../../services/api'
import { getApiErrorMessage } from '../../../lib/apiError'

const BATCH_LIMIT = 50

export type MoveCategoryTarget =
  | { type: 'single'; product: Product }
  | { type: 'bulk'; products: Product[] }

interface MoveCategoryModalProps {
  target: MoveCategoryTarget
  categories: Category[]
  onClose: () => void
  onDone: (summary: string) => void
}

/**
 * Mover de categoría (individual o masiva).
 * Individual → PUT /api/products/:id { categoryId }.
 * Masiva → Promise.allSettled con lote defensivo de 50 → resumen "X OK / Y fallaron".
 */
export function MoveCategoryModal({ target, categories, onClose, onDone }: MoveCategoryModalProps) {
  const isSingle = target.type === 'single'
  const products = isSingle ? [target.product] : target.products
  const initialCategoryId =
    (isSingle && target.product.categoryId) || (products[0]?.categoryId ?? '')

  const [categoryId, setCategoryId] = useState(initialCategoryId)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const ids = products.map((p) => p.id)

  const handleConfirm = async () => {
    if (!categoryId) {
      setError('Selecciona la categoría destino.')
      return
    }
    setPending(true)
    setError(null)

    let ok = 0
    let failed = 0
    const errors: string[] = []

    const runBatch = async (batch: string[]) => {
      const results = await Promise.allSettled(
        batch.map((id) => api.put(`/products/${id}`, { categoryId }))
      )
      for (const r of results) {
        if (r.status === 'fulfilled') ok += 1
        else {
          failed += 1
          if (errors.length < 3) {
            errors.push(getApiErrorMessage(r.reason, 'Error al mover'))
          }
        }
      }
    }

    for (let i = 0; i < ids.length; i += BATCH_LIMIT) {
      await runBatch(ids.slice(i, i + BATCH_LIMIT))
    }

    setPending(false)
    onDone(failed === 0 ? `${ok} producto(s) movido(s) correctamente.` : `${ok} OK, ${failed} fallaron.`)
    if (failed > 0) {
      setError(errors.join(' • '))
    }
    onClose()
  }

  return (
    <Modal
      open
      onClose={() => {
        if (!pending) onClose()
      }}
      title={isSingle ? `Mover "${target.product.name}" a otra categoría` : `Mover ${ids.length} producto(s) de categoría`}
      footer={
        <>
          <Button variant="secondary" disabled={pending} onClick={onClose}>
            Cancelar
          </Button>
          <Button loading={pending} disabled={!categoryId} onClick={handleConfirm}>
            Mover
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <Alert variant="error">{error}</Alert>}
        <p className="text-sm text-neutral-500">
          {isSingle
            ? 'El producto se reasignará a la categoría seleccionada.'
            : `Se actualizará la categoría de ${ids.length} producto(s) seleccionado(s).`}
        </p>
        <div>
          <label className="block text-sm font-medium text-neutral-800 mb-1.5">
            Categoría destino <span className="text-red-500">*</span>
          </label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full px-3 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-focus-ring)] focus:border-[var(--color-primary)] text-sm bg-white"
          >
            <option value="">Seleccionar categoría...</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </Modal>
  )
}