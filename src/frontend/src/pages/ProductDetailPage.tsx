import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import api from '../services/api'
import type { Product, PriceList } from '../features/products/types/product.types'
import { usePriceLists } from '../features/products/hooks/usePriceLists'
import { getApiErrorMessage } from '../lib/apiError'
import { formatCurrency, formatDate } from '../lib/format'
import { useProductMutations } from '../features/products/hooks/useProductMutations'
import { hasPermission } from '../lib/rbac'

type DetailTab = 'specs' | 'prices' | 'images'

const PRICE_LIST_ORDER = [
  'CLIENTE_FINAL_IVA',
  'DPP_ORO_IVA',
  'DPP_PLATINO_IVA',
  'TIENDA_IVA',
  'ORO_SIN_IVA',
  'INSTALADOR_IVA',
  'INSTALLER_SIN_IVA',
]

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

const SPEC_GROUPS: Array<{ title: string; keys: string[] }> = [
  {
    title: 'Camera',
    keys: ['Image Sensor', 'Max. Resolution', 'Min. Illumination', 'Shutter Time', 'Day & Night'],
  },
  {
    title: 'Lens',
    keys: ['Lens Type', 'Focal Length & FOV', 'Lens Mount', 'Iris Type', 'Aperture', 'Depth of Field'],
  },
  {
    title: 'DORI',
    keys: ['DORI'],
  },
  {
    title: 'Illuminator',
    keys: [
      'IR Wavelength',
      'Supplement Light Range',
      'Smart Supplement Light',
      'Supplement Light Type',
    ],
  },
  {
    title: 'Video',
    keys: [
      'Main Stream',
      'Sub-Stream',
      'Third Stream',
      'Fourth Stream',
      'Video Compression',
      'Video Bit Rate',
      'H.264 Type',
      'H.265 Type',
      'Scalable Video Coding (SVC)',
      'Bit Rate Control',
      'Region of Interest (ROI)',
      'Target Cropping',
    ],
  },
  {
    title: 'Audio',
    keys: [
      'Audio Type',
      'Audio Compression',
      'Audio Bit Rate',
      'Audio Sampling Rate',
      'Environment Noise Filtering',
      'Built-in Speaker',
      'Audio Input',
      'Audio Output',
    ],
  },
  {
    title: 'Network',
    keys: [
      'Simultaneous Live View',
      'API',
      'Protocols',
      'User/Host',
      'Security',
      'Network Storage',
      'Client',
      'Web Browser',
    ],
  },
  {
    title: 'Image',
    keys: [
      'Wide Dynamic Range (WDR)',
      'Privacy Mask',
      'Day/Night Switch',
      'Image Enhancement',
      'Image Parameters Switch',
      'SNR',
    ],
  },
  {
    title: 'Interface',
    keys: ['Ethernet Interface', 'On-Board Storage', 'Reset Key', 'Alarm', 'General Function'],
  },
  {
    title: 'Event',
    keys: ['Basic Event', 'Smart Event', 'Linkage'],
  },
  {
    title: 'Deep Learning Function',
    keys: ['Face Capture', 'Perimeter Protection', 'Line Crossing', 'Intrusion', 'Loitering', 'People Gathering'],
  },
  {
    title: 'Power',
    keys: ['Power', 'Power Consumption'],
  },
  {
    title: 'Dimension & Weight',
    keys: [
      'Material',
      'Dimension',
      'Package Dimension',
      'Storage Conditions',
      'Startup and Operating Conditions',
      'Approx. Weight',
      'With Package Weight',
    ],
  },
  {
    title: 'Other',
    keys: ['Language', 'Anti-Corrosion Protection', 'General Function'],
  },
]

