import api from './api'

export interface MasterKeyStatus {
  configured: boolean
  updatedAt: string | null
  updatedBy: { id: string; name: string } | null
}

export interface SaveMasterKeyPayload {
  masterKey: string
  currentMasterKey?: string
}

export const fetchMasterKeyStatus = async (): Promise<MasterKeyStatus> => {
  const res = await api.get('/security/master-key')
  return res.data as MasterKeyStatus
}

export const saveMasterKey = async (payload: SaveMasterKeyPayload): Promise<void> => {
  await api.put('/security/master-key', payload)
}

export const removeMasterKey = async (): Promise<void> => {
  await api.delete('/security/master-key')
}