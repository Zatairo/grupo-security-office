import { useState, type FormEvent } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../services/api'
import type {
  Product,
  Category,
  Brand,
  PriceList,
  ProductDocument,
  LifecycleEvent,
  LifecycleStatus,
} from '../features/products/types/product.types'
import {
  LIFECYCLE_EVENT_HINT,
  LIFECYCLE_EVENT_LABEL,
  LIFECYCLE_STATUS_LABEL,
  effectiveLifecycleStatus,
  hasActiveScheduling,
  toDatetimeLocal,
  fromDatetimeLocal,
} from '../features/products/lib/lifecycle'
import { usePriceLists } from '../features/products/hooks/usePriceLists'
import { getApiErrorMessage } from '../lib/apiError'
import { formatCurrency, formatDate, formatBytes } from '../lib/format'
import { canManageListaAccess, canViewAudit, hasPermission } from '../lib/rbac'
import { Button, Modal, Badge, Alert } from '../components/ui'
import {
  useTransitionProduct,
  getTransitionHttpStatus,
} from '../features/products/hooks/useProductTransition'
import {
  fetchProductStock,
  updateProductStock,
  fetchProductAudit,
  fetchProductSuppliers,
  uploadProductImage,
  deleteProductImage,
  markProductImagePrimary,
  updateProductImageAlt,
  deleteProduct,
  isNotImplemented,
  schedulePublish,
  cancelScheduledPublish,
  type TransitionPayload,
  type ProductStock,
  type AuditLog,
} from '../services/product-detail.service'
import {
  fetchPricesByProduct,
  createPrice,
  updatePrice,
  deletePrice,
  fetchPriceLists,
  type Price,
} from '../services/prices.service'
import { ProductAccessModal } from '../features/products/components/ProductAccessModal'
import { SpecEditor, deserializeSpecFields, serializeSpecFields } from '../features/products/components/SpecEditor'

type DetailTab =
  | 'info'
  | 'specs'
  | 'images'
  | 'prices'
  | 'stock'
  | 'suppliers'
  | 'access'
  | 'publish'
  | 'audit'

const TABS: { id: DetailTab; label: string }[] = [
  { id: 'info', label: 'Información' },
  { id: 'specs', label: 'Atributos' },
  { id: 'images', label: 'Imágenes' },
  { id: 'prices', label: 'Precios' },
  { id: 'stock', label: 'Stock' },
  { id: 'suppliers', label: 'Proveedores' },
  { id: 'access', label: 'Accesos' },
  { id: 'publish', label: 'Publicación' },
  { id: 'audit', label: 'Auditoría' },
]

const PRICE_LIST_ORDER = [
  'CLIENTE_FINAL_IVA',
  'DPP_ORO_IVA',
  'DPP_PLATINO_IVA',
  'TIENDA_IVA',
  'ORO_SIN_IVA',
  'INSTALADOR_IVA',
  'INSTALLER_SIN_IVA',
]

const inputClass =
  'w-full px-3 py-2.5 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-focus-ring)] focus:border-[var(--color-primary)] text-sm'

/** Eventos FSM que se disparan de forma directa (sin modal). */
const DIRECT_TRANSITIONS: LifecycleEvent[] = ['PUBLISH', 'UNPUBLISH']

/**
 * Colores de fondo sólido por estado de ciclo de vida (WCAG AA ≥ 4.5:1 con
 * texto blanco). Solo los tres estados canónicos.
 */
const LIFECYCLE_STATUS_BG: Record<LifecycleStatus, string> = {
  DRAFT: 'bg-amber-700', // #b45309 · blanco = 5.02:1
  PUBLISHED: 'bg-sky-700', // #0369a1 · blanco = 5.93:1
  ARCHIVED: 'bg-gray-700', // #374151 · blanco = 10.31:1
}

function findPrice(product: Product, priceListId: string) {
  return product.prices?.find((p) => p.priceList.id === priceListId)
}

function orderedPriceLists(lists: PriceList[]): PriceList[] {
  const byCode = new Map(lists.map((l) => [l.code, l]))
  const ordered = PRICE_LIST_ORDER.map((code) => byCode.get(code)).filter(
    Boolean,
  ) as PriceList[]
  const extras = lists.filter((l) => !PRICE_LIST_ORDER.includes(l.code))
  return [...ordered, ...extras]
}

/** Formatea una fecha/hora de programación en horario local con locale es-CO (sin librerías). */
function formatScheduleDatetime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function ComingSoon({ title, message }: { title: string; message: string }) {
  return (
    <div className="text-center py-10">
      <svg
        className="w-12 h-12 mx-auto mb-3 text-neutral-300"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1}
          d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
        />
      </svg>
      <p className="text-sm font-medium text-neutral-600">{title}</p>
      <p className="text-xs text-neutral-400 mt-1">{message}</p>
    </div>
  )
}

