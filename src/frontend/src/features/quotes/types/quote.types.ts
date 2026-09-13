// Tipos alineados con el contrato real del backend
// (src/backend/src/modules/commercial/quotes/).
// IMPORTANTE: los montos (`Decimal`) llegan serializados como string.
// El frontend NUNCA calcula montos: muestra los valores que devuelve el backend.

export const QUOTE_STATUSES = [
  'borrador',
  'enviada',
  'negociacion',
  'ganada',
  'perdida',
  'cancelada',
] as const

export type QuoteStatus = (typeof QUOTE_STATUSES)[number]

/** Estado efectivo que puede devolver el backend al leer (vencida es derivado, no persistido). */
export type QuoteDisplayStatus = QuoteStatus | 'vencida'

export const QUOTE_STATUS_LABELS: Record<QuoteDisplayStatus, string> = {
  borrador: 'Borrador',
  enviada: 'Enviada',
  negociacion: 'En negociación',
  ganada: 'Ganada',
  perdida: 'Perdida',
  cancelada: 'Cancelada',
  vencida: 'Vencida',
}

/** Matriz de transiciones válidas (idéntica a QUOTE_TRANSITIONS de quotes.service.ts). */
export const QUOTE_TRANSITIONS: Record<QuoteStatus, QuoteStatus[]> = {
  borrador: ['enviada', 'cancelada'],
  enviada: ['negociacion', 'ganada', 'perdida', 'cancelada'],
  negociacion: ['ganada', 'perdida', 'cancelada'],
  ganada: [],
  perdida: [],
  cancelada: [],
}

export const QUOTE_DESTINATION_LABELS: Record<QuoteStatus, string> = {
  borrador: 'Volver a borrador',
  enviada: 'Marcar como enviada',
  negociacion: 'Mover a negociación',
  ganada: 'Marcar como ganada',
  perdida: 'Marcar como perdida',
  cancelada: 'Cancelar',
}

/** Único estado que exige `lostReason` en el backend. */
export const QUOTE_STATUS_REQUIRES_REASON: QuoteStatus[] = ['perdida']

/**
 * `ganada` la puede marcar cualquier rol de escritura salvo Operador
 * (el backend exige Super Admin / Admin Comercial / Supervisor).
 */
export const QUOTE_GANADA_ROLES: string[] = [
  'Super Admin',
  'Admin Comercial',
  'Supervisor',
]

/** Ítems editables solo en estos estados persistidos. */
export const QUOTE_ITEM_EDITABLE_STATUSES: QuoteStatus[] = [
  'borrador',
  'enviada',
  'negociacion',
]

export function getValidTransitions(status: QuoteDisplayStatus): QuoteStatus[] {
  if (status === 'vencida') return [] // estado derivado: no se puede transicionar
  return QUOTE_TRANSITIONS[status] ?? []
}

export function itemsEditable(status: QuoteDisplayStatus): boolean {
  return (QUOTE_ITEM_EDITABLE_STATUSES as string[]).includes(status)
}

/**
 * Monto serializado por el backend. Prisma `Decimal` serializa como string
 * en el JSON real; los tests usan números. Aceptar ambos.
 */
export type MoneyValue = string | number | null | undefined

export interface QuoteItem {
  id: string
  quoteId: string
  position: number
  productId: string | null
  priceId: string | null
  sku: string
  name: string
  listaId: string | null
  priceListId: string | null
  unitPrice: MoneyValue
  currency: string
  quantity: number
  discountPct: MoneyValue
  lineTotal: MoneyValue
  priceCapturedAt: string
}

export interface QuoteCustomerRef {
  id: string
  code: string
  name: string
  status: string
}

export interface QuoteCatalogRef {
  id: string
  code: string
  name: string
  currency: string
}

export interface QuoteOwnerRef {
  id: string
  name: string
  email: string
}

export interface Quote {
  id: string
  code: string
  customerId: string
  ownerId: string
  listaId: string
  priceListId: string | null
  status: QuoteDisplayStatus
  currency: string
  subtotal: MoneyValue
  discount: MoneyValue
  taxRate: MoneyValue
  taxAmount: MoneyValue
  total: MoneyValue
  validUntil: string | null
  issuedAt: string | null
  closedAt: string | null
  lostReason: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
  items?: QuoteItem[]
  _count?: { items: number }
  customer?: QuoteCustomerRef
  lista?: QuoteCatalogRef | null
  priceList?: QuoteCatalogRef | null
  owner?: QuoteOwnerRef
}

export interface QuoteFilters {
  search?: string
  status?: QuoteStatus
  customerId?: string
  ownerId?: string
}

export interface QuoteListMeta {
  total: number
  skip: number
  take: number
  totalPages: number
}

export interface QuoteListResponse {
  data: Quote[]
  meta: QuoteListMeta | null
}

export interface CreateQuotePayload {
  customerId: string
  listaId: string
  priceListId?: string
  validUntil?: string
  taxRate?: string
  notes?: string
}

export interface AddQuoteItemPayload {
  productId: string
  quantity: number
  discountPct?: string
}

export interface UpdateQuoteItemPayload {
  quantity?: number
  discountPct?: string
}

export interface UpdateQuoteStatusPayload {
  status: QuoteStatus
  lostReason?: string
}
