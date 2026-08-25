import { useNavigate } from 'react-router-dom'
import type { Product } from '../types/product.types'
import { productAllowedActions, canMarkReady } from '../lib/lifecycle'
import { ProductStatusBadge } from './ProductStatusBadge'
import { StockBadge, PublishBadge } from './ProductIndicators'
import { hasPermission } from '../../../lib/rbac'
import { formatCurrency } from '../../../lib/format'
import { useAuthStore } from '../../../stores/auth.store'

import type { LifecycleEvent } from '../types/product.types'

interface ProductCardProps {
  product: Product
  onEdit: (product: Product) => void
  onTransition: (id: string, event: LifecycleEvent) => void
  onDelete: (id: string) => void
  onMoveCategory?: (product: Product) => void
  onAccess?: (product: Product) => void
  onMarkReady?: (product: Product) => void
}

export function ProductCard({ product, onEdit, onTransition, onDelete, onMoveCategory, onAccess, onMarkReady }: ProductCardProps) {
  const navigate = useNavigate()
  const userRoles = useAuthStore((s) => s.user?.roles ?? [])
  const allowed = productAllowedActions(product, userRoles)
  const canReactivate = allowed.includes('REACTIVATE')
  const canDiscontinue = allowed.includes('DISCONTINUE')
  const canToggleActive = product.isActive ? canDiscontinue : canReactivate
  const toggleLabel = product.isActive ? 'Inactivo' : 'Activo'
  const toggleEvent = product.isActive ? 'DISCONTINUE' : 'REACTIVATE'

  const handleCardClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button')) return
    navigate(`/commercial/products/${product.id}`)
  }

  return (
    <div
      className="rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow group cursor-pointer"
      onClick={handleCardClick}
    >
      <div className="aspect-square bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center relative">
        {product.images[0]?.url ? (
          <img
            src={product.images[0].url}
            alt={product.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <svg className="w-20 h-20 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
        )}
        {/* Status badges */}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {product.isActive && (
            <ProductStatusBadge
              label="Activo"
              className="px-2 py-0.5 bg-emerald-500 text-white text-[10px] font-semibold rounded"
            />
          )}
          {product.isVisible && (
            <ProductStatusBadge
              label="Visible"
              className="px-2 py-0.5 bg-security-600 text-white text-[10px] font-semibold rounded"
            />
          )}
          <StockBadge product={product} />
          <PublishBadge product={product} />
        </div>
        {/* Actions */}
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-1">
          {hasPermission('products:write') && onMarkReady && canMarkReady(product) && (
            <button
              onClick={() => onMarkReady(product)}
              className="p-2 bg-white rounded-lg shadow hover:bg-amber-50 text-gray-600 hover:text-amber-600 transition-colors"
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
              className="p-2 bg-white rounded-lg shadow hover:bg-gray-50 text-gray-600 hover:text-security-600 transition-colors"
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
              className="p-2 bg-white rounded-lg shadow hover:bg-violet-50 text-gray-600 hover:text-violet-600 transition-colors"
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
              className="p-2 bg-white rounded-lg shadow hover:bg-gray-50 text-gray-600 hover:text-security-600 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
          )}
        </div>
      </div>
      <div className="p-4">
        <p className="text-[10px] font-semibold text-security-600 uppercase">{product.brand?.name}</p>
        <h3 className="text-sm font-medium text-gray-800 mt-1 line-clamp-2 leading-tight min-h-[2.5rem]">{product.name}</h3>
        <p className="text-xs text-gray-400 font-mono mt-1">{product.sku}</p>
        <div className="mt-2">
          {product.prices[0] ? (
            <p className="text-sm font-bold text-security-700">
              {formatCurrency(product.prices[0].value, product.prices[0].currency)}
            </p>
          ) : (
            <span className="inline-block text-[10px] font-semibold bg-amber-100 text-amber-700 px-2 py-0.5 rounded">
              Sin precio
            </span>
          )}
        </div>
        <div className="mt-3 flex items-center gap-2">
          {hasPermission('products:write') && canToggleActive && onTransition && (
            <button
              onClick={() => onTransition(product.id, toggleEvent)}
              className={`flex-1 py-1.5 text-xs font-medium rounded transition-colors ${
                product.isActive
                  ? 'bg-red-50 text-red-700 hover:bg-red-100'
                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
              }`}
            >
              {toggleLabel}
            </button>
          )}
          {hasPermission('products:delete') && (
            <button
              onClick={() => {
                if (confirm('¿Eliminar este producto?')) {
                  onDelete(product.id)
                }
              }}
              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
