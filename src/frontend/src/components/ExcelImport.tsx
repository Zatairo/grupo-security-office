import { useState, useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../services/api'

interface ImportResult {
  total: number
  created: number
  skipped: number
  errors: { row: number; sku: string; error: string }[]
}

interface ExcelImportProps {
  onClose: () => void
  onSuccess: () => void
}

export default function ExcelImport({ onClose, onSuccess }: ExcelImportProps) {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)

  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append('file', file)
      const res = await api.post('/products/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return res.data
    },
    onSuccess: (data) => {
      setResult(data)
      queryClient.invalidateQueries({ queryKey: ['products'] })
      if (data.created > 0) {
        onSuccess()
      }
    },
  })

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
      setResult(null)
    }
  }

  const handleImport = () => {
    if (file) {
      importMutation.mutate(file)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const droppedFile = e.dataTransfer.files?.[0]
    if (droppedFile && (droppedFile.name.endsWith('.xlsx') || droppedFile.name.endsWith('.xls') || droppedFile.name.endsWith('.csv'))) {
      setFile(droppedFile)
      setResult(null)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-lg shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 bg-security-700 rounded-t-xl">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">Importar Productos desde Excel</h2>
            <button onClick={onClose} className="p-2 text-security-200 hover:text-white hover:bg-security-600 rounded-lg transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6">
          {/* Instructions */}
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="text-sm font-semibold text-blue-800 mb-2">Formato del archivo Excel:</h3>
            <ul className="text-xs text-blue-700 space-y-1">
              <li><strong>SKU</strong> (requerido) - Código único del producto</li>
              <li><strong>Nombre</strong> (requerido) - Nombre del producto</li>
              <li><strong>Descripción</strong> (opcional) - Descripción del producto</li>
              <li><strong>Categoría</strong> (requerido) - Se creará si no existe</li>
              <li><strong>Marca</strong> (requerido) - Se creará si no existe</li>
            </ul>
          </div>

          {/* File upload area */}
          {!result && (
            <div
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                file
                  ? 'border-security-500 bg-security-50'
                  : 'border-gray-300 hover:border-security-400 hover:bg-gray-50'
              }`}
            >
              {file ? (
                <div>
                  <svg className="w-12 h-12 text-security-500 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-sm font-medium text-gray-900">{file.name}</p>
                  <p className="text-xs text-gray-500 mt-1">{(file.size / 1024).toFixed(1)} KB</p>
                  <button
                    onClick={() => { setFile(null); setResult(null) }}
                    className="mt-3 text-sm text-security-600 hover:text-security-700"
                  >
                    Cambiar archivo
                  </button>
                </div>
              ) : (
                <div>
                  <svg className="w-12 h-12 text-gray-400 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <p className="text-sm text-gray-600">Arrastra tu archivo Excel aquí</p>
                  <p className="text-xs text-gray-400 mt-1">o</p>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-2 px-4 py-2 bg-security-700 text-white text-sm rounded-lg hover:bg-security-800 transition-colors"
                  >
                    Seleccionar archivo
                  </button>
                  <p className="text-xs text-gray-400 mt-2">.xlsx, .xls o .csv</p>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          )}

          {/* Results */}
          {result && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-blue-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-blue-600">{result.total}</p>
                  <p className="text-xs text-blue-700">Total filas</p>
                </div>
                <div className="bg-emerald-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-emerald-600">{result.created}</p>
                  <p className="text-xs text-emerald-700">Creados</p>
                </div>
                <div className="bg-amber-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-amber-600">{result.skipped}</p>
                  <p className="text-xs text-amber-700">Omitidos</p>
                </div>
              </div>

              {result.errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 max-h-48 overflow-y-auto">
                  <h4 className="text-sm font-semibold text-red-800 mb-2">Errores:</h4>
                  <ul className="text-xs text-red-700 space-y-1">
                    {result.errors.map((err, i) => (
                      <li key={i}>
                        <span className="font-mono">Fila {err.row}</span> ({err.sku}): {err.error}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 justify-end mt-6 pt-4 border-t border-gray-200">
            <button
              onClick={onClose}
              className="px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
            >
              {result ? 'Cerrar' : 'Cancelar'}
            </button>
            {!result && (
              <button
                onClick={handleImport}
                disabled={!file || importMutation.isPending}
                className="px-4 py-2.5 bg-security-500 text-white rounded-lg hover:bg-security-600 disabled:opacity-50 font-semibold transition-colors flex items-center gap-2"
              >
                {importMutation.isPending ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Importando...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    Importar
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
