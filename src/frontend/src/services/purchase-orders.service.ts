import api from './api'

export type PurchaseOrderStatus =
  | 'solicitada'
  | 'aprobada'
  | 'en_transito'
  | 'recibida'
  | 'cerrada'
  | 'cancelada'

export const PURCHASE_ORDER_STATUSES: PurchaseOrderStatus[] = [
  'solicitada',
  'aprobada',
  'en_transito',
  'recibida',
  'cerrada',
  'cancelada',
]

export interface PurchaseOrderItem {
  productId: string
  quantity: number
}

export interface PurchaseOrderSupplier {
  id: string
  name: string
  nit: string | null
}

export interface PurchaseOrder {
  id: string
  code: string
  supplierId: string
  status: PurchaseOrderStatus
  items: unknown
  notes: string | null
  requestedById: string | null
  createdAt: string
  updatedAt: string
  supplier?: PurchaseOrderSupplier
  requestedBy?: { id: string; name: string | null; email: string } | null
}

export interface PurchaseOrderHistoryEntry {
  id: string
  action: string
  oldValues: Record<string, unknown> | null
  newValues: Record<string, unknown> | null
  createdAt: string
  user?: { id: string; name: string | null; email: string } | null
}

export interface PurchaseOrderDetail extends PurchaseOrder {
  history: PurchaseOrderHistoryEntry[]
}

export interface PurchaseOrderPayload {
  supplierId: string
  items?: PurchaseOrderItem[]
  notes?: string
  status?: PurchaseOrderStatus
}

export interface PurchaseOrderDashboard {
  openOrders: number
  ordersByStatus: Record<string, number>
  pendingSupplierEvaluations: {
    count: number
    suppliers: Array<{
      id: string
      name: string
      nit: string | null
      lastEvaluationDate: string | null
    }>
  }
  expiringPrices: number
  lowStock: number
  recentOrders: Array<{
    id: string
    code: string
    status: PurchaseOrderStatus
    supplierId: string
    supplier?: PurchaseOrderSupplier
    createdAt: string
    products: Array<{ id: string; sku: string; name: string }>
  }>
}

function asList(res: unknown): any[] {
  if (Array.isArray(res)) return res
  if (res && typeof res === 'object' && Array.isArray((res as { data?: unknown }).data)) {
    return (res as { data: any[] }).data
  }
  return []
}

function unwrapObject<T>(res: unknown): T {
  if (res && typeof res === 'object' && 'data' in res) {
    return (res as { data: T }).data
  }
  return res as T
}

/** Espejo client-side de parsePoItems del backend (acepta array, objeto o {items}). */
export function parsePoItems(items: unknown): PurchaseOrderItem[] {
  if (!items) return []
  if (Array.isArray(items)) {
    return items
      .filter(
        (i): i is Record<string, unknown> =>
          !!i && typeof i === 'object' && typeof (i as { productId?: unknown }).productId === 'string',
      )
      .map((i) => ({
        productId: i.productId as string,
        quantity: Number((i as { quantity?: unknown; qty?: unknown }).quantity ?? (i as { qty?: unknown }).qty ?? 0),
      }))
  }
  if (typeof items === 'object') {
    const obj = items as Record<string, unknown>
    if (Array.isArray(obj.items)) return parsePoItems(obj.items)
    if (typeof obj.productId === 'string') {
      return [{ productId: obj.productId, quantity: Number(obj.quantity ?? obj.qty ?? 0) }]
    }
  }
  return []
}

export const fetchPurchaseOrders = async (
  params?: { status?: string },
): Promise<PurchaseOrder[]> => {
  const res = await api.get('/purchase-orders', {
    params: params?.status ? { status: params.status } : undefined,
  })
  return asList(res.data) as PurchaseOrder[]
}

export const fetchPurchaseOrder = async (id: string): Promise<PurchaseOrderDetail> => {
  const res = await api.get(`/purchase-orders/${id}`)
  return unwrapObject<PurchaseOrderDetail>(res.data)
}

export const createPurchaseOrder = async (
  payload: PurchaseOrderPayload,
): Promise<PurchaseOrder> => {
  const res = await api.post('/purchase-orders', payload)
  return res.data as PurchaseOrder
}

export const updatePurchaseOrderStatus = async (
  id: string,
  payload: { status: PurchaseOrderStatus; comment?: string },
): Promise<PurchaseOrder> => {
  const res = await api.patch(`/purchase-orders/${id}/status`, payload)
  return res.data as PurchaseOrder
}

export const fetchPurchaseOrderDashboard = async (): Promise<PurchaseOrderDashboard> => {
  const res = await api.get('/purchase-orders/dashboard')
  return unwrapObject<PurchaseOrderDashboard>(res.data)
}