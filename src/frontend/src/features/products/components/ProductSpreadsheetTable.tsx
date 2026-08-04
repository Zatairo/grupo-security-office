import { useMemo, useState } from 'react'
import type { Product, ProductPrice } from '../types/product.types'
import { ProductStatusBadge } from './ProductStatusBadge'
import { usePriceLists } from '../hooks/usePriceLists'
import { hasPermission } from '../../../lib/rbac'
import { formatCurrency } from '../../../lib/format'

type SortDir = 'asc' | 'desc'
type SortKey = 'product' | 'category' | 'brand' | 'status' | `price:${string}`
type PriceGroup = 'Con IVA' | 'Sin IVA' | 'Precios'

interface PriceColumn {
  id: string
  name: string
  code: string
  currency: string
}

interface ProductSpreadsheetTableProps {
  products?: Product[]
  isLoading?: boolean
  onEdit: (product: Product) => void
  onToggleActive: (id: string) => void
  onToggleVisibility: (id: string) => void
  onDelete: (id: string) => void
}

const GROUP_RANK: Record<PriceGroup, number> = { 'Con IVA': 0, 'Sin IVA': 1, Precios: 2 }

function groupOf(list: Pick<PriceColumn, 'name' | 'code'>): PriceGroup {
  const text = `${list.name} ${list.code}`.toLowerCase()
  if (text.includes('sin iva') || text.includes('sin_iva') || text.includes('without_iva')) {
    return 'Sin IVA'
  }
  if (text.includes('iva')) {
    return 'Con IVA'
  }
  return 'Precios'
}

function priceOf(product: Product, listId: string): ProductPrice | undefined {
  return product.prices?.find((p) => p.priceList.id === listId)
}

// El wire serializa Decimal de Prisma como string (ej. "179838.75", "0"); el tipo
// declara `number`. Esta normalización única garantiza comportamiento idéntico con
// string (wire) y number (local), y evita coerción implícita en display y sort.
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

const cellBase = 'border-r border-b border-neutral-100'
const thBase = `${cellBase} px-4 py-3 text-left text-xs text-gray-600 whitespace-nowrap bg-gray-50`
const thSticky = `${cellBase} px-4 py-3 text-left text-xs text-gray-600 whitespace-nowrap bg-gray-50 sticky left-0 z-20 min-w-[11rem]`

