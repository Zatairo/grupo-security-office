import api from './api'

export interface ImportPresetMapping {
  sourceColumn: string
  targetField: string
}

export interface ImportPreset {
  id: string
  name: string
  mappings: ImportPresetMapping[]
  userId: string
  createdAt: string
  isDefault: boolean
}

export interface CreateImportPresetPayload {
  name: string
  mapping: ImportPresetMapping[]
  isDefault?: boolean
}

export async function fetchImportPresets(): Promise<ImportPreset[]> {
  const { data } = await api.get('/products/import/mappings')
  return data
}

export async function createImportPreset(
  payload: CreateImportPresetPayload,
): Promise<ImportPreset> {
  const { data } = await api.post('/products/import/mappings', payload)
  return data
}

export async function deleteImportPreset(id: string): Promise<void> {
  await api.delete(`/products/import/mappings/${id}`)
}