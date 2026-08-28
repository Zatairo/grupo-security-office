import type { LifecycleEvent, LifecycleStatus, Product } from '../types/product.types'

// ------------------------------ Etiquetas ------------------------------

export const LIFECYCLE_STATUSES: LifecycleStatus[] = [
  'DRAFT',
  'PUBLISHED',
  'ARCHIVED',
]

export const LIFECYCLE_STATUS_LABEL: Record<LifecycleStatus, string> = {
  DRAFT: 'Borrador',
  PUBLISHED: 'Publicado',
  ARCHIVED: 'Archivado',
}

export const LIFECYCLE_EVENT_LABEL: Record<LifecycleEvent, string> = {
  PUBLISH: 'Publicar',
  UNPUBLISH: 'Despublicar',
  ARCHIVE: 'Archivar',
  RESTORE: 'Restaurar',
}

/** Texto accesible (aria-describedby) cuando el evento no aplica en el estado actual. */
export const LIFECYCLE_EVENT_HINT: Record<LifecycleEvent, string> = {
  PUBLISH: 'No aplica: requiere permiso de publicación y cumplir el checklist de publicación.',
  UNPUBLISH: 'No aplica: requiere permiso de publicación y un estado Publicado.',
  ARCHIVE: 'No aplica: requiere rol administrador, motivo y confirmación.',
  RESTORE: 'No aplica: requiere rol administrador y confirmación, solo desde Archivado.',
}

// ------------------------------ Estado efectivo ------------------------------

/**
 * Estado FSM efectivo con fallback a DRAFT para registros legacy sin backfill.
 * Compatibilidad visual SOLO en lectura: valores legacy (READY/SCHEDULED/HIDDEN
 * -> DRAFT; DISCONTINUED -> ARCHIVED) se normalizan al canónico. Nunca se usa
 * para derivar acciones.
 */
export function effectiveLifecycleStatus(
  product: Pick<Product, 'lifecycleStatus'>
): LifecycleStatus {
  const s = product.lifecycleStatus
  if (s && (LIFECYCLE_STATUSES as string[]).includes(s)) return s as LifecycleStatus
  if (s) {
    const normalized = normalizeLegacyStatus(s)
    if (normalized) return normalized
  }
  return 'DRAFT'
}

/** Normaliza estados legacy (solo lectura visual) al canónico. */
function normalizeLegacyStatus(status: string): LifecycleStatus | null {
  switch (status.toUpperCase()) {
    case 'READY':
    case 'SCHEDULED':
    case 'HIDDEN':
      return 'DRAFT'
    case 'DISCONTINUED':
      return 'ARCHIVED'
    default:
      return null
  }
}

/**
 * Derivación local MÍNIMA de allowedActions por lifecycleStatus + roles.
 * PROVISIONAL: usada solo cuando el item de GET /api/products no trae
 * `allowedActions` (el backend lo incluye en findOne/transition, no en el listado).
 * Devuelve exclusivamente eventos canónicos.
 */
export function fallbackAllowedActions(
  status: LifecycleStatus,
  roles: string[]
): LifecycleEvent[] {
  const canPublish =
    roles.includes('Super Admin') || roles.includes('Supervisor') || roles.includes('Admin Comercial')
  const canArchive = roles.includes('Super Admin') || roles.includes('Admin Comercial')

  const events: LifecycleEvent[] = []
  const push = (e: LifecycleEvent, ok: boolean) => {
    if (ok) events.push(e)
  }

  switch (status) {
    case 'DRAFT':
      push('PUBLISH', canPublish)
      push('ARCHIVE', canArchive)
      break
    case 'PUBLISHED':
      push('UNPUBLISH', canPublish)
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
 * Esta es la única fuente para habilitar acciones de lifecycle en la UI.
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
    'PUBLISH',
    'UNPUBLISH',
    'ARCHIVE',
    'RESTORE',
  ] as LifecycleEvent[]) {
    result[event] = {
      enabled: allowed.includes(event),
      hint: LIFECYCLE_EVENT_HINT[event],
    }
  }
  return result
}

/** Convierte un string ISO (p.ej. de `publishAt`) a valor válido para `<input type="datetime-local">` en hora local. */
export function toDatetimeLocal(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`
}

/** Convierte el valor de `<input type="datetime-local">` (hora local) a string ISO. */
export function fromDatetimeLocal(value: string): string {
  return new Date(value).toISOString()
}

/**
 * Indica si existe una programación de publicación ACTIVA (solo lectura):
 * estado efectivo DRAFT + `publishAt` como string válido estrictamente futuro.
 * No representa `SCHEDULED`: es una condición calculada sobre el contrato canónico.
 */
export function hasActiveScheduling(product: Pick<Product, 'lifecycleStatus' | 'publishAt'>): boolean {
  if (effectiveLifecycleStatus(product) !== 'DRAFT') return false
  if (typeof product.publishAt !== 'string' || !product.publishAt) return false
  const when = new Date(product.publishAt)
  if (Number.isNaN(when.getTime())) return false
  return when.getTime() > Date.now()
}