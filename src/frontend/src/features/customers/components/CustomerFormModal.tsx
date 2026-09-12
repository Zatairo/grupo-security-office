import { useEffect, useState, type FormEvent } from 'react'
import { Modal, Input, Select, Button, Alert } from '../../../components/ui'
import {
  CUSTOMER_SOURCES,
  CUSTOMER_SOURCE_LABELS,
  CUSTOMER_STATUSES,
  CUSTOMER_STATUS_LABELS,
  type Customer,
  type CustomerPayload,
  type CustomerSource,
  type CustomerStatus,
} from '../types/customer.types'

interface CustomerFormModalProps {
  open: boolean
  onClose: () => void
  customer?: Customer | null
  onSubmit: (payload: CustomerPayload) => Promise<unknown>
  isSubmitting?: boolean
}

interface FormState {
  name: string
  documentType: string
  documentId: string
  email: string
  phone: string
  city: string
  address: string
  status: CustomerStatus
  source: '' | CustomerSource
  sourceDetail: string
  notes: string
}

const EMPTY_FORM: FormState = {
  name: '',
  documentType: '',
  documentId: '',
  email: '',
  phone: '',
  city: '',
  address: '',
  status: 'LEAD',
  source: '',
  sourceDetail: '',
  notes: '',
}

function toFormState(customer: Customer | null | undefined): FormState {
  if (!customer) return EMPTY_FORM
  return {
    name: customer.name,
    documentType: customer.documentType ?? '',
    documentId: customer.documentId ?? '',
    email: customer.email ?? '',
    phone: customer.phone ?? '',
    city: customer.city ?? '',
    address: customer.address ?? '',
    status: customer.status,
    source: customer.source ?? '',
    sourceDetail: customer.sourceDetail ?? '',
    notes: customer.notes ?? '',
  }
}

function errorMessage(err: unknown): string {
  const response = (err as { response?: { data?: { message?: string | string[] } } })
    ?.response?.data
  const message = response?.message
  if (Array.isArray(message)) return message.join('. ')
  return message || 'No se pudo guardar el cliente'
}

export default function CustomerFormModal({
  open,
  onClose,
  customer,
  onSubmit,
  isSubmitting = false,
}: CustomerFormModalProps) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setForm(toFormState(customer))
      setError(null)
    }
  }, [open, customer])

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)

    const trimmed = (v: string) => v.trim() || undefined
    const payload: CustomerPayload = {
      name: form.name.trim(),
      documentType: trimmed(form.documentType),
      documentId: trimmed(form.documentId),
      email: trimmed(form.email),
      phone: trimmed(form.phone),
      city: trimmed(form.city),
      address: trimmed(form.address),
      status: form.status,
      source: form.source || undefined,
      sourceDetail: trimmed(form.sourceDetail),
      notes: trimmed(form.notes),
    }

    try {
      await onSubmit(payload)
      onClose()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={customer ? `Editar ${customer.name}` : 'Nuevo cliente o lead'}
      size="lg"
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="customer-form" loading={isSubmitting}>
            {customer ? 'Guardar cambios' : 'Crear'}
          </Button>
        </>
      }
    >
      <form id="customer-form" onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <Alert variant="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Input
          label="Nombre"
          name="name"
          value={form.name}
          onChange={(e) => set('name', e.target.value)}
          required
          placeholder="Seguridad Andina S.A.S."
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Tipo de documento"
            name="documentType"
            value={form.documentType}
            onChange={(e) => set('documentType', e.target.value)}
            placeholder="NIT"
          />
          <Input
            label="Número de documento"
            name="documentId"
            value={form.documentId}
            onChange={(e) => set('documentId', e.target.value)}
            placeholder="901123456-7"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Email"
            name="email"
            type="email"
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
            placeholder="contacto@empresa.com"
          />
          <Input
            label="Teléfono"
            name="phone"
            value={form.phone}
            onChange={(e) => set('phone', e.target.value)}
            placeholder="+57 300 123 4567"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Ciudad"
            name="city"
            value={form.city}
            onChange={(e) => set('city', e.target.value)}
            placeholder="Bogotá"
          />
          <Input
            label="Dirección"
            name="address"
            value={form.address}
            onChange={(e) => set('address', e.target.value)}
            placeholder="Cra 7 # 123-45"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select
            label="Estado"
            name="status"
            value={form.status}
            onChange={(e) => set('status', e.target.value as CustomerStatus)}
            options={CUSTOMER_STATUSES.map((s) => ({
              value: s,
              label: CUSTOMER_STATUS_LABELS[s],
            }))}
          />
          <Select
            label="Origen"
            name="source"
            value={form.source}
            onChange={(e) => set('source', e.target.value as '' | CustomerSource)}
            options={[
              { value: '', label: 'Sin origen' },
              ...CUSTOMER_SOURCES.map((s) => ({
                value: s,
                label: CUSTOMER_SOURCE_LABELS[s],
              })),
            ]}
          />
        </div>

        {form.source && (
          <Input
            label="Detalle del origen"
            name="sourceDetail"
            value={form.sourceDetail}
            onChange={(e) => set('sourceDetail', e.target.value)}
            placeholder="Ej. referido por cliente X, feria Y"
          />
        )}

        <div className="space-y-1.5">
          <label htmlFor="notes" className="block text-sm font-medium text-neutral-800">
            Notas
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={3}
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            className="w-full px-4 py-2.5 rounded-lg border border-neutral-300 text-sm transition-all placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
          />
        </div>
      </form>
    </Modal>
  )
}
