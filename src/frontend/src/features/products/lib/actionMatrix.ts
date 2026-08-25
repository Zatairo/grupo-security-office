import type { Product } from '../types/product.types'

/**
 * @deprecated Usar `lifecycle.ts` → `productAllowedActions` / `getProductActions`.
 * Fuente de verdad: backend `allowedActions` + FSM `LifecycleEvent`.
 * Este archivo se mantiene solo por consumidores legacy no migrados.
 *
 * Matriz única de acciones válidas por estado efectivo del producto (legacy).
 * Fuente de verdad para BULK (ProductsPage), FILA (ProductTableRow),
 * TARJETA (ProductCard) y DETALLE (ProductDetailPage).
 *
 * El "estado efectivo" se deriva de los campos reales del modelo frontend:
 *  - `isActive: boolean`
 *  - `isVisible: boolean`
 *  - `publishStatus?: 'borrador' | 'listo' | 'programado' | 'publicado' | 'archivado' | null`
 *    (el backend usa 'borrador' | 'listo' | 'publicado' | 'archivado'; 'programado'
 *     es un alias legacy de 'listo' + publishAt futuro; null/undefined se trata
 *     como 'borrador').
 */

// ------------------------------ Tipos ------------------------------

/** Set UNIFICADO final de acciones sobre un producto. */
export type ActionKind =
  | 'activate'
  | 'deactivate'
  | 'show'
  | 'hide'
  | 'archive'
  | 'restore'
  | 'publish'
  | 'unpublish'
  | 'schedule'
  | 'delete'
  | 'moveCategory'
  | 'edit'

/** Subset usado por las bulk actions (mismo set de siempre, sin romper labels). */
export type BulkActionKind = Exclude<
  ActionKind,
  'edit' | 'delete' | 'moveCategory' | 'schedule'
>

/** Estado efectivo normalizado de un producto. */
export type EffectiveState =
  | 'activo_publicado'
  | 'activo_oculto_publicado'
  | 'activo_visible'
  | 'activo_oculto'
  | 'inactivo'
  | 'inactivo_publicado'
  | 'archivado'

// ------------------------------ Matriz ------------------------------

/**
 * Matriz estados → acciones permitidas.
 *
 * | Estado efectivo            | Condición                                                       | Acciones permitidas                                             |
 * |----------------------------|-----------------------------------------------------------------|-----------------------------------------------------------------|
 * | activo_publicado           | activo + visible + 'publicado'                                  | deactivate, hide, unpublish, archive, edit, delete, moveCategory |
 * | activo_oculto_publicado    | activo + oculto + 'publicado'                                   | deactivate, show, unpublish, archive, edit, delete, moveCategory |
 * | activo_visible             | activo + visible + borrador/listo/programado/null               | deactivate, hide, publish, schedule, archive, edit, delete, moveCategory |
 * | activo_oculto              | activo + oculto + borrador/listo/programado/null                | deactivate, show, publish, schedule, archive, edit, delete, moveCategory |
 * | inactivo                   | inactivo (no publicado)                                         | activate, archive, restore, schedule, edit, delete, moveCategory |
 * | inactivo_publicado         | inactivo + 'publicado'                                          | activate, unpublish, restore, archive, edit, delete, moveCategory |
 * | archivado                  | publishStatus === 'archivado'                                   | activate, restore, edit, delete, moveCategory                    |
 *
 * Reglas de negocio reflejadas:
 *  - `show`/`hide` SOLO cuando el producto está ACTIVO.
 *  - `publish` SOLO desde borrador/listo/programado (no publicado, no archivado) y ACTIVO.
 *  - `unpublish` SOLO desde 'publicado' (sin importar actividad).
 *  - `schedule` permitido desde cualquier estado no publicado ni archivado (incl. inactivo).
 *  - `archive` = apagar todo (activo/visible), permitido siempre que no esté ya archivado.
 *  - `restore` = encender todo, permitido siempre que no esté ya activo+visible.
 *  - `delete`, `edit`, `moveCategory` siempre disponibles (se regulan por RBAC aparte).
 */
const ACTION_MATRIX: Record<EffectiveState, ActionKind[]> = {
  activo_publicado: ['deactivate', 'hide', 'unpublish', 'archive', 'edit', 'delete', 'moveCategory'],
  activo_oculto_publicado: ['deactivate', 'show', 'unpublish', 'archive', 'edit', 'delete', 'moveCategory'],
  activo_visible: ['deactivate', 'hide', 'publish', 'schedule', 'archive', 'edit', 'delete', 'moveCategory'],
  activo_oculto: ['deactivate', 'show', 'publish', 'schedule', 'archive', 'edit', 'delete', 'moveCategory'],
  inactivo: ['activate', 'archive', 'restore', 'schedule', 'edit', 'delete', 'moveCategory'],
  inactivo_publicado: ['activate', 'unpublish', 'restore', 'archive', 'edit', 'delete', 'moveCategory'],
  archivado: ['activate', 'restore', 'edit', 'delete', 'moveCategory'],
}

// ------------------------------ Derivación ------------------------------

/** Normaliza publishStatus (null/undefined → 'borrador'; legacy 'programado' → 'listo'). */
function normalizePublishStatus(status: Product['publishStatus']): string {
  if (!status) return 'borrador'
  if (status === 'programado') return 'listo'
  return status
}

/** Deriva el estado efectivo a partir de los campos reales del producto. */
export function deriveEffectiveState(product: Product): EffectiveState {
  const status = normalizePublishStatus(product.publishStatus)

  if (status === 'archivado') return 'archivado'
  if (!product.isActive) {
    return status === 'publicado' ? 'inactivo_publicado' : 'inactivo'
  }
  if (status === 'publicado') {
    return product.isVisible ? 'activo_publicado' : 'activo_oculto_publicado'
  }
  return product.isVisible ? 'activo_visible' : 'activo_oculto'
}

// ------------------------------ API pública ------------------------------

/** Acciones permitidas para un producto dado su estado efectivo. */
export function getAllowedActions(product: Product): ActionKind[] {
  return [...ACTION_MATRIX[deriveEffectiveState(product)]]
}

/**
 * Reemplaza la lógica `appliesTo`: devuelve el subconjunto de productos sobre
 * los que la acción bulk `kind` es VÁLIDA (según la matriz). El caller ya debe
 * pasar los productos seleccionados.
 */
export function canBulkApply(kind: BulkActionKind, products: Product[]): Product[] {
  return products.filter((p) => getAllowedActions(p).includes(kind))
}

/**
 * ¿Puede el producto marcarse como "listo para publicar"?
 * No aplica a 'publicado', 'listo' ni 'archivado' ('archivado' es estado final:
 * la matriz solo permite activate/restore/edit/delete/moveCategory). 'programado'
 * se normaliza a 'listo' y tampoco aplica. Requiere estado definido (null/undefined
 * se trata como 'borrador' en la matriz, pero sin estado no se ofrece la acción).
 */
export function canMarkReady(product: Product): boolean {
  const status = normalizePublishStatus(product.publishStatus)
  return (
    !!product.publishStatus &&
    status !== 'publicado' &&
    status !== 'listo' &&
    status !== 'archivado'
  )
}