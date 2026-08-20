import type { Product } from '../types/product.types'
import { getAllowedActions, canMarkReady } from '../lib/actionMatrix'
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
  onMoveCategory?: (product: Product) => void
  onAccess?: (product: Product) => void
  onMarkReady?: (product: Product) => void
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
  onMoveCategory,
  onAccess,
  onMarkReady,
}: ProductTableRowProps) {
  const allowed = getAllowedActions(product)
  const canToggleActive = product.isActive ? allowed.includes('deactivate') : allowed.includes('activate')
  const canToggleVisibility = product.isVisible ? allowed.includes('hide') : allowed.includes('show')

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
            onClick={canToggleActive ? () => onToggleActive(product.id) : undefined}
          />
          <ProductStatusBadge
            label={product.isVisible ? 'Visible' : 'Oculto'}
            className={`px-2 py-1 text-xs font-medium rounded ${
              product.isVisible ? 'bg-security-100 text-security-700' : 'bg-gray-100 text-gray-600'
            }`}
            onClick={canToggleVisibility ? () => onToggleVisibility(product.id) : undefined}
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
          {hasPermission('products:write') && onMarkReady && canMarkReady(product) && (
            <button
              onClick={() => onMarkReady(product)}
              className="p-2 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
              title="Marcar listo para publicar"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
          )}
          {hasPermission('products:write') && onMoveCategory && (
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
          {(hasPermission('users:manage') || hasPermission('products:write')) && onAccess && (
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
