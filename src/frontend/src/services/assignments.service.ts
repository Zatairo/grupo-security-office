import api from './api'

export const ASSIGNMENT_RESOURCE_TYPES = ['CATALOG', 'PRICE_LIST', 'CATEGORY', 'LISTA'] as const
export type AssignmentResourceType = (typeof ASSIGNMENT_RESOURCE_TYPES)[number]

export const ASSIGNMENT_LEVELS = ['view', 'edit', 'manage'] as const
export type AssignmentLevel = (typeof ASSIGNMENT_LEVELS)[number]

export interface Assignment {
  id: string
  userId: string
  resourceType: AssignmentResourceType
  resourceId: string
  level: AssignmentLevel
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateAssignmentPayload {
  userId: string
  resourceType: AssignmentResourceType
  resourceId: string
  level: AssignmentLevel
}

export interface UpdateAssignmentPayload {
  level?: AssignmentLevel
  isActive?: boolean
}

interface AssignmentListResponse {
  data: Assignment[]
}

/**
 * Niveles reales del backend (assignments DTO, OLA 7B): 'edit' es alias legacy
 * de 'edit_products'. El service los normaliza.
 */
export const ASSIGNMENT_LEVELS_REAL = [
  'view',
  'edit_prices',
  'edit_products',
  'edit',
  'manage',
  'manage_access',
] as const
export type AssignmentLevelReal = (typeof ASSIGNMENT_LEVELS_REAL)[number]

export const fetchAssignments = async (
  filters?: { resourceType?: string; userId?: string }
): Promise<Assignment[]> => {
  const params = new URLSearchParams()
  if (filters?.resourceType) params.set('resourceType', filters.resourceType)
  if (filters?.userId) params.set('userId', filters.userId)
  const qs = params.toString()
  const res = await api.get(`/assignments${qs ? `?${qs}` : ''}`)
  const body = res.data as AssignmentListResponse
  return body.data ?? []
}

export const createAssignment = async (payload: CreateAssignmentPayload): Promise<Assignment> => {
  const res = await api.post('/assignments', payload)
  return res.data as Assignment
}

export const updateAssignment = async (
  id: string,
  payload: UpdateAssignmentPayload
): Promise<Assignment> => {
  const res = await api.patch(`/assignments/${id}`, payload)
  return res.data as Assignment
}

export const deleteAssignment = async (id: string): Promise<void> => {
  await api.delete(`/assignments/${id}`)
}
