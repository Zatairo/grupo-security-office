import { useEffect, useMemo, useRef, useState } from 'react'
import type { Product, ProductPrice, LifecycleEvent } from '../types/product.types'
import { LIFECYCLE_STATUS_LABEL, effectiveLifecycleStatus } from '../lib/lifecycle'
import { ProductStatusBadge } from './ProductStatusBadge'
import { ProductIndicators } from './ProductIndicators'
import { hasPermission } from '../../../lib/rbac'
import { formatCurrency, formatDate } from '../../../lib/format'

type SortDir = 'asc' | 'desc'
type SortKey = 'sku' | 'product' | 'brand' | 'category' | 'updatedAt'

interface ProductSpreadsheetTableProps {
  products?: Product[]
  isLoading?: boolean
  onEdit: (product: Product) => void
  onTransition: (id: string, event: LifecycleEvent) => void
  onDelete: (id: string) => void
  selectedProductIds?: Set<string>
  onToggleSelectProduct?: (id: string) => void
  onToggleSelectAllProducts?: () => void
  accessRestrictedIds?: Set<string>
  accessUnavailable?: boolean
  onMoveCategory?: (product: Product) => void
  onAccess?: (product: Product) => void
}

const COLUMN_WIDTHS = {
  select: 44,
  sku: 140,
  product: 320,
  brand: 140,
  category: 160,
  price: 136,
  lifecycle: 120,
  updated: 140,
  indicators: 200,
  actions: 168,
} as const

const baseWidthStyle = (w: number) => ({
  width: `${w}px`,
  minWidth: `${w}px`,
  maxWidth: `${w}px`,
})

const cellBase = 'border-r border-b border-neutral-200'
const thBase = `${cellBase} sticky top-0 z-30 px-3 py-2.5 text-left text-xs font-semibold text-gray-600 whitespace-nowrap bg-gray-50`

type PriceColumnKey = string

interface PriceColumnSpec {
  key: PriceColumnKey
  label: string
  match: (list: { id: string; name: string; code: string }) => boolean
}

const PRICE_COLUMN_SPECS: PriceColumnSpec[] = [
  {
    key: 'cliente_final',
    label: 'Precio cliente final',
    match: (list) => `${list.name} ${list.code}`.toLowerCase().includes('cliente final'),
  },
  {
    key: 'dpp_oro',
    label: 'Precio DPP Oro',
    match: (list) => `${list.name} ${list.code}`.toLowerCase().includes('dpp oro'),
  },
  {
    key: 'dpp_platino',
    label: 'Precio DPP Platino',
    match: (list) => `${list.name} ${list.code}`.toLowerCase().includes('dpp platino'),
  },
  {
    key: 'tienda',
    label: 'Precio tienda',
    match: (list) => `${list.name} ${list.code}`.toLowerCase().includes('tienda'),
  },
  {
    key: 'oro',
    label: 'Precio oro (sin IVA)',
    match: (list) => `${list.name} ${list.code}`.toLowerCase().includes('oro') && !`${list.name} ${list.code}`.toLowerCase().includes('dpp oro'),
  },
  {
    key: 'instalador',
    label: 'Precio instalador',
    match: (list) => `${list.name} ${list.code}`.toLowerCase().includes('instalador'),
  },
  {
    key: 'installer',
    label: 'Precio installer (sin IVA)',
    match: (list) => `${list.name} ${list.code}`.toLowerCase().includes('installer'),
  },
]

function numericValue(price: ProductPrice | undefined): number | undefined {
  return price ? Number(price.value) : undefined
}

function PriceCellValue({ price }: { price: ProductPrice | undefined }) {
  const num = numericValue(price)
  if (num === undefined) {
    return (
      <span className="inline-block text-[10px] font-semibold bg-amber-100 text-amber-700 px-2 py-0.5 rounded whitespace-nowrap">
        Sin precio
      </span>
    )
  }
  if (num === 0) {
    return <span className="text-sm text-neutral-300">—</span>
  }
  return (
    <span className="text-sm font-medium text-gray-900 tabular-nums">
      {formatCurrency(num, price?.currency)}
    </span>
  )
}