export function ProductSpreadsheetTable({
  products = [],
  isLoading = false,
  onEdit,
  onToggleActive,
  onToggleVisibility,
  onDelete,
}: ProductSpreadsheetTableProps) {
  const [sortKey, setSortKey] = useState<SortKey | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const { priceLists } = usePriceLists()

  const columns: PriceColumn[] = useMemo(() => {
    const map = new Map<string, PriceColumn>()
    priceLists.forEach((list) =>
      map.set(list.id, { id: list.id, name: list.name, code: list.code, currency: list.currency })
    )
    products.forEach((p) =>
      p.prices?.forEach((pr) => {
        if (!map.has(pr.priceList.id)) {
          map.set(pr.priceList.id, {
            id: pr.priceList.id,
            name: pr.priceList.name,
            code: pr.priceList.code,
            currency: pr.currency,
          })
        }
      })
    )
    return Array.from(map.values()).sort(
      (a, b) => GROUP_RANK[groupOf(a)] - GROUP_RANK[groupOf(b)]
    )
  }, [priceLists, products])

  const groups = useMemo(() => {
    const result: { group: PriceGroup; lists: PriceColumn[] }[] = []
    columns.forEach((list) => {
      const group = groupOf(list)
      const last = result[result.length - 1]
      if (last && last.group === group) {
        last.lists.push(list)
      } else {
        result.push({ group, lists: [list] })
      }
    })
    return result
  }, [columns])

  const totalCols = 4 + columns.length + 1

  const sortedProducts = useMemo(() => {
    if (!sortKey) return products
    const dir = sortDir === 'asc' ? 1 : -1
    const next = [...products]
    if (sortKey.startsWith('price:')) {
      const listId = sortKey.slice('price:'.length)
      next.sort((a, b) => {
        const va = numericValue(priceOf(a, listId))
        const vb = numericValue(priceOf(b, listId))
        if (va === undefined && vb === undefined) return 0
        if (va === undefined) return 1
        if (vb === undefined) return -1
        return (va - vb) * dir
      })
      return next
    }
    const valueOf = (p: Product): string => {
      switch (sortKey) {
        case 'product':
          return p.name ?? ''
        case 'category':
          return p.category?.name ?? ''
        case 'brand':
          return p.brand?.name ?? ''
        case 'status':
          return `${p.isActive ? 'Activo' : 'Inactivo'} ${p.isVisible ? 'Visible' : 'Oculto'}`
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

  return (
    <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-max border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              <th rowSpan={2} scope="col" aria-sort={sortKey === 'product' ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined} className={thSticky}>
                <button onClick={() => handleSort('product')} className={headerButtonClass}>
                  Producto
                  {sortIndicator('product')}
                </button>
              </th>
              <th rowSpan={2} scope="col" className={thBase}>
                <button onClick={() => handleSort('category')} className={headerButtonClass}>
                  Categoría
                  {sortIndicator('category')}
                </button>
              </th>
              <th rowSpan={2} scope="col" className={thBase}>
                <button onClick={() => handleSort('brand')} className={headerButtonClass}>
                  Marca
                  {sortIndicator('brand')}
                </button>
              </th>
              <th rowSpan={2} scope="col" className={thBase}>
                <button onClick={() => handleSort('status')} className={headerButtonClass}>
                  Estado
                  {sortIndicator('status')}
                </button>
              </th>
              {groups.map(({ group, lists }) => (
                <th
                  key={group}
                  scope="colgroup"
                  colSpan={lists.length}
                  className={`${cellBase} px-4 py-2.5 text-center text-[10px] font-bold uppercase tracking-widest text-security-700 bg-gray-100`}
                >
                  {group}
                </th>
              ))}
              <th rowSpan={2} scope="col" className={`border-b border-neutral-100 px-4 py-3 text-left text-xs text-gray-600 whitespace-nowrap bg-gray-50`}>
                Acciones
              </th>
            </tr>
            <tr>
              {groups.flatMap(({ lists }) =>
                lists.map((list) => {
                  const key: SortKey = `price:${list.id}`
                  return (
                    <th
                      key={list.id}
                      scope="col"
                      aria-sort={sortKey === key ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined}
                      className={thBase}
                    >
                      <button onClick={() => handleSort(key)} className={headerButtonClass} title={`Ordenar por ${list.name}`}>
                        {list.name}
                        {sortIndicator(key)}
                      </button>
                    </th>
                  )
                })
              )}
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? Array.from({ length: 6 }).map((_, rowIndex) => (
                  <tr key={rowIndex} className="animate-pulse">
                    {Array.from({ length: totalCols }).map((_, colIndex) => (
                      <td
                        key={colIndex}
                        className={`${cellBase} px-4 py-4 ${colIndex === 0 ? 'sticky left-0 z-10 bg-white' : ''}`}
                      >
                        <div className="h-3 bg-gray-100 rounded w-20"></div>
                      </td>
                    ))}
                  </tr>
                ))
              : sortedProducts.length === 0 && (
                  <tr>
                    <td colSpan={totalCols} className="px-6 py-12 text-center text-gray-400">
                      No hay productos
                    </td>
                  </tr>
                )}
            {!isLoading &&
              sortedProducts.map((product) => {
                const activeClass = product.isActive
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-red-100 text-red-700'
                const visibleClass = product.isVisible
                  ? 'bg-security-100 text-security-700'
                  : 'bg-gray-100 text-gray-600'
                return (
                  <tr key={product.id} className="group/row transition-colors hover:bg-gray-50">
                    <td className="sticky left-0 z-10 bg-white group-hover/row:bg-gray-50 min-w-[11rem] px-4 py-3 border-r border-b border-neutral-100">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center flex-shrink-0">
                          {product.images[0]?.url ? (
                            <img src={product.images[0].url} alt={product.name} className="w-9 h-9 object-cover" />
                          ) : (
                            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                            </svg>
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{product.name}</p>
                          <p className="text-xs text-gray-400 font-mono">{product.sku}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 border-r border-b border-neutral-100 min-w-[10rem]">
                      {product.category?.name}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 border-r border-b border-neutral-100 min-w-[10rem]">
                      {product.brand?.name}
                    </td>
                    <td className="px-4 py-3 border-r border-b border-neutral-100 min-w-[10rem]">
                      <div className="flex items-center gap-2">
                        <ProductStatusBadge
                          label={product.isActive ? 'Activo' : 'Inactivo'}
                          className={`px-2 py-1 text-xs font-medium rounded ${activeClass}`}
                          onClick={() => onToggleActive(product.id)}
                        />
                        <ProductStatusBadge
                          label={product.isVisible ? 'Visible' : 'Oculto'}
                          className={`px-2 py-1 text-xs font-medium rounded ${visibleClass}`}
                          onClick={() => onToggleVisibility(product.id)}
                        />
                      </div>
                    </td>
                    {columns.map((list) => {
                      const price = priceOf(product, list.id)
                      return (
                        <td key={list.id} className="border-r border-b border-neutral-100 p-0 align-middle min-w-[11rem]">
                          {hasPermission('products:write') ? (
                            <button
                              onClick={() => onEdit(product)}
                              title={`Editar precio en ${list.name}`}
                              aria-label={`Editar precio en ${list.name} de ${product.name}`}
                              className="relative flex w-full items-center justify-end gap-1.5 px-3 py-3 hover:bg-security-50 focus:outline-none focus-visible:z-20 focus-visible:ring-2 focus-visible:ring-security-500/40"
                            >
                              <PriceCellValue price={price} />
                            </button>
                          ) : (
                            <div className="px-3 py-3 flex justify-end">
                              <PriceCellValue price={price} />
                            </div>
                          )}
                        </td>
                      )
                    })}
                    <td className="px-4 py-3 border-b border-neutral-100">
                      <div className="flex items-center gap-1 justify-end">
                        {hasPermission('products:write') && (
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
                        {hasPermission('products:delete') && (
                          <button
                            onClick={() => {
                              if (confirm('¿Eliminar este producto?')) {
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
    </div>
  )
}
