import api from './api'

export interface Lista {
  id: string
  code: string
  name: string
  description: string | null
  currency: string
  isActive: boolean
  archivedAt: string | null
  isExpired?: boolean
  isExpiringSoon?: boolean
  daysUntilExpiry?: number | null
  type?: string | null
  defaultVisibility?: boolean
  responsibleId?: string | null
  validFrom?: string | null
  validUntil?: string | null
  createdAt: string
  updatedAt: string
  productCount?: number
}

export interface ListaPayload {
  name: string
  code: string
  description?: string | null
  currency?: string
  isActive?: boolean
  archivedAt?: string | null
  type?: string | null
  defaultVisibility?: boolean
  responsibleId?: string | null
  validFrom?: string | null
  validUntil?: string | null
}

interface ListaListResponse {
  data: Lista[]
}

export const fetchListas = async (): Promise<Lista[]> => {
  const res = await api.get('/listas')
  const body = res.data as ListaListResponse
  return body.data ?? []
}

export const fetchListaById = async (id: string): Promise<Lista> => {
  const res = await api.get(`/listas/${id}`)
  return res.data as Lista
}

export const createLista = async (payload: ListaPayload): Promise<Lista> => {
  const res = await api.post('/listas', payload)
  return res.data as Lista
}

export const updateLista = async (id: string, payload: Partial<ListaPayload>): Promise<Lista> => {
  const res = await api.patch(`/listas/${id}`, payload)
  return res.data as Lista
}

export const toggleListaActive = async (id: string, isActive: boolean): Promise<Lista> => {
  const res = await api.patch(`/listas/${id}/toggle-active`, { isActive })
  return res.data as Lista
}

export const archiveLista = async (id: string): Promise<Lista> => {
  const res = await api.patch(`/listas/${id}/archive`)
  return res.data as Lista
}

export const restoreLista = async (id: string): Promise<Lista> => {
  const res = await api.patch(`/listas/${id}/restore`)
  return res.data as Lista
}

export const fetchListaProducts = async (id: string): Promise<any[]> => {
  const res = await api.get(`/listas/${id}/products`)
  return (res.data as any)?.data ?? []
}

export const fetchListaPrices = async (id: string): Promise<any[]> => {
  const res = await api.get(`/listas/${id}/prices`)
  return (res.data as any)?.data ?? []
}

export const fetchListaAssignments = async (id: string): Promise<any[]> => {
  const res = await api.get(`/listas/${id}/assignments`)
  return (res.data as any)?.data ?? []
}

export const fetchListaAudit = async (id: string): Promise<any[]> => {
  const res = await api.get(`/listas/${id}/audit`)
  return (res.data as any)?.data ?? []
}

export function productCountOf(lista: Lista | undefined | null): number {
  if (!lista) return 0
  return lista.productCount ?? 0
}

/** Headers estándar del import de productos (coinciden con los sinónimos de header-detection). */
export const LISTA_TEMPLATE_HEADERS = [
  'SKU',
  'Nombre',
  'Descripción',
  'Categoría',
  'Marca',
  'Especificaciones Técnicas',
  'Precio Instalador (IVA)',
  'Precio Tienda (IVA)',
  'Precio DPP Oro (IVA)',
  'Precio DPP Platino (IVA)',
  'Precio Cliente Final (IVA)',
  'Oro sin IVA',
  'Installer sin IVA',
] as const

const LISTA_TEMPLATE_EXAMPLE_ROW = [
  'SKU-EJEMPLO',
  'Producto de ejemplo',
  '',
  'Categoría ejemplo',
  'Marca ejemplo',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
]

function csvCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

function sanitizeFileName(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '-')
}

export function buildListaTemplateCsv(): string {
  return [LISTA_TEMPLATE_HEADERS, LISTA_TEMPLATE_EXAMPLE_ROW]
    .map((row) => row.map(csvCell).join(','))
    .join('\n')
}

/** Genera y descarga la plantilla estándar de productos como CSV (con BOM para Excel). */
export function downloadListaTemplateCsv(fileName: string): void {
  const blob = new Blob(['\uFEFF' + buildListaTemplateCsv()], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = sanitizeFileName(fileName)
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