function SpecGroup({
  group,
  data,
}: {
  group: { title: string; keys: string[] }
  data: Record<string, unknown> | null
}) {
  const entries = group.keys
    .map((key) => {
      const value = data?.[key]
      if (value === undefined || value === null || value === '') return null
      return [key, value] as [string, unknown]
    })
    .filter(Boolean) as [string, unknown][]

  if (entries.length === 0) return null

  const [open, setOpen] = useState(true)

  return (
    <div className="border-b border-neutral-100">
      <button
        onClick={() => setOpen(!open)}
        type="button"
        className="w-full flex items-center justify-between text-left py-3"
      >
        <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">
          {group.title}
        </span>
        <svg
          className={`w-4 h-4 text-neutral-400 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 pb-3">
          {entries.map(([key, value]) => (
            <div key={key} className="flex justify-between py-1">
              <dt className="text-sm text-neutral-600">{key}</dt>
              <dd className="text-sm font-medium text-neutral-800 text-right max-w-[60%]">
                {String(value)}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  )
}

function SpecGrid({ data }: { data?: Record<string, unknown> | null }) {
  if (!data || Object.keys(data).length === 0) {
    return <p className="text-sm text-neutral-400">Sin datos</p>
  }
  const shownKeys = new Set<string>()
  return (
    <div className="divide-y divide-neutral-100 border border-neutral-100 rounded-lg overflow-hidden">
      {SPEC_GROUPS.map((group) => {
        const entries = group.keys
          .map((key) => {
            const value = data[key]
            if (value === undefined || value === null || value === '') return null
            shownKeys.add(key)
            return [key, value] as [string, unknown]
          })
          .filter(Boolean) as [string, unknown][]
        if (entries.length === 0) return null
        return <SpecGroup key={group.title} group={group} data={data} />
      })}
      {Object.entries(data)
        .filter(([key]) => !shownKeys.has(key))
        .map(([key, value]) => (
          <div key={key} className="flex justify-between py-2 border-b border-neutral-100 last:border-0">
            <dt className="text-sm text-neutral-600">{key}</dt>
            <dd className="text-sm font-medium text-neutral-800">{String(value ?? '')}</dd>
          </div>
        ))}
    </div>
  )
}

export default function ProductDetailPage() {
  const { productId } = useParams<{ productId: string }>()
  const [tab, setTab] = useState<DetailTab>('specs')
  const [selectedImage, setSelectedImage] = useState(0)

  const { data: product, isLoading, error } = useQuery({
    queryKey: ['product', productId],
    queryFn: async () => {
      const res = await api.get(`/products/${productId}`)
      return res.data as Product
    },
    enabled: Boolean(productId),
    retry: 1,
  })

  const { priceLists } = usePriceLists()
  const { toggleActive, toggleVisibility } = useProductMutations()

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

  const orderedLists = orderedPriceLists(priceLists)

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
              <span className="px-2.5 py-1 bg-emerald-500 text-white text-[11px] font-semibold rounded">
                {product.isActive ? 'Activo' : 'Inactivo'}
              </span>
              <span className="px-2.5 py-1 bg-security-600 text-white text-[11px] font-semibold rounded">
                {product.isVisible ? 'Visible' : 'Oculto'}
              </span>
            </div>

            {hasPermission('products:write') && (
              <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                <button
                  onClick={() => {
                    const editingEvent = new CustomEvent('open-product-edit', {
                      detail: { productId: product.id },
                    })
                    window.dispatchEvent(editingEvent)
                  }}
                  className="p-2 bg-white rounded-lg shadow hover:bg-neutral-50 text-neutral-600 hover:text-security-600 transition-colors"
                  title="Editar producto"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 012.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                    />
                  </svg>
                </button>
              </div>
            )}

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

            {hasPermission('products:write') && (
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => toggleActive.mutate(product.id)}
                  className={`flex-1 py-1.5 text-xs font-medium rounded transition-colors ${
                    product.isActive
                      ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                      : 'bg-red-50 text-red-700 hover:bg-red-100'
                  }`}
                >
                  {product.isActive ? 'Activo' : 'Inactivo'}
                </button>
                <button
                  onClick={() => toggleVisibility.mutate(product.id)}
                  className={`flex-1 py-1.5 text-xs font-medium rounded transition-colors ${
                    product.isVisible
                      ? 'bg-security-50 text-security-700 hover:bg-security-100'
                      : 'bg-neutral-50 text-neutral-600 hover:bg-neutral-100'
                  }`}
                >
                  {product.isVisible ? 'Visible' : 'Oculto'}
                </button>
              </div>
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
          {(
            [
              ['specs', 'Especificaciones'],
              ['prices', 'Precios'],
              ['images', 'Imágenes'],
            ] as [DetailTab, string][]
          ).map(([t, label]) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 -mb-px transition-colors whitespace-nowrap ${
                tab === t
                  ? 'border-security-600 text-security-700'
                  : 'border-transparent text-neutral-500 hover:text-neutral-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {tab === 'specs' && (
            <div>
              <SpecGrid data={product.technicalSpecs} />
            </div>
          )}

          {tab === 'prices' && (
            <div className="overflow-x-auto">
              {orderedLists.length > 0 ? (
                <table className="min-w-full divide-y divide-neutral-200 text-sm">
                  <thead className="bg-neutral-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-600 uppercase">
                        Lista de precios
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-neutral-600 uppercase">
                        Precio unitario
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-600 uppercase">
                        Vigencia
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {orderedLists.map((list) => {
                      const price = findPrice(product, list.id)
                      const val = price ? Number(price.value) : undefined
                      return (
                        <tr key={list.id}>
                          <td className="px-4 py-3">
                            <div className="flex flex-col">
                              <span className="font-medium text-neutral-800">
                                {list.name}
                              </span>
                              <span className="text-xs text-neutral-400 font-mono">
                                {list.code}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            {val === undefined ? (
                              <span className="text-neutral-300 text-xs">—</span>
                            ) : val === 0 ? (
                              <span className="text-neutral-300 text-xs">Sin precio</span>
                            ) : (
                              <span className="font-medium text-neutral-800">
                                {formatCurrency(val, list.currency)}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-neutral-500 text-xs">
                            {price?.validFrom && price?.validUntil
                              ? `${formatDate(price.validFrom)} – ${formatDate(price.validUntil)}`
                              : price?.validFrom
                                ? `Desde ${formatDate(price.validFrom)}`
                                : price?.validUntil
                                  ? `Hasta ${formatDate(price.validUntil)}`
                                  : 'Sin vigencia'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              ) : (
                <p className="text-neutral-400 text-sm py-6 text-center">
                  No hay listas de precios disponibles
                </p>
              )}
            </div>
          )}

          {tab === 'images' && (
            <div className="space-y-4">
              <p className="text-xs text-neutral-500 uppercase tracking-wide">
                Galería de imágenes ({product.images.length})
              </p>
              {product.images.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {product.images.map((img, i) => (
                    <div
                      key={img.id}
                      className="border border-neutral-200 rounded-lg overflow-hidden"
                    >
                      <img
                        src={img.url}
                        alt={`${product.name} #${i + 1}`}
                        className="w-full h-24 object-cover"
                      />
                      {img.isPrimary && (
                        <span className="block text-[10px] font-semibold bg-security-600 text-white px-2 py-0.5">
                          Principal
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-neutral-400">
                  <svg
                    className="w-12 h-12 mx-auto mb-2 text-neutral-300"
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
                  <p>No hay imágenes</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
