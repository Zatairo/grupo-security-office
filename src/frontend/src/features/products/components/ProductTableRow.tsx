import type { Product } from '../types/product.types'
import { ProductStatusBadge } from './ProductStatusBadge'
import { ProductIndicators } from './ProductIndicators'
import { hasPermission } from '../../../lib/rbac'
import { formatCurrency } from '../../../lib/format'

interface ProductTableRowProps {
  product: Product
  onEdit: (product: Product) => void
  onToggleActive: (id: string) => void
  onToggleVisibility: (id: string) => void
  onDelete: (id: string) => void
  selected?: boolean
  onToggleSelect?: (id: string) => void
  accessRestrictedIds?: Set<string>
  accessUnavailable?: boolean
}

export function ProductTableRow({
  product,
  onEdit,
  onToggleActive,
  onToggleVisibility,
  onDelete,
  selected = false,
  onToggleSelect,
  accessRestrictedIds,
  accessUnavailable,
}: ProductTableRowProps) {
  return (
    <tr className="hover:bg-gray-50 transition-colors">
      {onToggleSelect && (
        <td className="px-6 py-4">
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggleSelect(product.id)}
            aria-label={`Seleccionar ${product.name}`}
            className="h-4 w-4 accent-security-500 cursor-pointer"
          />
        </td>
      )}
      <td className="px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center flex-shrink-0">
            {product.images[0]?.url ? (
              <img src={product.images[0].url} alt={product.name} className="w-10 h-10 object-cover" />
            ) : (
              <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
      <td className="px-6 py-4">
        {product.prices[0] ? (
          <span className="text-sm font-semibold text-gray-900">
            {formatCurrency(product.prices[0].value, product.prices[0].currency)}
          </span>
        ) : (
          <span className="text-xs text-amber-600 font-medium">Sin precio</span>
        )}
      </td>
      <td className="px-6 py-4 text-sm text-gray-600">{product.category?.name}</td>
      <td className="px-6 py-4 text-sm text-gray-600">{product.brand?.name}</td>
      <td className="px-6 py-4">
        <div className="flex items-center gap-2">
          <ProductStatusBadge
            label={product.isActive ? 'Activo' : 'Inactivo'}
            className={`px-2 py-1 text-xs font-medium rounded ${
              product.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
            }`}
            onClick={() => onToggleActive(product.id)}
          />
          <ProductStatusBadge
            label={product.isVisible ? 'Visible' : 'Oculto'}
            className={`px-2 py-1 text-xs font-medium rounded ${
              product.isVisible ? 'bg-security-100 text-security-700' : 'bg-gray-100 text-gray-600'
            }`}
            onClick={() => onToggleVisibility(product.id)}
          />
        </div>
        <div className="flex items-center gap-1 mt-1.5">
          <ProductIndicators
            product={product}
            restricted={accessRestrictedIds?.has(product.id)}
            accessUnavailable={accessUnavailable}
          />
        </div>
      </td>
      <td className="px-6 py-4">
        <div className="flex items-center gap-1">
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
}