function resolvePriceColumns(
  product: Product,
): Record<PriceColumnKey, ProductPrice | undefined> {
  const prices = product.prices ?? []
  const used = new Set<ProductPrice>()
  const result: Record<PriceColumnKey, ProductPrice | undefined> = {}

  for (const spec of PRICE_COLUMN_SPECS) {
    const found = prices.find((p) => !used.has(p) && spec.match(p.priceList))
    if (found) {
      result[spec.key] = found
      used.add(found)
    }
  }

  const remaining = prices.find((p) => !used.has(p))
  if (remaining) {
    result['extra'] = remaining
  }

  return result
}

function getVisiblePriceColumns(products: Product[]): PriceColumnSpec[] {
  const visibleKeys = new Set<PriceColumnKey>()
  for (const product of products) {
    const resolved = resolvePriceColumns(product)
    Object.keys(resolved).forEach((k) => visibleKeys.add(k))
  }
  return PRICE_COLUMN_SPECS.filter((spec) => visibleKeys.has(spec.key))
}

export function ProductSpreadsheetTable({
  products = [],
  isLoading = false,
  onEdit,
  onDelete,
  selectedProductIds,
  onToggleSelectProduct,
  onToggleSelectAllProducts,
  accessRestrictedIds,
  accessUnavailable,
  onMoveCategory,
  onAccess,
}: ProductSpreadsheetTableProps) {
  const canWrite = hasPermission('products:write')
  const canDelete = hasPermission('products:delete')

  const [sortKey, setSortKey] = useState<SortKey | null>('product')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const [internalSelectedIds, setInternalSelectedIds] = useState<Set<string>>(() => new Set())
  const headerCheckboxRef = useRef<HTMLInputElement>(null)

  const controlled = typeof onToggleSelectProduct === 'function'
  const selectedIds = controlled ? (selectedProductIds ?? new Set<string>()) : internalSelectedIds

  const allSelected = products.length > 0 && products.every((p) => selectedIds.has(p.id))
  const someSelected = selectedIds.size > 0 && !allSelected

  useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate = someSelected
    }
  }, [someSelected])

  const sortedProducts = useMemo(() => {
    if (!sortKey) return products
    const dir = sortDir === 'asc' ? 1 : -1
    const next = [...products]
    const valueOf = (p: Product): string => {
      switch (sortKey) {
        case 'product':
          return p.name ?? ''
        case 'sku':
          return p.sku ?? ''
        case 'brand':
          return p.brand?.name ?? ''
        case 'category':
          return p.category?.name ?? ''
        case 'updatedAt':
          return p.updatedAt ?? ''
        default:
          return ''
      }
    }
    next.sort((a, b) => valueOf(a).localeCompare(valueOf(b), 'es') * dir)
    return next
  }, [products, sortKey, sortDir])

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const sortIndicator = (key: SortKey) => {
    if (sortKey !== key) {
      return <span className="text-neutral-300 text-[10px]">⇅</span>
    }
    return sortDir === 'asc' ? (
      <span className="text-security-600 text-[10px]" aria-hidden>▲</span>
    ) : (
      <span className="text-security-600 text-[10px]" aria-hidden>▼</span>
    )
  }

  const headerButtonClass =
    'flex items-center gap-1.5 font-semibold uppercase tracking-wide hover:text-security-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-security-500/40 focus-visible:rounded'

  const handleToggleRow = (id: string) => {
    if (onToggleSelectProduct) {
      onToggleSelectProduct(id)
    } else {
      setInternalSelectedIds((prev) => {
        const next = new Set(prev)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        return next
      })
    }
  }

  const handleToggleAll = () => {
    if (onToggleSelectAllProducts) {
      onToggleSelectAllProducts()
    } else {
      setInternalSelectedIds((prev) => {
        const next = new Set(prev)
        if (allSelected) {
          products.forEach((p) => next.delete(p.id))
        } else {
          products.forEach((p) => next.add(p.id))
        }
        return next
      })
    }
  }

  const visiblePriceColumns = getVisiblePriceColumns(products)
  const priceColCount = visiblePriceColumns.length
  const TOTAL_COLS = 5 + priceColCount + 4
  const widthStyle = baseWidthStyle

  return (
    <div className="overflow-auto">
      <table className="min-w-max border-separate border-spacing-0 text-sm">
        <thead>
          <tr>
            <th
              scope="col"
              style={widthStyle(COLUMN_WIDTHS.select)}
              className={`${thBase} z-40 px-0`}
            >
              <input
                ref={headerCheckboxRef}
                type="checkbox"
                checked={allSelected}
                onChange={handleToggleAll}
                aria-label="Seleccionar todos los productos de la página"
                className="h-4 w-4 accent-security-500 cursor-pointer"
              />
            </th>
            <th
              scope="col"
              style={widthStyle(COLUMN_WIDTHS.sku)}
              aria-sort={sortKey === 'sku' ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined}
              className={thBase}
            >
              <button onClick={() => handleSort('sku')} className={headerButtonClass}>
                SKU
                {sortIndicator('sku')}
              </button>
            </th>
            <th
              scope="col"
              style={widthStyle(COLUMN_WIDTHS.product)}
              aria-sort={sortKey === 'product' ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined}
              className={`${thBase} sticky left-0 z-40`}
            >
              <button onClick={() => handleSort('product')} className={headerButtonClass}>
                Producto
                {sortIndicator('product')}
              </button>
            </th>
            <th
              scope="col"
              style={widthStyle(COLUMN_WIDTHS.brand)}
              aria-sort={sortKey === 'brand' ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined}
              className={thBase}
            >
              <button onClick={() => handleSort('brand')} className={headerButtonClass}>
                Marca
                {sortIndicator('brand')}
              </button>
            </th>
            <th
              scope="col"
              style={widthStyle(COLUMN_WIDTHS.category)}
              aria-sort={sortKey === 'category' ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined}
              className={thBase}
            >
              <button onClick={() => handleSort('category')} className={headerButtonClass}>
                Categoría
                {sortIndicator('category')}
              </button>
            </th>
            {visiblePriceColumns.map((spec) => (
              <th
                key={spec.key}
                scope="col"
                style={widthStyle(COLUMN_WIDTHS.price)}
                className={`${thBase} text-right`}
              >
                {spec.label}
              </th>
            ))}
            <th scope="col" style={widthStyle(COLUMN_WIDTHS.lifecycle)} className={`${thBase} text-center`}>
              Ciclo de vida
            </th>
            <th
              scope="col"
              style={widthStyle(COLUMN_WIDTHS.updated)}
              aria-sort={sortKey === 'updatedAt' ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined}
              className={thBase}
            >
              <button onClick={() => handleSort('updatedAt')} className={headerButtonClass}>
                Actualizado
                {sortIndicator('updatedAt')}
              </button>
            </th>
            <th scope="col" style={widthStyle(COLUMN_WIDTHS.indicators)} className={thBase}>
              Indicadores
            </th>
            <th scope="col" style={widthStyle(COLUMN_WIDTHS.actions)} className={`${thBase} text-center`}>
              Acciones
            </th>
          </tr>
        </thead>
        <tbody>
          {isLoading
            ? Array.from({ length: 6 }).map((_, rowIndex) => (
                <tr key={rowIndex} className="animate-pulse">
                  {Array.from({ length: TOTAL_COLS }).map((_, colIndex) => (
                    <td key={colIndex} className={`${cellBase} px-3 py-4 ${colIndex === 2 ? 'sticky left-0 z-10 bg-white' : ''}`}>
                      <div className="h-3 bg-gray-100 rounded w-20"></div>
                    </td>
                  ))}
                </tr>
              ))
            : sortedProducts.length === 0 && (
                <tr>
                  <td colSpan={TOTAL_COLS} className="px-6 py-12 text-center text-gray-400">
                    No hay productos
                  </td>
                </tr>
              )}
          {!isLoading &&
            sortedProducts.map((product) => {
              const selected = selectedIds.has(product.id)
              const prices = resolvePriceColumns(product)

              return (
                <tr
                  key={product.id}
                  onClick={canWrite ? () => onEdit(product) : undefined}
                  className={`group/row transition-colors ${
                    selected ? 'bg-security-50/60' : ''
                  } ${canWrite ? 'cursor-pointer hover:bg-gray-50' : ''}`}
                >
                  <td
                    style={widthStyle(COLUMN_WIDTHS.select)}
                    className={`${cellBase} px-2 py-3 text-center`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => handleToggleRow(product.id)}
                      aria-label={`Seleccionar ${product.name}`}
                      className="h-4 w-4 accent-security-500 cursor-pointer"
                    />
                  </td>
                  <td style={widthStyle(COLUMN_WIDTHS.sku)} className={`${cellBase} px-3 py-3`}>
                    <span className="text-xs text-gray-500 font-mono truncate block">{product.sku}</span>
                  </td>
                  <td
                    style={widthStyle(COLUMN_WIDTHS.product)}
                    className={`${cellBase} sticky left-0 z-10 px-3 py-3 ${
                      selected ? 'bg-security-50/60' : 'bg-white group-hover/row:bg-gray-50'
                    }`}
                  >
                    <div
                      role={canWrite ? 'button' : undefined}
                      tabIndex={canWrite ? 0 : undefined}
                      aria-label={canWrite ? `Editar ${product.name}` : undefined}
                      title={product.name}
                      onKeyDown={(e) => {
                        if (!canWrite) return
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          e.stopPropagation()
                          onEdit(product)
                        }
                      }}
                      className={`flex items-start gap-3 ${
                        canWrite
                          ? 'focus:outline-none focus-visible:ring-2 focus-visible:ring-security-500/40 focus-visible:rounded cursor-pointer'
                          : ''
                      }`}
                    >
                      <div className="w-8 h-8 rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center flex-shrink-0">
                        {product.images[0]?.url ? (
                          <img src={product.images[0].url} alt="" className="w-8 h-8 object-cover" />
                        ) : (
                          <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                          </svg>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 line-clamp-2 break-words">
                          {product.name}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td style={widthStyle(COLUMN_WIDTHS.brand)} className={`${cellBase} px-3 py-3`}>
                    <span className="text-sm text-gray-600">{product.brand?.name}</span>
                  </td>
                  <td style={widthStyle(COLUMN_WIDTHS.category)} className={`${cellBase} px-3 py-3`}>
                    <span className="text-sm text-gray-600">{product.category?.name}</span>
                  </td>
                  {visiblePriceColumns.map((spec) => (
                    <td key={spec.key} style={widthStyle(COLUMN_WIDTHS.price)} className={`${cellBase} px-3 py-3`}>
                      <div className="flex justify-end">
                        <PriceCellValue price={prices[spec.key]} />
                      </div>
                    </td>
                  ))}
                  <td
                    style={widthStyle(COLUMN_WIDTHS.lifecycle)}
                    className={`${cellBase} px-2 py-3 text-center`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ProductStatusBadge
                      label={LIFECYCLE_STATUS_LABEL[effectiveLifecycleStatus(product)]}
                      className={`px-2 py-1 text-xs font-medium rounded whitespace-nowrap ${
                        effectiveLifecycleStatus(product) === 'PUBLISHED'
                          ? 'bg-emerald-100 text-emerald-700'
                          : effectiveLifecycleStatus(product) === 'ARCHIVED'
                            ? 'bg-gray-100 text-gray-600'
                            : 'bg-amber-100 text-amber-700'
                      }`}
                    />
                  </td>
                  <td style={widthStyle(COLUMN_WIDTHS.updated)} className={`${cellBase} px-3 py-3`}>
                    <span className="text-sm text-gray-600 tabular-nums">{formatDate(product.updatedAt)}</span>
                  </td>
                  <td style={widthStyle(COLUMN_WIDTHS.indicators)} className={`${cellBase} px-3 py-3`}>
                    <ProductIndicators
                      product={product}
                      restricted={accessRestrictedIds?.has(product.id)}
                      accessUnavailable={accessUnavailable}
                    />
                  </td>
                  <td
                    style={widthStyle(COLUMN_WIDTHS.actions)}
                    className={`${cellBase} px-2 py-3`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-center gap-1">
                      {canWrite && onMoveCategory && (
                        <button
                          onClick={() => onMoveCategory(product)}
                          className="p-2 text-gray-400 hover:text-security-600 hover:bg-security-50 rounded-lg transition-colors"
                          title="Mover de categoría"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                          </svg>
                        </button>
                      )}
                      {(canWrite || hasPermission('users:manage')) && onAccess && (
                        <button
                          onClick={() => onAccess(product)}
                          className="p-2 text-gray-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors"
                          title="Asignar accesos"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          </svg>
                        </button>
                      )}
                      {canWrite && (
                        <button
                          onClick={() => onEdit(product)}
                          className="p-2 text-gray-400 hover:text-security-600 hover:bg-security-50 rounded-lg transition-colors"
                          title="Editar"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                      )}
                      {canDelete && (
                        <button
                          onClick={() => {
                            if (window.confirm('¿Eliminar este producto?')) {
                              onDelete(product.id)
                            }
                          }}
                          className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title="Eliminar"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
        </tbody>
      </table>
    </div>
  )
}
