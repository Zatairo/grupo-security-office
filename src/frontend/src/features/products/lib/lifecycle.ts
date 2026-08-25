import type { LifecycleEvent, LifecycleStatus, Product } from '../types/product.types'

// ------------------------------ Etiquetas ------------------------------

export const LIFECYCLE_STATUSES: LifecycleStatus[] = [
  'DRAFT',
  'READY',
  'SCHEDULED',
  'PUBLISHED',
  'HIDDEN',
  'DISCONTINUED',
  'ARCHIVED',
]

export const LIFECYCLE_STATUS_LABEL: Record<LifecycleStatus, string> = {
  DRAFT: 'Borrador',
  READY: 'Listo',
  SCHEDULED: 'Programado',
  PUBLISHED: 'Publicado',
  HIDDEN: 'Oculto',
  DISCONTINUED: 'Dado de baja',
  ARCHIVED: 'Archivado',
}

export const LIFECYCLE_EVENT_LABEL: Record<LifecycleEvent, string> = {
  PREPARE: 'Marcar listo',
  SCHEDULE: 'Programar',
  CANCEL_SCHEDULE: 'Cancelar programación',
  PUBLISH: 'Publicar',
  HIDE: 'Ocultar',
  SHOW: 'Mostrar',
  UNPUBLISH: 'Despublicar',
  DISCONTINUE: 'Dar de baja',
  REACTIVATE: 'Reactivar',
  ARCHIVE: 'Archivar',
  RESTORE: 'Restaurar',
  DELETE: 'Eliminar',
}

/** Texto accesible (aria-describedby) cuando el evento no aplica en el estado actual. */
export const LIFECYCLE_EVENT_HINT: Record<LifecycleEvent, string> = {
  PREPARE: 'No aplica: solo desde estado Borrador.',
  SCHEDULE: 'No aplica: requiere permiso de publicación y estado Borrador o Listo.',
  CANCEL_SCHEDULE: 'No aplica: solo desde estado Programado.',
  PUBLISH: 'No aplica: requiere permiso de publicación y cumplir el checklist de publicación.',
  HIDE: 'No aplica: solo desde estado Publicado.',
  SHOW: 'No aplica: solo desde estado Oculto (publicado oculto).',
  UNPUBLISH: 'No aplica: requiere permiso de publicación y un estado Listo, Programado, Publicado u Oculto.',
  DISCONTINUE: 'No aplica: requiere permiso de escritura y motivo.',
  REACTIVATE: 'No aplica: solo desde estado Dado de baja.',
  ARCHIVE: 'No aplica: requiere rol administrador, motivo y confirmación.',
  RESTORE: 'No aplica: requiere rol administrador y confirmación, solo desde Archivado.',
  DELETE: 'No aplica: requiere permiso para eliminar productos.',
}

// ------------------------------ Estado efectivo ------------------------------

/** Estado FSM efectivo con fallback a DRAFT para registros legacy sin backfill. */
export function effectiveLifecycleStatus(
  product: Pick<Product, 'lifecycleStatus'>
): LifecycleStatus {
  const s = product.lifecycleStatus
  if (s && (LIFECYCLE_STATUSES as string[]).includes(s)) return s
  return 'DRAFT'
}

/**
 * Derivación local MÍNIMA de allowedActions por lifecycleStatus + roles.
 * PROVISIONAL: usada solo cuando el item de GET /api/products no trae
 * `allowedActions` (el backend lo incluye en findOne/transition, no en el listado).
 */
export function fallbackAllowedActions(
  status: LifecycleStatus,
  roles: string[]
): LifecycleEvent[] {
  const canWrite = roles.includes('Super Admin') || roles.includes('Admin Comercial')
  const canPublish =
    roles.includes('Super Admin') || roles.includes('Supervisor') || roles.includes('Admin Comercial')
  const canArchive = roles.includes('Super Admin') || roles.includes('Admin Comercial')

  const events: LifecycleEvent[] = []
  const push = (e: LifecycleEvent, ok: boolean) => {
    if (ok) events.push(e)
  }

  switch (status) {
    case 'DRAFT':
      push('PREPARE', canWrite)
      push('SCHEDULE', canPublish)
      push('PUBLISH', canPublish)
      push('DISCONTINUE', canWrite)
      push('ARCHIVE', canArchive)
      break
    case 'READY':
      push('SCHEDULE', canPublish)
      push('PUBLISH', canPublish)
      push('UNPUBLISH', canPublish)
      push('DISCONTINUE', canWrite)
      push('ARCHIVE', canArchive)
      break
    case 'SCHEDULED':
      push('CANCEL_SCHEDULE', canWrite)
      push('PUBLISH', canPublish)
      push('UNPUBLISH', canPublish)
      push('DISCONTINUE', canWrite)
      push('ARCHIVE', canArchive)
      break
    case 'PUBLISHED':
      push('HIDE', canPublish)
      push('UNPUBLISH', canPublish)
      push('DISCONTINUE', canWrite)
      push('ARCHIVE', canArchive)
      break
    case 'HIDDEN':
      push('SHOW', canPublish)
      push('UNPUBLISH', canPublish)
      push('DISCONTINUE', canWrite)
      push('ARCHIVE', canArchive)
      break
    case 'DISCONTINUED':
      push('REACTIVATE', canWrite)
      push('ARCHIVE', canArchive)
      break
    case 'ARCHIVED':
      push('RESTORE', canArchive)
      break
  }
  return events
}

/**
 * Acciones efectivas de un producto: prioriza `allowedActions` del backend
 * (findOne/transition); si no viene, deriva localmente por estado + roles.
 */
export function productAllowedActions(
  product: Product,
  roles: string[]
): LifecycleEvent[] {
  if (Array.isArray(product.allowedActions)) return product.allowedActions
  return fallbackAllowedActions(effectiveLifecycleStatus(product), roles)
}

/**
 * Devuelve un mapa de todas las acciones FSM con su estado habilitado y hint.
 * Útil para renderizar botones con estado disabled + aria-describedby.
 */
export function getProductActions(
  product: Product,
  roles: string[]
): Record<LifecycleEvent, { enabled: boolean; hint: string }> {
  const allowed = productAllowedActions(product, roles)
  const result: Record<LifecycleEvent, { enabled: boolean; hint: string }> = {} as any
  for (const event of [
    'PREPARE',
    'SCHEDULE',
    'CANCEL_SCHEDULE',
    'PUBLISH',
    'HIDE',
    'SHOW',
    'UNPUBLISH',
    'DISCONTINUE',
    'REACTIVATE',
    'ARCHIVE',
    'RESTORE',
    'DELETE',
  ] as LifecycleEvent[]) {
    result[event] = {
      enabled: allowed.includes(event),
      hint: LIFECYCLE_EVENT_HINT[event],
    }
  }
  return result
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

/**
 * Normaliza publishStatus (null/undefined → 'borrador'; legacy 'programado' → 'listo').
 */
export function normalizePublishStatus(status: Product['publishStatus']): string {
  if (!status) return 'borrador'
  if (status === 'programado') return 'listo'
  return status
}