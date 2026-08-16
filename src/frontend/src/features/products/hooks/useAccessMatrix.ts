import { useQuery } from '@tanstack/react-query'
import api from '../../../services/api'
import { isNotImplemented } from '../../../services/product-detail.service'

interface MatrixEntry {
  resourceType: string
  resourceId: string
  resourceName: string
  asignaciones: { level: string; isActive: boolean }[]
  viewer?: { userId: string; acciones: string[] }
}

function asMatrixEntries(data: unknown): MatrixEntry[] {
  if (Array.isArray(data)) return data as MatrixEntry[]
  if (data && typeof data === 'object' && Array.isArray((data as { data?: unknown }).data)) {
    return (data as { data: MatrixEntry[] }).data
  }
  return []
}

export function useAccessMatrix(entity: string, enabled = true) {
  const query = useQuery({
    queryKey: ['access-matrix', entity],
    queryFn: async () => {
      const res = await api.get(`/assignments/matrix?entity=${entity}`)
      return asMatrixEntries(res.data)
    },
    enabled,
    retry: 1,
    staleTime: 5 * 60 * 1000,
  })

  const unavailable = query.isError
    ? isNotImplemented(query.error) || (query.error as { response?: { status?: number } })?.response?.status === 403
    : false

  const restrictedIds = new Set<string>()
  if (query.data) {
    for (const entry of query.data) {
      const hasRestriccion =
        entry.asignaciones.length > 0 ||
        (entry.viewer !== undefined && entry.viewer.acciones.length === 0)
      if (hasRestriccion) restrictedIds.add(entry.resourceId)
    }
  }

  return { restrictedIds, unavailable }
}