import { useState, type ChangeEvent } from 'react'

export type SpecFieldType = 'TEXT' | 'NUMBER' | 'SELECT' | 'BOOLEAN' | 'UNIT'

export interface SpecField {
  key: string
  type: SpecFieldType
  value: string | number | boolean | string[]
  unit?: string
  required?: boolean
  options?: string[]
}

export interface SpecEditorProps {
  fields: SpecField[]
  onChange: (fields: SpecField[]) => void
  label: string
  placeholder?: string
  validationError?: string
}

const TYPE_OPTIONS: { value: SpecFieldType; label: string }[] = [
  { value: 'TEXT', label: 'Texto' },
  { value: 'NUMBER', label: 'Número' },
  { value: 'SELECT', label: 'Lista (selección)' },
  { value: 'BOOLEAN', label: 'Sí/No' },
  { value: 'UNIT', label: 'Valor + Unidad' },
]

function SpecRow({
  field,
  index,
  onUpdate,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  field: SpecField
  index: number
  onUpdate: (field: SpecField) => void
  onRemove: () => void
  onMoveUp: () => void
  onMoveDown: () => void
}) {
  const [showOptions, setShowOptions] = useState(false)
  const [optionsText, setOptionsText] = useState(field.options?.join(', ') ?? '')

  const handleKeyChange = (e: ChangeEvent<HTMLInputElement>) => {
    onUpdate({ ...field, key: e.target.value })
  }

  const handleTypeChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const newType = e.target.value as SpecFieldType
    let newValue: SpecField['value'] = ''
    if (newType === 'NUMBER') newValue = 0
    else if (newType === 'BOOLEAN') newValue = false
    else if (newType === 'SELECT') newValue = []
    else if (newType === 'UNIT') newValue = ''
    onUpdate({ ...field, type: newType, value: newValue, options: newType === 'SELECT' ? [] : undefined })
  }

  const handleValueChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { value } = e.target
    if (field.type === 'NUMBER') {
      onUpdate({ ...field, value: Number(value) || 0 })
    } else if (field.type === 'BOOLEAN') {
      onUpdate({ ...field, value: e.target instanceof HTMLInputElement ? e.target.checked : value === 'true' })
    } else if (field.type === 'SELECT') {
      onUpdate({ ...field, value: value.split(',').map((v) => v.trim()).filter(Boolean) })
    } else {
      onUpdate({ ...field, value })
    }
  }

  const handleUnitChange = (e: ChangeEvent<HTMLInputElement>) => {
    onUpdate({ ...field, unit: e.target.value })
  }

  const handleOptionsChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const opts = e.target.value.split(',').map((v) => v.trim()).filter(Boolean)
    setOptionsText(e.target.value)
    onUpdate({ ...field, options: opts })
  }

  const handleRequiredChange = (e: ChangeEvent<HTMLInputElement>) => {
    onUpdate({ ...field, required: e.target.checked })
  }

  const renderInput = () => {
    switch (field.type) {
      case 'TEXT':
        return (
          <input
            type="text"
            value={String(field.value ?? '')}
            onChange={handleValueChange}
            className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary text-sm"
            placeholder="Valor de texto"
          />
        )
      case 'NUMBER':
        return (
          <input
            type="number"
            step="any"
            value={String(field.value ?? '')}
            onChange={handleValueChange}
            className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary text-sm"
            placeholder="Valor numérico"
          />
        )
      case 'BOOLEAN':
        return (
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={Boolean(field.value)}
              onChange={handleValueChange}
              className="w-4 h-4 text-brand-primary border-neutral-300 rounded focus:ring-brand-primary/30 focus:border-brand-primary"
            />
            <span className="text-sm text-neutral-700">Sí / Activado</span>
          </label>
        )
      case 'SELECT':
        return (
          <div className="space-y-2">
            <select
              value={Array.isArray(field.value) ? field.value[0] : ''}
              onChange={(e) => onUpdate({ ...field, value: [e.target.value] })}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary text-sm"
            >
              <option value="">Seleccionar...</option>
              {(field.options ?? []).map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setShowOptions(!showOptions)}
              className="text-xs text-brand-primary hover:underline"
            >
              {showOptions ? 'Ocultar opciones' : 'Editar opciones'}
            </button>
            {showOptions && (
              <textarea
                value={optionsText}
                onChange={handleOptionsChange}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary text-sm font-mono"
                rows={2}
                placeholder="Opciones separadas por comas (ej: Rojo, Azul, Verde)"
              />
            )}
          </div>
        )
      case 'UNIT':
        return (
          <div className="flex gap-2">
            <input
              type="text"
              value={String(field.value ?? '')}
              onChange={handleValueChange}
              className="flex-1 px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary text-sm"
              placeholder="Valor"
            />
            <input
              type="text"
              value={field.unit ?? ''}
              onChange={handleUnitChange}
              className="w-24 px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary text-sm"
              placeholder="Unidad (ej: mm, kg, m)"
            />
          </div>
        )
    }
  }

  return (
    <div className="border border-neutral-200 rounded-lg p-3 bg-white space-y-3">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0 space-y-2">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">Clave *</label>
              <input
                type="text"
                value={field.key}
                onChange={handleKeyChange}
                className="w-full px-2 py-1.5 border border-neutral-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-brand-primary/30 focus:border-brand-primary"
                placeholder="ej: resolucion"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">Tipo</label>
              <select
                value={field.type}
                onChange={handleTypeChange}
                className="w-full px-2 py-1.5 border border-neutral-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-brand-primary/30 focus:border-brand-primary"
              >
                {TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">Requerido</label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={field.required ?? false}
                  onChange={handleRequiredChange}
                  className="w-4 h-4 text-brand-primary border-neutral-300 rounded focus:ring-brand-primary/30 focus:border-brand-primary"
                />
                <span className="text-xs text-neutral-600">Sí</span>
              </label>
            </div>
            <div className="flex items-end gap-2">
              <button
                type="button"
                onClick={onMoveUp}
                disabled={index === 0}
                className="p-1.5 text-neutral-400 hover:text-brand-primary hover:bg-brand-primary/10 rounded disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title="Mover arriba"
                aria-label="Mover arriba"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                </svg>
              </button>
              <button
                type="button"
                onClick={onMoveDown}
                className="p-1.5 text-neutral-400 hover:text-brand-primary hover:bg-brand-primary/10 rounded transition-colors"
                title="Mover abajo"
                aria-label="Mover abajo"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <button
                type="button"
                onClick={onRemove}
                className="ml-auto p-1.5 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                title="Eliminar"
                aria-label="Eliminar especificación"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
          <div>
            {renderInput()}
          </div>
        </div>
      </div>
    </div>
  )
}

