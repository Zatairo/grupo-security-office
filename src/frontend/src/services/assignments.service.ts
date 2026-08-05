import api from './api'

export const ASSIGNMENT_RESOURCE_TYPES = ['CATALOG', 'PRICE_LIST', 'CATEGORY'] as const
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

export const fetchAssignments = async (): Promise<Assignment[]> => {
  const res = await api.get('/assignments')
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