// ------------------------------ Documentos ------------------------------
function DocumentModal({
  error,
  loading,
  onClose,
  onConfirm,
}: {
  error: unknown
  loading: boolean
  onClose: () => void
  onConfirm: (doc: ProductDocument) => void
}) {
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [type, setType] = useState('')
  const [size, setSize] = useState('')
  const [formError, setFormError] = useState('')

  const handleConfirm = () => {
    if (!name.trim()) {
      setFormError('El nombre es requerido.')
      return
    }
    const trimmedUrl = url.trim()
    if (!trimmedUrl) {
      setFormError('La URL es requerida.')
      return
    }
    if (!/^https?:\/\//i.test(trimmedUrl)) {
      setFormError('La URL debe comenzar con http:// o https://')
      return
    }
    let sizeNum: number | undefined
    if (size.trim()) {
      sizeNum = Number(size)
      if (!Number.isFinite(sizeNum) || sizeNum < 0) {
        setFormError('El tamaño debe ser un número mayor o igual que 0.')
        return
      }
    }
    setFormError('')
    onConfirm({
      name: name.trim(),
      url: trimmedUrl,
      ...(type.trim() ? { type: type.trim() } : {}),
      ...(sizeNum !== undefined ? { size: sizeNum } : {}),
    })
  }

  const alertMessage =
    formError || (error ? getApiErrorMessage(error, 'No se pudo añadir el documento.') : '')

  return (
    <Modal
      open
      onClose={onClose}
      title="Añadir documento"
      footer={
        <>
          <Button variant="secondary" disabled={loading} onClick={onClose}>
            Cancelar
          </Button>
          <Button loading={loading} onClick={handleConfirm}>
            Añadir
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {alertMessage && <Alert variant="error">{alertMessage}</Alert>}
        <div>
          <label className="block text-sm font-medium text-neutral-800 mb-1.5">
            Nombre <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
            placeholder="Ej: Ficha técnica DVR-8"
            maxLength={200}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-800 mb-1.5">
            URL <span className="text-red-500">*</span>
          </label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className={inputClass}
            placeholder="https://..."
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-neutral-800 mb-1.5">Tipo (opcional)</label>
            <input
              type="text"
              value={type}
              onChange={(e) => setType(e.target.value)}
              className={inputClass}
              placeholder="Ej: pdf, xlsx"
              maxLength={30}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-800 mb-1.5">Tamaño en bytes (opcional)</label>
            <input
              type="number"
              min="0"
              value={size}
              onChange={(e) => setSize(e.target.value)}
              className={inputClass}
              placeholder="Ej: 204800"
            />
          </div>
        </div>
        <p className="text-xs text-neutral-400">
          El documento se guarda como referencia (nombre + URL). El backend aún no expone subida de
          archivos; si el endpoint de documentos no está desplegado, verás el error correspondiente.
        </p>
      </div>
    </Modal>
  )
}

function DocumentsSection({ product }: { product: Product }) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const documents = product.documents ?? []

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['product', product.id] })
  }

  const addDoc = useMutation({
    mutationFn: (doc: ProductDocument) =>
      api.put(`/products/${product.id}`, { documents: [...documents, doc] }),
    onSuccess: refresh,
  })

  const removeDoc = useMutation({
    mutationFn: (doc: ProductDocument) =>
      api.put(`/products/${product.id}`, {
        documents: documents.filter((d) => !(d.name === doc.name && d.url === doc.url)),
      }),
    onSuccess: refresh,
  })

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-neutral-700">Documentos</h3>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-xs font-medium text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] px-2 py-1 rounded hover:bg-[var(--color-primary-bg-subtle)] transition-colors"
        >
          + Añadir documento
        </button>
      </div>

      {addDoc.isError && (
        <Alert variant="error">
          {getApiErrorMessage(addDoc.error, 'No se pudo añadir el documento.')}
        </Alert>
      )}
      {removeDoc.isError && (
        <Alert variant="error">
          {getApiErrorMessage(removeDoc.error, 'No se pudo eliminar el documento.')}
        </Alert>
      )}
      {addDoc.isSuccess && !open && (
        <Alert variant="success">Documento añadido correctamente.</Alert>
      )}

      {documents.length === 0 ? (
        <p className="text-sm text-neutral-400 py-3 text-center">Sin documentos asociados.</p>
      ) : (
        <ul className="divide-y divide-neutral-100 border border-neutral-200 rounded-lg">
          {documents.map((doc, idx) => (
            <li key={`${doc.url}-${idx}`} className="flex items-center gap-3 px-3 py-2.5">
              <svg
                className="w-5 h-5 text-neutral-300 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <div className="flex-1 min-w-0">
                <a
                  href={doc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-[var(--color-primary)] hover:underline truncate block"
                  title={doc.url}
                >
                  {doc.name}
                </a>
                <p className="text-xs text-neutral-400">
                  {(doc.type ? doc.type.toUpperCase() : 'Documento') +
                    (doc.size ? ` · ${formatBytes(doc.size)}` : '')}
                </p>
              </div>
              <button
                type="button"
                disabled={removeDoc.isPending}
                onClick={() => {
                  if (confirm(`¿Eliminar el documento "${doc.name}"?`)) removeDoc.mutate(doc)
                }}
                className="p-1.5 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors shrink-0"
                title="Eliminar documento"
                aria-label={`Eliminar documento ${doc.name}`}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && (
        <DocumentModal
          error={addDoc.error}
          loading={addDoc.isPending}
          onClose={() => setOpen(false)}
          onConfirm={(doc) => addDoc.mutate(doc)}
        />
      )}
    </div>
  )
}

// ------------------------------ Información ------------------------------
function InfoTab({
  product,
  categories,
  brands,
}: {
  product: Product
  categories: Category[]
  brands: Brand[]
}) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState({
    sku: product.sku,
    name: product.name,
    description: product.description ?? '',
    categoryId: product.categoryId,
    brandId: product.brandId,
    isActive: product.isActive,
    isVisible: product.isVisible,
  })
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: () => api.put(`/products/${product.id}`, form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product', product.id] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
    },
  })

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) {
      setError('El nombre es requerido.')
      return
    }
    if (!form.sku.trim()) {
      setError('El SKU es requerido.')
      return
    }
    if (!form.categoryId || !form.brandId) {
      setError('Categoría y marca son requeridas.')
      return
    }
    setError('')
    mutation.mutate()
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        {(error || mutation.isError) && (
          <Alert variant="error">
            {error || getApiErrorMessage(mutation.error, 'No se pudo guardar el producto.')}
          </Alert>
        )}
        {mutation.isSuccess && (
          <Alert variant="success">Producto actualizado correctamente.</Alert>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">SKU</label>
            <input
              type="text"
              value={form.sku}
              onChange={(e) => setForm({ ...form, sku: e.target.value })}
              className={inputClass}
              required
            />
            <p className="text-xs text-neutral-400 mt-1">
              El SKU debe ser único. Si ya existe, el backend responderá 409 y se muestra el error.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">Nombre</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className={inputClass}
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1.5">Descripción</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className={`${inputClass} resize-none`}
            rows={3}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">Categoría</label>
            <select
              value={form.categoryId}
              onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
              className={inputClass}
            >
              <option value="">Seleccionar...</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">Marca</label>
            <select
              value={form.brandId}
              onChange={(e) => setForm({ ...form, brandId: e.target.value })}
              className={inputClass}
            >
              <option value="">Seleccionar...</option>
              {brands.map((brand) => (
                <option key={brand.id} value={brand.id}>
                  {brand.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex gap-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              className="w-4 h-4 text-[var(--color-primary)] border-neutral-300 rounded focus:ring-[var(--color-primary-focus-ring)]"
            />
            <span className="text-sm text-neutral-700">Activo</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isVisible}
              onChange={(e) => setForm({ ...form, isVisible: e.target.checked })}
              className="w-4 h-4 text-[var(--color-primary)] border-neutral-300 rounded focus:ring-[var(--color-primary-focus-ring)]"
            />
            <span className="text-sm text-neutral-700">Visible</span>
          </label>
        </div>

        <div className="flex justify-end">
          <Button type="submit" loading={mutation.isPending}>
            Guardar cambios
          </Button>
        </div>
      </form>

      <div className="border-t border-neutral-200 pt-4">
        <DocumentsSection product={product} />
      </div>
    </div>
  )
}

// ------------------------------ Atributos ------------------------------
function AtributosTab({ product }: { product: Product }) {
  const queryClient = useQueryClient()
  const [specs, setSpecs] = useState(() =>
    deserializeSpecFields(product.technicalSpecs ?? null)
  )
  const [extra, setExtra] = useState(() =>
    deserializeSpecFields(product.extraAttributes ?? null)
  )
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: () =>
      api.put(`/products/${product.id}`, {
        technicalSpecs: Object.keys(serializeSpecFields(specs)).length ? serializeSpecFields(specs) : {},
        extraAttributes: Object.keys(serializeSpecFields(extra)).length ? serializeSpecFields(extra) : {},
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product', product.id] })
    },
  })

  const handleSave = () => {
    setError('')
    mutation.mutate()
  }

  return (
    <div className="space-y-6">
      {(error || mutation.isError) && (
        <Alert variant="error">
          {error || getApiErrorMessage(mutation.error, 'No se pudieron guardar los atributos.')}
        </Alert>
      )}
      {mutation.isSuccess && (
        <Alert variant="success">Atributos guardados correctamente.</Alert>
      )}

      <SpecEditor
        fields={specs}
        onChange={setSpecs}
        label="Especificaciones técnicas"
        placeholder="Agrega especificaciones como resolución, lente, visión nocturna, etc."
      />
      <SpecEditor
        fields={extra}
        onChange={setExtra}
        label="Atributos extra"
        placeholder="Agrega atributos como garantía, peso, color, etc."
      />

      <p className="text-xs text-neutral-400">
        Los atributos se serializan como JSON en los campos technicalSpecs y extraAttributes del
        producto. Las plantillas de atributos por categoría no están disponibles aún.
      </p>

      <div className="flex justify-end">
        <Button onClick={handleSave} loading={mutation.isPending}>
          Guardar atributos
        </Button>
      </div>
    </div>
  )
}

// ------------------------------ Imágenes ------------------------------
function AltEditor({
  image,
  onSave,
}: {
  image: { id: string; alt?: string | null }
  onSave: (alt: string) => void
}) {
  const [alt, setAlt] = useState(image.alt ?? '')
  const dirty = alt !== (image.alt ?? '')

  return (
    <div className="flex gap-1.5 items-center">
      <input
        type="text"
        value={alt}
        onChange={(e) => setAlt(e.target.value)}
        className="flex-1 min-w-0 px-2 py-1 border border-neutral-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-[var(--color-primary-focus-ring)] focus:border-[var(--color-primary)]"
        placeholder="Texto alternativo"
        aria-label="Texto alternativo de la imagen"
        maxLength={200}
      />
      <button
        type="button"
        disabled={!dirty}
        onClick={() => onSave(alt.trim())}
        className="px-2 py-1 text-xs font-medium rounded border border-neutral-200 text-neutral-500 hover:text-[var(--color-primary)] hover:border-[var(--color-primary)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
      >
        Guardar
      </button>
    </div>
  )
}

function ImagesTab({ product }: { product: Product }) {
  const queryClient = useQueryClient()
  const images = product.images ?? []
  const IMAGE_TYPES = ['PORTADA', 'LOGO', 'PRINCIPAL', 'COMPLEMENTARIA', 'EXTRA'] as const

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['product', product.id] })
  }

  const upload = useMutation({
    mutationFn: (file: File) => uploadProductImage(product.id, file, images.length === 0),
    onSuccess: refresh,
  })

  const remove = useMutation({
    mutationFn: (imageId: string) => deleteProductImage(imageId),
    onSuccess: refresh,
  })

  const primary = useMutation({
    mutationFn: (imageId: string) => markProductImagePrimary(imageId),
    onSuccess: refresh,
  })

  const updateAlt = useMutation({
    mutationFn: ({ imageId, alt }: { imageId: string; alt: string }) =>
      updateProductImageAlt(imageId, alt),
    onSuccess: refresh,
  })

  const updateImageType = useMutation({
    mutationFn: ({ imageId, type }: { imageId: string; type: string }) =>
      api.patch(`/products/images/${imageId}`, { type }),
    onSuccess: refresh,
  })

  return (
    <div className="space-y-4">
      {upload.isError && (
        <Alert variant="error">
          {getApiErrorMessage(upload.error, 'Error al subir la imagen. Máximo 8MB.')}
        </Alert>
      )}
      {primary.isError && isNotImplemented(primary.error) && (
        <Alert variant="info">Marcar imagen como principal estará disponible próximamente.</Alert>
      )}
      {updateAlt.isError && isNotImplemented(updateAlt.error) && (
        <Alert variant="info">Editar el texto alternativo estará disponible próximamente.</Alert>
      )}

      <label className="inline-flex items-center gap-2 px-4 py-2.5 border border-neutral-300 rounded-lg text-sm font-medium text-neutral-700 hover:bg-neutral-50 cursor-pointer transition-colors">
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
        </svg>
        Subir imagen
        <input
          type="file"
          accept="image/*"
          className="hidden"
          disabled={upload.isPending}
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) upload.mutate(file)
            e.target.value = ''
          }}
        />
      </label>
      {upload.isPending && <p className="text-xs text-neutral-400">Subiendo imagen...</p>}

      {images.length === 0 ? (
        <p className="text-sm text-neutral-400 py-6 text-center">No hay imágenes aún.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {images.map((img) => (
            <div key={img.id} className="border border-neutral-200 rounded-lg overflow-hidden">
              <img
                src={img.url}
                alt={img.alt ?? product.name}
                className="w-full h-28 object-cover bg-neutral-100"
              />
              <div className="p-2 space-y-1.5">
                <AltEditor image={img} onSave={(alt) => updateAlt.mutate({ imageId: img.id, alt })} />
                <div className="flex items-center justify-between">
                  <span className="text-xs px-2 py-0.5 bg-neutral-100 text-neutral-600 rounded-full font-medium">
                    {img.type ?? 'PRINCIPAL'}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <select
                      value={img.type ?? 'PRINCIPAL'}
                      onChange={(e) => updateImageType.mutate({ imageId: img.id, type: e.target.value })}
                      disabled={updateImageType.isPending}
                      className="text-xs px-2 py-1 border border-neutral-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                      aria-label="Cambiar tipo de imagen"
                    >
                      {IMAGE_TYPES.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={img.isPrimary || primary.isPending}
                      onClick={() => primary.mutate(img.id)}
                      className={`text-xs font-medium rounded px-2 py-1 transition-colors ${
                        img.isPrimary
                          ? 'bg-[var(--color-primary-bg-subtle)] text-[var(--color-primary)] cursor-default'
                          : 'text-neutral-500 hover:text-[var(--color-primary)] hover:bg-[var(--color-primary-bg-subtle)]'
                      }`}
                    >
                      {img.isPrimary ? 'Principal' : 'Hacer principal'}
                    </button>
                    <button
                      type="button"
                      disabled={remove.isPending}
                      onClick={() => {
                        if (confirm('¿Eliminar esta imagen?')) remove.mutate(img.id)
                      }}
                      className="p-1.5 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                      title="Eliminar"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="text-xs text-neutral-400">
        El backend expone <code>PATCH /api/products/images/:imageId</code> para editar el texto
        alternativo (<code>alt</code>) y definir la imagen principal (<code>isPrimary</code>).
        Si el endpoint aún no está desplegado y responde 404/405/501, los controles muestran un
        aviso sin romper la página. El orden respeta el <code>sortOrder</code> asignado por el
        backend.
      </p>
    </div>
  )
}

// ------------------------------ Precios ------------------------------
function PriceModal({
  mode,
  price,
  productId,
  productName,
  onClose,
  onSaved,
}: {
  mode: 'create' | 'edit'
  price?: Price
  productId: string
  productName: string
  onClose: () => void
  onSaved: () => void
}) {
  const [value, setValue] = useState(price ? String(price.value) : '')
  const [currency, setCurrency] = useState(price?.currency ?? '')
  const [priceListId, setPriceListId] = useState(price?.priceListId ?? '')
  const [validFrom, setValidFrom] = useState(price?.validFrom ? price.validFrom.slice(0, 10) : '')
  const [validUntil, setValidUntil] = useState(price?.validUntil ? price.validUntil.slice(0, 10) : '')
  const [formError, setFormError] = useState('')

  const { data: priceLists = [], isLoading: listsLoading } = useQuery({
    queryKey: ['priceLists'],
    queryFn: fetchPriceLists,
  })

  const mutation = useMutation({
    mutationFn: async () => {
      if (mode === 'edit' && price) {
        return updatePrice(price.id, {
          value: Number(value),
          currency,
          validFrom: validFrom || null,
          validUntil: validUntil || null,
        })
      }
      return createPrice({
        productId,
        priceListId,
        value: Number(value),
        currency,
        ...(validFrom ? { validFrom } : {}),
        ...(validUntil ? { validUntil } : {}),
      })
    },
    onSuccess: () => {
      onSaved()
      onClose()
    },
  })

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const num = Number(value)
    if (!value || !Number.isFinite(num) || num <= 0) {
      setFormError('El valor debe ser mayor que 0.')
      return
    }
    if (!currency) {
      setFormError('La moneda es requerida.')
      return
    }
    if (mode === 'create' && !priceListId) {
      setFormError('Selecciona una tarifa.')
      return
    }
    if (validFrom && validUntil && validUntil < validFrom) {
      setFormError('La fecha de fin no puede ser anterior a la fecha de inicio.')
      return
    }
    setFormError('')
    mutation.mutate()
  }

  return (
    <Modal
      open
      onClose={() => {
        if (!mutation.isPending) onClose()
      }}
      title={mode === 'edit' ? 'Editar precio' : 'Nuevo precio'}
      footer={
        <>
          <Button variant="secondary" disabled={mutation.isPending} onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="product-price-form" loading={mutation.isPending}>
            {mode === 'edit' ? 'Guardar cambios' : 'Crear precio'}
          </Button>
        </>
      }
    >
      <form id="product-price-form" onSubmit={handleSubmit} className="space-y-4">
        {(formError || mutation.isError) && (
          <Alert variant="error">
            {formError || getApiErrorMessage(mutation.error, 'No se pudo guardar el precio.')}
          </Alert>
        )}

        <div>
          <label className="block text-sm font-medium text-neutral-800 mb-1.5">Producto</label>
          <input
            value={productName}
            disabled
            className="w-full px-3 py-2.5 border border-neutral-200 rounded-lg bg-neutral-50 text-sm text-neutral-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-800 mb-1.5">
            Tarifa <span className="text-red-500">*</span>
          </label>
          {mode === 'edit' && price ? (
            <input
              value={price.priceList?.name ?? price.priceListId}
              disabled
              className="w-full px-3 py-2.5 border border-neutral-200 rounded-lg bg-neutral-50 text-sm text-neutral-500"
            />
          ) : (
            <select
              value={priceListId}
              onChange={(e) => {
                setPriceListId(e.target.value)
                const pl = priceLists.find((item) => item.id === e.target.value)
                if (pl && !currency) setCurrency(pl.currency)
              }}
              className={inputClass}
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
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-neutral-800 mb-1.5">
              Valor <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-800 mb-1.5">
              Moneda <span className="text-red-500">*</span>
            </label>
            <input
              value={currency}
              onChange={(e) => setCurrency(e.target.value.toUpperCase())}
              className={inputClass}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-neutral-800 mb-1.5">Desde</label>
            <input
              type="date"
              value={validFrom}
              onChange={(e) => setValidFrom(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-800 mb-1.5">Hasta</label>
            <input
              type="date"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>
      </form>
    </Modal>
  )
}

function PricesTab({ product }: { product: Product }) {
  const queryClient = useQueryClient()
  const [modal, setModal] = useState<{ mode: 'create' } | { mode: 'edit'; price: Price } | null>(null)
  const canEdit = hasPermission('products:write')

  const { data: prices = [], isLoading, error } = useQuery({
    queryKey: ['product-prices', product.id],
    queryFn: () => fetchPricesByProduct(product.id),
  })

  const remove = useMutation({
    mutationFn: (id: string) => deletePrice(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-prices', product.id] })
      queryClient.invalidateQueries({ queryKey: ['product', product.id] })
    },
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-neutral-500 uppercase tracking-wide">
          Precios del producto ({prices.length})
        </p>
        {canEdit && (
          <Button onClick={() => setModal({ mode: 'create' })}>Nuevo precio</Button>
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-neutral-400 py-6 text-center">Cargando precios...</p>
      ) : error ? (
        <Alert variant="error">
          {getApiErrorMessage(error, 'No se pudieron cargar los precios.')}
        </Alert>
      ) : prices.length === 0 ? (
        <p className="text-sm text-neutral-400 py-6 text-center">
          Este producto aún no tiene precios asignados.
        </p>
      ) : (
        <div className="overflow-x-auto border border-neutral-200 rounded-lg">
          <table className="min-w-full divide-y divide-neutral-200 text-sm">
            <thead className="bg-neutral-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-600 uppercase">
                  Tarifa
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-neutral-600 uppercase">
                  Precio
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-600 uppercase">
                  Vigencia
                </th>
                {canEdit && (
                  <th className="px-4 py-3 text-right text-xs font-semibold text-neutral-600 uppercase">
                    Acciones
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {prices.map((price) => (
                <tr key={price.id} className="hover:bg-neutral-50">
                  <td className="px-4 py-3">
                    <div className="flex flex-col">
                      <span className="font-medium text-neutral-800">
                        {price.priceList?.name ?? price.priceListId}
                      </span>
                      {price.priceList?.code && (
                        <span className="text-xs text-neutral-400 font-mono">
                          {price.priceList.code}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-neutral-800 tabular-nums">
                    {formatCurrency(Number(price.value), price.currency)}
                  </td>
                  <td className="px-4 py-3 text-neutral-500 text-xs">
                    {price.validFrom && price.validUntil
                      ? `${formatDate(price.validFrom)} – ${formatDate(price.validUntil)}`
                      : price.validFrom
                        ? `Desde ${formatDate(price.validFrom)}`
                        : price.validUntil
                          ? `Hasta ${formatDate(price.validUntil)}`
                          : 'Sin vigencia'}
                  </td>
                  {canEdit && (
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setModal({ mode: 'edit', price })}
                          className="text-xs font-medium text-neutral-500 hover:text-[var(--color-primary)]"
                        >
                          Editar
                        </button>
                        <button
                          disabled={remove.isPending}
                          onClick={() => {
                            if (confirm('¿Eliminar este precio?')) remove.mutate(price.id)
                          }}
                          className="text-xs font-medium text-neutral-400 hover:text-red-500"
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <PriceModal
          mode={modal.mode}
          price={modal.mode === 'edit' ? modal.price : undefined}
          productId={product.id}
          productName={product.name}
          onClose={() => setModal(null)}
          onSaved={() =>
            queryClient.invalidateQueries({ queryKey: ['product-prices', product.id] })
          }
        />
      )}
    </div>
  )
}

// ------------------------------ Stock ------------------------------
function StockTab({ product }: { product: Product }) {
  const queryClient = useQueryClient()
  const [quantity, setQuantity] = useState('')
  const [location, setLocation] = useState('')
  const [adjustmentType, setAdjustmentType] = useState<'in' | 'out' | 'adjust' | ''>('')
  const [reason, setReason] = useState('')
  const [formError, setFormError] = useState('')
  const canEdit = hasPermission('products:write')

  const { data: stocks = [], isLoading, error } = useQuery({
    queryKey: ['product-stock', product.id],
    queryFn: () => fetchProductStock(product.id),
    retry: false,
  })

  const unavailable = isNotImplemented(error)

  const mutation = useMutation({
    mutationFn: () =>
      updateProductStock(product.id, {
        quantity: Number(quantity),
        ...(location.trim() ? { location: location.trim() } : {}),
        ...(adjustmentType ? { adjustmentType } : {}),
        ...(reason.trim() ? { reason: reason.trim() } : {}),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-stock', product.id] })
      queryClient.invalidateQueries({ queryKey: ['product', product.id] })
      setQuantity('')
      setLocation('')
      setReason('')
      setAdjustmentType('')
    },
  })

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const num = Number(quantity)
    if (!Number.isFinite(num)) {
      setFormError('La cantidad debe ser un número.')
      return
    }
    if (num <= 0) {
      setFormError('La cantidad debe ser mayor que 0.')
      return
    }
    setFormError('')
    mutation.mutate()
  }

  const adjustmentHint =
    adjustmentType === 'in'
      ? 'Suma la cantidad al stock disponible.'
      : adjustmentType === 'out'
        ? 'Resta la cantidad al stock disponible (no permite dejar stock negativo).'
        : adjustmentType === 'adjust'
          ? 'Establece el stock disponible al valor indicado.'
          : 'Guarda el valor como stock disponible sin registrar movimiento.'

  if (unavailable) {
    return (
      <ComingSoon
        title="Stock"
        message="El módulo de stock de producto estará disponible próximamente."
      />
    )
  }

  return (
    <div className="space-y-6">
      {error && !unavailable && (
        <Alert variant="error">{getApiErrorMessage(error, 'No se pudo cargar el stock.')}</Alert>
      )}

      {isLoading ? (
        <p className="text-sm text-neutral-400 py-6 text-center">Cargando stock...</p>
      ) : stocks.length === 0 ? (
        <p className="text-sm text-neutral-400 py-4 text-center">
          Este producto aún no tiene registro de stock.
        </p>
      ) : (
        <div className="overflow-x-auto border border-neutral-200 rounded-lg">
          <table className="min-w-full divide-y divide-neutral-200 text-sm">
            <thead className="bg-neutral-50">
              <tr>
                <th className="px-4 py-3 text-right text-xs font-semibold text-neutral-600 uppercase">
                  Disponible
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-neutral-600 uppercase">
                  Reservado
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-600 uppercase">
                  Ubicación
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-600 uppercase">
                  Actualizado
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {stocks.map((stock: ProductStock) => (
                <tr key={stock.id}>
                  <td className="px-4 py-3 text-right font-medium text-neutral-800 tabular-nums">
                    {stock.availableQty}
                  </td>
                  <td className="px-4 py-3 text-right text-neutral-600 tabular-nums">
                    {stock.reservedQty}
                  </td>
                  <td className="px-4 py-3 text-neutral-700">{stock.location ?? '—'}</td>
                  <td className="px-4 py-3 text-neutral-500 text-xs">
                    {formatDate(stock.updatedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {canEdit && (
        <form onSubmit={handleSubmit} className="space-y-3 border border-neutral-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-neutral-700">
            {stocks.length > 0 ? 'Ajustar stock' : 'Registrar stock'}
          </h3>
          {(formError || mutation.isError) && (
            <Alert variant="error">
              {formError || getApiErrorMessage(mutation.error, 'No se pudo guardar el stock.')}
            </Alert>
          )}
          {mutation.isSuccess && <Alert variant="success">Stock guardado correctamente.</Alert>}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">
                Tipo de ajuste
              </label>
              <select
                value={adjustmentType}
                onChange={(e) => setAdjustmentType(e.target.value as 'in' | 'out' | 'adjust' | '')}
                className={inputClass}
              >
                <option value="">Establecer stock</option>
                <option value="in">Entrada (incrementar)</option>
                <option value="out">Salida (decrementar)</option>
                <option value="adjust">Ajuste (fijar valor)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">
                Cantidad
              </label>
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">Ubicación</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className={inputClass}
                placeholder="Ej: BODEGA-PEREIRA"
                maxLength={120}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">Motivo</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className={inputClass}
              placeholder="Motivo del movimiento (opcional)"
              maxLength={300}
            />
            <p className="text-xs text-neutral-400 mt-1">{adjustmentHint}</p>
          </div>
          <div className="flex justify-end">
            <Button type="submit" loading={mutation.isPending}>
              Guardar stock
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}

// ------------------------------ Proveedores (defensivo) ------------------------------
function SuppliersTab({ product }: { product: Product }) {
  const { data = [], isLoading, error } = useQuery({
    queryKey: ['product-suppliers', product.id],
    queryFn: () => fetchProductSuppliers(product.id),
    retry: false,
  })

  if (isNotImplemented(error)) {
    return (
      <ComingSoon
        title="Proveedores"
        message="El vínculo producto ↔ proveedor estará disponible próximamente."
      />
    )
  }

  if (isLoading) {
    return <p className="text-sm text-neutral-400 py-6 text-center">Cargando proveedores...</p>
  }

  if (error) {
    return (
      <Alert variant="error">
        {getApiErrorMessage(error, 'No se pudieron cargar los proveedores.')}
      </Alert>
    )
  }

  if (data.length === 0) {
    return <p className="text-sm text-neutral-400 py-6 text-center">Sin proveedores asociados.</p>
  }

  return (
    <div className="overflow-x-auto border border-neutral-200 rounded-lg">
      <table className="min-w-full divide-y divide-neutral-200 text-sm">
        <thead className="bg-neutral-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-600 uppercase">Proveedor</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-600 uppercase">NIT</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-600 uppercase">Última orden</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {data.map((s, idx) => (
            <tr key={s.id ?? idx} className="hover:bg-neutral-50">
              <td className="px-4 py-3 font-medium text-neutral-800">{s.name}</td>
              <td className="px-4 py-3 text-xs font-mono text-neutral-500">{s.nit ?? '—'}</td>
              <td className="px-4 py-3 text-neutral-500 text-xs">
                {s.lastOrderAt ? formatDate(s.lastOrderAt) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ------------------------------ Accesos ------------------------------
function AccessTab({ product }: { product: Product }) {
  const [open, setOpen] = useState(false)
  const canManageAccess = canManageListaAccess()
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-neutral-200 p-4">
        <h3 className="text-sm font-semibold text-neutral-700 mb-1">Accesos por producto</h3>
        <p className="text-sm text-neutral-500 mb-3">
          Asigna usuarios con niveles de permiso (ver, editar, gestionar o administrar accesos)
          sobre este producto. La asignación se registra vía{' '}
          <code className="text-xs">/api/assignments</code>.
        </p>
        {canManageAccess ? (
          <Button onClick={() => setOpen(true)}>Gestionar accesos</Button>
        ) : (
          <p className="text-sm text-neutral-400">
            No tienes permisos para gestionar accesos por producto.
          </p>
        )}
      </div>

      {open && canManageAccess && (
        <ProductAccessModal
          productId={product.id}
          productName={product.name}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  )
}

// ------------------------------ Publicación (ciclo de vida FSM) ------------------------------
function PublishTab({
  product,
  allowed,
  canEdit,
  pending,
  error,
  onDirect,
  onOpenAction,
  onDelete,
  scheduleActive,
  scheduledAt,
  onSchedule,
  onReprogram,
  onCancelSchedule,
}: {
  product: Product
  allowed: LifecycleEvent[]
  canEdit: boolean
  pending: boolean
  error: unknown
  onDirect: (event: LifecycleEvent) => void
  onOpenAction: (event: LifecycleEvent) => void
  onDelete: () => void
  scheduleActive: boolean
  scheduledAt: string | null
  onSchedule: () => void
  onReprogram: () => void
  onCancelSchedule: () => void
}) {
  const status = effectiveLifecycleStatus(product)
  const hasError = Boolean(error)
  const statusBadge = (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${LIFECYCLE_STATUS_BG[status]} text-white`}
    >
      {LIFECYCLE_STATUS_LABEL[status]}
    </span>
  )

  const can = (event: LifecycleEvent) => allowed.includes(event)
  const canSchedule = status === 'DRAFT' && can('PUBLISH')

  const actionButton = (event: LifecycleEvent) => {
    const enabled = can(event)
    const label = LIFECYCLE_EVENT_LABEL[event]
    const hintId = `evt-hint-${event}`
    const handleClick = () => {
      if (DIRECT_TRANSITIONS.includes(event)) onDirect(event)
      else onOpenAction(event)
    }
    return (
      <span key={event} className="inline-flex">
        <button
          type="button"
          disabled={!enabled || pending}
          onClick={handleClick}
          aria-describedby={enabled ? undefined : hintId}
          className="px-3 py-2 text-xs font-medium rounded-lg border border-neutral-300 text-neutral-700 bg-white hover:bg-neutral-50 hover:border-security-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {label}
        </button>
        {!enabled && (
          <span id={hintId} className="sr-only">
            {LIFECYCLE_EVENT_HINT[event]}
          </span>
        )}
      </span>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="text-sm text-neutral-600">Estado de ciclo de vida:</span>
        {statusBadge}
      </div>

      {scheduleActive && scheduledAt && (
        <p className="text-xs text-neutral-600" role="status">
          Publicación programada: {formatScheduleDatetime(scheduledAt)}
        </p>
      )}

      {hasError && (
        <Alert variant="error">{getApiErrorMessage(error, 'No se pudo aplicar la acción.')}</Alert>
      )}

      {canEdit && (
        <div className="flex flex-wrap gap-2">
          {actionButton('PUBLISH')}
          {canSchedule &&
            (scheduleActive ? (
              <>
                <button
                  type="button"
                  disabled={pending}
                  onClick={onReprogram}
                  className="px-3 py-2 text-xs font-medium rounded-lg border border-neutral-300 text-neutral-700 bg-white hover:bg-neutral-50 hover:border-security-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Reprogramar publicación
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={onCancelSchedule}
                  className="px-3 py-2 text-xs font-medium rounded-lg border border-red-200 text-red-700 bg-red-50 hover:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancelar programación
                </button>
              </>
            ) : (
              <button
                type="button"
                disabled={pending}
                onClick={onSchedule}
                className="px-3 py-2 text-xs font-medium rounded-lg border border-neutral-300 text-neutral-700 bg-white hover:bg-neutral-50 hover:border-security-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Programar publicación
              </button>
            ))}
          {actionButton('UNPUBLISH')}
          {actionButton('ARCHIVE')}
          {actionButton('RESTORE')}
          {hasPermission('products:delete') && (
            <button
              type="button"
              disabled={pending}
              onClick={onDelete}
              className="px-3 py-2 text-xs font-medium rounded-lg border border-red-200 text-red-700 bg-red-50 hover:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Eliminar
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ------------------------------ Modal de programar/reprogramar ------------------------------
function SchedulePublishModal({
  open,
  initialValue,
  isReprogram,
  loading,
  error,
  onClose,
  onConfirm,
}: {
  open: boolean
  initialValue: string
  isReprogram: boolean
  loading: boolean
  error: unknown
  onClose: () => void
  onConfirm: (iso: string) => void
}) {
  const [value, setValue] = useState(initialValue)
  const [localError, setLocalError] = useState('')

  const title = isReprogram ? 'Reprogramar publicación' : 'Programar publicación'
  const confirmLabel = isReprogram ? 'Reprogramar' : 'Programar'

  const handleConfirm = () => {
    if (!value) {
      setLocalError('Selecciona una fecha y hora de publicación.')
      return
    }
    const when = new Date(value)
    if (Number.isNaN(when.getTime()) || when.getTime() <= Date.now()) {
      setLocalError('La fecha y hora debe ser posterior al momento actual.')
      return
    }
    setLocalError('')
    onConfirm(fromDatetimeLocal(value))
  }

  const apiMessage = error ? getApiErrorMessage(error, 'No se pudo guardar la programación.') : ''

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!loading) onClose()
      }}
      title={title}
      footer={
        <>
          <Button type="button" variant="secondary" disabled={loading} onClick={onClose}>
            Cancelar
          </Button>
          <Button loading={loading} disabled={loading} onClick={handleConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-neutral-600">
          El producto seguirá en Borrador hasta la fecha seleccionada.
        </p>
        {localError && (
          <div role="alert" aria-live="polite">
            <Alert variant="error">{localError}</Alert>
          </div>
        )}
        {apiMessage && (
          <div role="alert" aria-live="polite">
            <Alert variant="error">{apiMessage}</Alert>
          </div>
        )}
        <div>
          <label htmlFor="schedule-publish-datetime" className="block text-sm font-medium text-neutral-800 mb-1.5">
            Fecha y hora de publicación
          </label>
          <input
            id="schedule-publish-datetime"
            type="datetime-local"
            value={value}
            disabled={loading}
            onChange={(e) => {
              setValue(e.target.value)
              setLocalError('')
            }}
            className={inputClass}
            required
          />
        </div>
      </div>
    </Modal>
  )
}

// ------------------------------ Modal de cancelación de programación ------------------------------
function CancelScheduleModal({
  open,
  loading,
  error,
  onClose,
  onConfirm,
}: {
  open: boolean
  loading: boolean
  error: unknown
  onClose: () => void
  onConfirm: () => void
}) {
  const apiMessage = error ? getApiErrorMessage(error, 'No se pudo cancelar la programación.') : ''

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!loading) onClose()
      }}
      title="Cancelar publicación programada"
      footer={
        <>
          <Button type="button" variant="secondary" disabled={loading} onClick={onClose}>
            Volver
          </Button>
          <Button type="button" variant="danger" loading={loading} disabled={loading} onClick={onConfirm}>
            Cancelar programación
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-neutral-600">
          ¿Cancelar la publicación programada?
          <br />
          El producto continuará en Borrador y no se publicará automáticamente en la fecha programada.
        </p>
        {apiMessage && (
          <div role="alert" aria-live="polite">
            <Alert variant="error">{apiMessage}</Alert>
          </div>
        )}
      </div>
    </Modal>
  )
}

// ------------------------------ Modal de motivo/confirmación ------------------------------
/** Eventos que requieren modal de motivo/confirmación (solo ARCHIVE/RESTORE). */
type LifecycleModalEvent = 'ARCHIVE' | 'RESTORE'

const LIFECYCLE_MODAL_META: Record<
  LifecycleModalEvent,
  { title: string; description: string; confirmLabel: string }
> = {
  ARCHIVE: {
    title: 'Archivar producto',
    description:
      'El producto se archivará y dejará de estar disponible comercialmente. Esta acción requiere motivo y confirmación.',
    confirmLabel: 'Archivar',
  },
  RESTORE: {
    title: 'Restaurar producto',
    description:
      'El producto saldrá del archivo y volverá a estar disponible para gestión. Esta acción requiere motivo y confirmación.',
    confirmLabel: 'Restaurar',
  },
}

function LifecycleConfirmModal({
  event,
  loading,
  error,
  onClose,
  onConfirm,
}: {
  event: LifecycleModalEvent
  loading: boolean
  error: unknown
  onClose: () => void
  onConfirm: (reason: string) => void
}) {
  const [reason, setReason] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [formError, setFormError] = useState('')

  // ARCHIVE y RESTORE exigen motivo y confirmación en el backend.
  const requiresReason = true
  const requiresConfirm = true
  const meta = LIFECYCLE_MODAL_META[event]

  const handleConfirm = () => {
    if (requiresReason && !reason.trim()) {
      setFormError('El motivo es obligatorio.')
      return
    }
    if (requiresConfirm && !confirmed) {
      setFormError('Debes marcar la confirmación.')
      return
    }
    setFormError('')
    onConfirm(reason.trim())
  }

  const alertMessage =
    formError || (error ? getApiErrorMessage(error, 'No se pudo completar la acción.') : '')

  return (
    <Modal
      open
      onClose={() => {
        if (!loading) onClose()
      }}
      title={meta.title}
      footer={
        <>
          <Button variant="secondary" disabled={loading} onClick={onClose}>
            Cancelar
          </Button>
          <Button loading={loading} onClick={handleConfirm}>
            {meta.confirmLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {alertMessage && <Alert variant="error">{alertMessage}</Alert>}
        <p className="text-sm text-neutral-600">{meta.description}</p>
        {requiresReason && (
          <div>
            <label className="block text-sm font-medium text-neutral-800 mb-1.5">
              Motivo <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className={`${inputClass} resize-none`}
              rows={3}
              maxLength={300}
              placeholder="Indica el motivo de la acción"
            />
          </div>
        )}
        {requiresConfirm && (
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-0.5 w-4 h-4 text-[var(--color-primary)] border-neutral-300 rounded focus:ring-[var(--color-primary-focus-ring)]"
            />
            <span className="text-sm text-neutral-700">
              Confirmo que entiendo que esta acción no se puede deshacer.
            </span>
          </label>
        )}
      </div>
    </Modal>
  )
}

// ------------------------------ Modal de borrado físico ------------------------------
function DeleteProductModal({
  loading,
  error,
  onClose,
  onConfirm,
}: {
  loading: boolean
  error: unknown
  onClose: () => void
  onConfirm: (opts: { clave?: string; masterKey?: string }) => void
}) {
  const [confirmed, setConfirmed] = useState(false)
  const [clave, setClave] = useState('')
  const [masterKey, setMasterKey] = useState('')
  const [formError, setFormError] = useState('')

  const status = getTransitionHttpStatus(error)
  const errorCode = (error as { response?: { data?: { code?: string } } })?.response?.data?.code
  const needsClave = errorCode === 'CLAVE_USUARIO_REQUERIDA' || errorCode === 'CLAVE_USUARIO_INCORRECTA'
  const needsMasterKey = status === 409 || status === 403
  const errorMessage = error ? getApiErrorMessage(error, 'No se pudo eliminar el producto.') : null

  const handleConfirm = () => {
    if (!confirmed) {
      setFormError('Debes confirmar el borrado.')
      return
    }
    if (needsClave && !clave.trim()) {
      setFormError('La clave del usuario es obligatoria para eliminar este producto.')
      return
    }
    if (needsMasterKey && !masterKey.trim()) {
      setFormError('La clave maestra es obligatoria para eliminar este producto.')
      return
    }
    setFormError('')
    const opts: { clave?: string; masterKey?: string } = {}
    if (needsClave) opts.clave = clave.trim()
    if (needsMasterKey) opts.masterKey = masterKey.trim()
    onConfirm(opts)
  }

  const alertMessage = formError || errorMessage || ''

  return (
    <Modal
      open
      onClose={() => {
        if (!loading) onClose()
      }}
      title="Eliminar producto"
      footer={
        <>
          <Button variant="secondary" disabled={loading} onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="danger" loading={loading} onClick={handleConfirm}>
            {needsClave || needsMasterKey ? 'Eliminar con clave' : 'Eliminar producto'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {alertMessage && <Alert variant="error">{alertMessage}</Alert>}
        <p className="text-sm text-neutral-600">
          Esta acción elimina el producto definitivamente (incluye precios e imágenes asociados).{' '}
          <strong>No se puede deshacer.</strong>
        </p>
        <label className="flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="mt-0.5 w-4 h-4 text-[var(--color-primary)] border-neutral-300 rounded focus:ring-[var(--color-primary-focus-ring)]"
          />
          <span className="text-sm text-neutral-700">
            Confirmo que entiendo el alcance de esta acción y que no se puede deshacer.
          </span>
        </label>

        {needsClave && (
          <div>
            <label className="block text-sm font-medium text-neutral-800 mb-1.5">
              Clave del usuario
            </label>
            <input
              id="delete-product-clave"
              type="password"
              value={clave}
              onChange={(e) => setClave(e.target.value)}
              autoComplete="current-password"
              placeholder="••••••"
              className={inputClass}
            />
            <p className="text-xs text-neutral-500 mt-1.5">
              {errorCode === 'CLAVE_USUARIO_INCORRECTA'
                ? 'Clave incorrecta. Inténtalo de nuevo.'
                : 'Ingresa tu clave para confirmar la eliminación.'}
            </p>
          </div>
        )}

        {needsMasterKey && (
          <div>
            <label className="block text-sm font-medium text-neutral-800 mb-1.5">
              Clave maestra
            </label>
            <input
              id="delete-product-master-key"
              type="password"
              value={masterKey}
              onChange={(e) => setMasterKey(e.target.value)}
              autoComplete="off"
              placeholder="••••••"
              className={inputClass}
            />
            <p className="text-xs text-neutral-500 mt-1.5">
              El producto tiene datos asociados. Ingresa la clave maestra para eliminar.
            </p>
          </div>
        )}
      </div>
    </Modal>
  )
}

// ------------------------------ Auditoría ------------------------------
function AuditTab({ product }: { product: Product }) {
  const canView = canViewAudit()

  const { data: logs = [], isLoading, error } = useQuery({
    queryKey: ['product-audit', product.id],
    queryFn: () => fetchProductAudit('Product', product.id),
    enabled: canView,
    retry: false,
  })

  if (!canView) {
    return <p className="text-sm text-neutral-400 py-6 text-center">No tienes permisos para ver la auditoría.</p>
  }

  if (isLoading) {
    return <p className="text-sm text-neutral-400 py-6 text-center">Cargando auditoría...</p>
  }

  if (error) {
    return <Alert variant="error">{getApiErrorMessage(error, 'No se pudo cargar la auditoría.')}</Alert>
  }

  if (logs.length === 0) {
    return <p className="text-sm text-neutral-400 py-6 text-center">Sin eventos de auditoría para este producto.</p>
  }

  return (
    <div className="overflow-x-auto border border-neutral-200 rounded-lg">
      <table className="min-w-full divide-y divide-neutral-200 text-xs">
        <thead className="bg-neutral-50">
          <tr>
            <th className="px-3 py-2 text-left text-xs font-semibold text-neutral-600 uppercase">Fecha</th>
            <th className="px-3 py-2 text-left text-xs font-semibold text-neutral-600 uppercase">Usuario</th>
            <th className="px-3 py-2 text-left text-xs font-semibold text-neutral-600 uppercase">Acción</th>
            <th className="px-3 py-2 text-left text-xs font-semibold text-neutral-600 uppercase">Detalle</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {logs.map((log: AuditLog) => (
            <tr key={log.id}>
              <td className="px-3 py-1.5 text-neutral-500 text-xs whitespace-nowrap">
                {formatDate(log.createdAt)}
              </td>
              <td className="px-3 py-1.5 text-neutral-700">
                {log.user?.name ?? log.user?.email ?? 'Sistema'}
              </td>
              <td className="px-3 py-1.5">
                <Badge variant={log.action === 'delete' ? 'error' : log.action === 'create' ? 'success' : 'info'}>
                  {log.action}
                </Badge>
              </td>
              <td className="px-3 py-1.5 text-xs text-neutral-500">
                <details>
                  <summary className="cursor-pointer text-[var(--color-primary)]">
                    Ver cambios
                  </summary>
                  <pre className="mt-1 bg-neutral-50 p-1.5 rounded overflow-x-auto text-[11px] text-neutral-600">
                    {JSON.stringify({ anterior: log.oldValues, nuevo: log.newValues }, null, 2)}
                  </pre>
                </details>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ------------------------------ Página ------------------------------
export default function ProductDetailPage() {
  const { productId } = useParams<{ productId: string }>()
  const navigate = useNavigate()
  const [tab, setTab] = useState<DetailTab>('info')
  const [selectedImage, setSelectedImage] = useState(0)
  const [lifecycleModal, setLifecycleModal] = useState<{ event: LifecycleModalEvent } | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [scheduleModal, setScheduleModal] = useState<{ isReprogram: boolean } | null>(null)
  const [cancelScheduleOpen, setCancelScheduleOpen] = useState(false)

  const queryClient = useQueryClient()

  // ============ TODOS LOS HOOKS DE QUERY AQUÍ (antes de cualquier return) ============
  const { data: product, isLoading, error } = useQuery({
    queryKey: ['product', productId],
    queryFn: async () => {
      const res = await api.get(`/products/${productId}`)
      return res.data as Product
    },
    enabled: Boolean(productId),
    retry: 1,
  })

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const res = await api.get('/categories')
      return (res.data as { data: Category[] }).data
    },
  })

  const { data: brands = [] } = useQuery({
    queryKey: ['brands'],
    queryFn: async () => {
      const res = await api.get('/brands')
      return (res.data as { data: Brand[] }).data
    },
  })

  const transition = useTransitionProduct(productId)

  // ============ HOOKS DE MUTATION (SIEMPRE SE LLAMAN, INDEPENDIENTEMENTE DE product) ============
  const deleteMutation = useMutation({
    mutationFn: (opts?: { clave?: string; masterKey?: string }) => {
      if (!product) return Promise.reject(new Error('Producto no cargado'))
      return deleteProduct(product.id, opts)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'], refetchType: 'all' })
      navigate('/commercial/products')
    },
  })

  const scheduleMutation = useMutation({
    mutationFn: (iso: string) => {
      if (!product) return Promise.reject(new Error('Producto no cargado'))
      return schedulePublish(product.id, { publishAt: iso })
    },
    onSuccess: () => {
      setScheduleModal(null)
      queryClient.invalidateQueries({ queryKey: ['products'], refetchType: 'all' })
      if (product) queryClient.invalidateQueries({ queryKey: ['product', product.id] })
    },
  })

  const cancelScheduleMutation = useMutation({
    mutationFn: () => {
      if (!product) return Promise.reject(new Error('Producto no cargado'))
      return cancelScheduledPublish(product.id)
    },
    onSuccess: () => {
      setCancelScheduleOpen(false)
      queryClient.invalidateQueries({ queryKey: ['products'], refetchType: 'all' })
      if (product) queryClient.invalidateQueries({ queryKey: ['product', product.id] })
    },
  })

  const { priceLists } = usePriceLists()
  const canEdit = hasPermission('products:write')

  // El tab Precios exige ACL edit_prices en el backend (Super Admin + Admin Comercial);
  // para el resto de roles se oculta para no disparar 403/404.
  const visibleTabs = TABS.filter((t) => t.id !== 'prices' || canEdit)
  const effectiveTab: DetailTab = visibleTabs.some((t) => t.id === tab) ? tab : 'info'

  // ============ RETORNOS CONDICIONALES (ahora después de todos los hooks) ============
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-6 bg-neutral-100 rounded w-1/4 animate-pulse"></div>
        <div className="border border-neutral-200 rounded-xl p-6 animate-pulse">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="h-64 bg-neutral-100 rounded animate-pulse"></div>
            <div className="lg:col-span-2 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-4 bg-neutral-100 rounded w-3/4"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error || !product) {
    return (
      <div className="space-y-6">
        <Link
          to="/commercial/products"
          className="text-sm text-security-600 hover:text-security-700"
        >
          ← Volver a Productos
        </Link>
        <div className="border border-neutral-200 rounded-xl p-6 text-center text-neutral-500">
          <p>No se pudo cargar el producto.</p>
          <p className="text-xs mt-1">
            {error
              ? getApiErrorMessage(error, 'Error desconocido')
              : 'Producto no encontrado'}
          </p>
        </div>
      </div>
    )
  }

  // ============ EL RESTO DEL CÓDIGO (ahora product existe con seguridad) ============
  const orderedLists = orderedPriceLists(priceLists)

  const detailAllowed = product.allowedActions ?? []
  const effectiveStatus = effectiveLifecycleStatus(product)

  const runTransition = (payload: TransitionPayload) => {
    transition.mutate(payload, {
      onSuccess: () => {
        setLifecycleModal(null)
      },
    })
  }

  const handleDeleteOpen = () => {
    deleteMutation.reset()
    setDeleteOpen(true)
  }

  const scheduleActive = hasActiveScheduling(product)
  const scheduledAt = product.publishAt && hasActiveScheduling(product) ? product.publishAt : null

  const openSchedule = () => {
    scheduleMutation.reset()
    setScheduleModal({ isReprogram: false })
  }
  const openReprogram = () => {
    scheduleMutation.reset()
    setScheduleModal({ isReprogram: true })
  }
  const openCancelSchedule = () => {
    cancelScheduleMutation.reset()
    setCancelScheduleOpen(true)
  }
  const confirmCancelSchedule = () => cancelScheduleMutation.mutate()

  const effectiveStatusBadgeClass = LIFECYCLE_STATUS_BG[effectiveStatus]

  const finalPrice = orderedLists.reduce<PriceList | null>((acc, list) => {
    if (acc) return acc
    const price = findPrice(product, list.id)
    if (price && Number(price.value) > 0) return list
    return acc
  }, null)

  const finalPriceValue = finalPrice ? findPrice(product, finalPrice.id) : undefined
  const priceWithIva = finalPriceValue ? Number(finalPriceValue.value) : undefined

  const gallery = product.images.length > 0 ? product.images : []
  const mainImage =
    gallery[selectedImage]?.url ||
    (product.images[0]?.url ?? null)

  // ============ RENDER ============
  return (
    <div className="space-y-6 pb-8">
      <nav aria-label="Breadcrumb">
        <ol className="flex items-center gap-1.5 text-sm text-neutral-500 flex-wrap">
          <li>
            <Link to="/commercial/products" className="hover:text-security-600">
              Productos
            </Link>
          </li>
          <li aria-hidden>›</li>
          <li className="text-neutral-700">
            {product.brand?.name || 'Producto'}
          </li>
        </ol>
      </nav>

      <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
        <div className="lg:flex lg:gap-0 lg:items-stretch">
          <div className="lg:w-1/2 xl:w-2/5 relative">
            <div className="aspect-[4/3] bg-gradient-to-br from-neutral-50 to-neutral-100 flex items-center justify-center">
              {mainImage ? (
                <img
                  src={mainImage}
                  alt={product.name}
                  className="w-full h-full object-contain"
                />
              ) : (
                <svg
                  className="w-24 h-24 text-neutral-300"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1}
                    d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                  />
                </svg>
              )}
            </div>

            <div className="absolute top-4 left-4 flex flex-col gap-1.5 z-10">
              <span className={`px-2.5 py-1 text-white text-[11px] font-semibold rounded ${product.isActive ? 'bg-emerald-700' : 'bg-neutral-500'}`}>
                {product.isActive ? 'Activo' : 'Inactivo'}
              </span>
              <span className={`px-2.5 py-1 text-white text-[11px] font-semibold rounded ${product.isVisible ? 'bg-security-600' : 'bg-neutral-600'}`}>
                {product.isVisible ? 'Visible' : 'Oculto'}
              </span>
              <span className={`px-2.5 py-1 text-white text-[11px] font-semibold rounded ${effectiveStatusBadgeClass}`}>
                {LIFECYCLE_STATUS_LABEL[effectiveStatus]}
              </span>
            </div>

            {gallery.length > 1 && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
                {gallery.map((img, i) => (
                  <button
                    key={img.id}
                    onClick={() => setSelectedImage(i)}
                    className={`w-8 h-8 rounded overflow-hidden border-2 transition-all ${
                      i === selectedImage
                        ? 'border-security-600'
                        : 'border-white hover:border-neutral-300'
                    }`}
                  >
                    <img
                      src={img.url}
                      alt={`${product.name} #${i + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="lg:w-1/2 xl:w-3/5 p-6">
            <p className="text-[11px] font-semibold text-security-600 uppercase tracking-wide">
              {product.brand?.name || 'Sin marca'}
            </p>
            <h1 className="text-xl font-bold text-neutral-800 mt-1">
              {product.name}
            </h1>
            <p className="text-xs text-neutral-400 font-mono mt-1">
              {product.sku}
            </p>

            {priceWithIva !== undefined && (
              <p className="mt-3 text-2xl font-bold text-security-700 tabular-nums">
                $ {formatCurrency(priceWithIva, 'COP')}
              </p>
            )}

            <div className="mt-4 pt-4 border-t border-neutral-100 text-xs text-neutral-500 space-y-1">
              <div className="flex justify-between">
                <span>Categoría</span>
                <span className="text-neutral-700 font-medium">
                  {product.category?.name || 'Sin categoría'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Creado</span>
                <span>{formatDate(product.createdAt)}</span>
              </div>
              <div className="flex justify-between">
                <span>Actualizado</span>
                <span>{formatDate(product.updatedAt)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="border border-neutral-200 rounded-xl bg-white">
        <div className="px-6 pt-4 border-b border-neutral-200 flex gap-1 overflow-x-auto">
          {visibleTabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 -mb-px transition-colors whitespace-nowrap ${
                effectiveTab === t.id
                  ? 'border-security-600 text-security-700'
                  : 'border-transparent text-neutral-500 hover:text-neutral-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {effectiveTab === 'info' && <InfoTab product={product} categories={categories} brands={brands} />}
          {effectiveTab === 'specs' && <AtributosTab product={product} />}
          {effectiveTab === 'images' && <ImagesTab product={product} />}
          {effectiveTab === 'prices' && <PricesTab product={product} />}
          {effectiveTab === 'stock' && <StockTab product={product} />}
          {effectiveTab === 'suppliers' && <SuppliersTab product={product} />}
          {effectiveTab === 'access' && <AccessTab product={product} />}
          {effectiveTab === 'publish' && (
            <PublishTab
              product={product}
              allowed={detailAllowed}
              canEdit={canEdit || hasPermission('publish:manage')}
              pending={transition.isPending}
              error={transition.error}
              onDirect={(event) => runTransition({ event })}
              onOpenAction={(event) => setLifecycleModal({ event: event as LifecycleModalEvent })}
              onDelete={handleDeleteOpen}
              scheduleActive={scheduleActive}
              scheduledAt={scheduledAt}
              onSchedule={openSchedule}
              onReprogram={openReprogram}
              onCancelSchedule={openCancelSchedule}
            />
          )}
          {effectiveTab === 'audit' && <AuditTab product={product} />}
        </div>
      </div>

      {scheduleModal && (
        <SchedulePublishModal
          open
          initialValue={scheduleModal.isReprogram && product.publishAt ? toDatetimeLocal(product.publishAt) : ''}
          isReprogram={scheduleModal.isReprogram}
          loading={scheduleMutation.isPending}
          error={scheduleMutation.error}
          onClose={() => {
            if (!scheduleMutation.isPending) setScheduleModal(null)
          }}
          onConfirm={(iso) => scheduleMutation.mutate(iso)}
        />
      )}

      {cancelScheduleOpen && (
        <CancelScheduleModal
          open
          loading={cancelScheduleMutation.isPending}
          error={cancelScheduleMutation.error}
          onClose={() => {
            if (!cancelScheduleMutation.isPending) setCancelScheduleOpen(false)
          }}
          onConfirm={confirmCancelSchedule}
        />
      )}

      {lifecycleModal && (
        <LifecycleConfirmModal
          event={lifecycleModal.event}
          loading={transition.isPending}
          error={transition.error}
          onClose={() => setLifecycleModal(null)}
          onConfirm={(reason) =>
            runTransition({
              event: lifecycleModal.event,
              ...(reason ? { reason } : {}),
              ...(lifecycleModal.event === 'ARCHIVE' || lifecycleModal.event === 'RESTORE'
                ? { confirm: true }
                : {}),
            })
          }
        />
      )}

      {deleteOpen && (
        <DeleteProductModal
          loading={deleteMutation.isPending}
          error={deleteMutation.error}
          onClose={() => setDeleteOpen(false)}
          onConfirm={(opts) => deleteMutation.mutate(opts)}
        />
      )}
    </div>
  )
}