export function SpecEditor({ fields, onChange, label, placeholder, validationError }: SpecEditorProps) {
  const addField = () => {
    const newField: SpecField = {
      key: '',
      type: 'TEXT',
      value: '',
      required: false,
    }
    onChange([...fields, newField])
  }

  const updateField = (index: number, field: SpecField) => {
    const next = [...fields]
    next[index] = field
    onChange(next)
  }

  const removeField = (index: number) => {
    const next = fields.filter((_, i) => i !== index)
    onChange(next)
  }

  const moveUp = (index: number) => {
    if (index === 0) return
    const next = [...fields]
    const temp = next[index - 1]
    next[index - 1] = next[index]!
    next[index] = temp!
    onChange(next)
  }

  const moveDown = (index: number) => {
    if (index === fields.length - 1) return
    const next = [...fields]
    const temp = next[index]
    next[index] = next[index + 1]!
    next[index + 1] = temp!
    onChange(next)
  }

  const hasErrors = fields.some((f) => !f.key.trim()) ||
    new Set(fields.map((f) => f.key.trim())).size !== fields.length ||
    fields.some((f) => f.type === 'SELECT' && (!f.options || f.options.length === 0))

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-neutral-700">{label}</label>
        <button
          type="button"
          onClick={addField}
          className="px-3 py-1.5 text-xs font-medium text-brand-primary hover:text-brand-primary-hover border border-brand-primary rounded-lg hover:bg-brand-primary/5 transition-colors"
        >
          + Agregar especificación
        </button>
      </div>

      {validationError && (
        <div className="p-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded" role="alert">
          {validationError}
        </div>
      )}

      {hasErrors && !validationError && (
        <div className="p-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded" role="alert">
          Revisa: claves vacías/duplicadas, y listas SELECT con opciones.
        </div>
      )}

      {fields.length === 0 && (
        <p className="text-sm text-neutral-400 py-4 text-center">
          {placeholder ?? 'Sin especificaciones definidas.'}
        </p>
      )}

      {fields.map((field, index) => (
        <SpecRow
          key={index}
          field={field}
          index={index}
          onUpdate={(f) => updateField(index, f)}
          onRemove={() => removeField(index)}
          onMoveUp={() => moveUp(index)}
          onMoveDown={() => moveDown(index)}
        />
      ))}
    </div>
  )
}

export function serializeSpecFields(fields: SpecField[]): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const field of fields) {
    if (!field.key.trim()) continue
    switch (field.type) {
      case 'NUMBER':
        result[field.key] = typeof field.value === 'number' ? field.value : Number(field.value)
        break
      case 'BOOLEAN':
        result[field.key] = Boolean(field.value)
        break
      case 'SELECT':
        result[field.key] = Array.isArray(field.value) ? field.value : (field.options ?? [])
        break
      case 'UNIT':
        result[field.key] = {
          value: field.value,
          unit: field.unit,
        }
        break
      default:
        result[field.key] = String(field.value ?? '')
    }
  }
  return result
}

export function deserializeSpecFields(obj: Record<string, unknown> | null | undefined): SpecField[] {
  if (!obj || typeof obj !== 'object') return []
  const fields: SpecField[] = []
  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) {
      fields.push({ key, type: 'TEXT', value: '' })
      continue
    }
    if (typeof value === 'number') {
      fields.push({ key, type: 'NUMBER', value })
    } else if (typeof value === 'boolean') {
      fields.push({ key, type: 'BOOLEAN', value })
    } else if (Array.isArray(value)) {
      fields.push({ key, type: 'SELECT', value, options: value })
    } else if (typeof value === 'object' && value !== null && 'value' in value && 'unit' in value) {
      fields.push({
        key,
        type: 'UNIT',
        value: String((value as { value: unknown }).value ?? ''),
        unit: String((value as { unit: unknown }).unit ?? ''),
      })
    } else {
      fields.push({ key, type: 'TEXT', value: String(value) })
    }
  }
  return fields
}