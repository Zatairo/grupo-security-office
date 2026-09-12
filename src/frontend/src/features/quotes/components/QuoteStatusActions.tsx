import { useMemo, useState, type FormEvent } from 'react'
import { Button, Modal, Input, Alert } from '../../../components/ui'
import {
  QUOTE_DESTINATION_LABELS,
  QUOTE_GANADA_ROLES,
  QUOTE_STATUS_REQUIRES_REASON,
  getValidTransitions,
  type Quote,
  type QuoteStatus,
  type UpdateQuoteStatusPayload,
} from '../types/quote.types'

interface QuoteStatusActionsProps {
  quote: Quote
  currentUserRoles: string[]
  onChangeStatus: (payload: UpdateQuoteStatusPayload) => Promise<unknown>
  isMutating?: boolean
}

function errorMessage(err: unknown): string {
  const response = (err as { response?: { data?: { message?: string | string[] } } })
    ?.response?.data
  const message = response?.message
  if (Array.isArray(message)) return message.join('. ')
  return message || 'No se pudo cambiar el estado'
}

/**
 * Botones de transición de estado: solo las que la matriz del backend
 * (QUOTE_TRANSITIONS de quotes.service, reflejada en types/quote.types)
 * permite desde el estado actual. `ganada` se oculta además para roles
 * sin permiso (el backend igual la rechazaría con 403).
 */
export default function QuoteStatusActions({
  quote,
  currentUserRoles,
  onChangeStatus,
  isMutating = false,
}: QuoteStatusActionsProps) {
  const [reasonFor, setReasonFor] = useState<QuoteStatus | null>(null)
  const [lostReason, setLostReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  const transitions = useMemo(() => {
    const allowed = getValidTransitions(quote.status)
    return allowed.filter(
      (status) =>
        status !== 'ganada' ||
        QUOTE_GANADA_ROLES.some((r) => currentUserRoles.includes(r))
    )
  }, [quote.status, currentUserRoles])

  if (transitions.length === 0) return null

  const runTransition = async (status: QuoteStatus, reason?: string) => {
    setError(null)
    try {
      await onChangeStatus({ status, lostReason: reason })
      setReasonFor(null)
      setLostReason('')
    } catch (err) {
      setError(errorMessage(err))
      if (!QUOTE_STATUS_REQUIRES_REASON.includes(status)) {
        // sin modal abierto: mostrar el error nivel página via alert estándar
        window.alert(errorMessage(err))
      }
    }
  }

  const handleClick = (status: QuoteStatus) => {
    if (QUOTE_STATUS_REQUIRES_REASON.includes(status)) {
      setLostReason('')
      setError(null)
      setReasonFor(status)
      return
    }
    if (window.confirm(`¿${QUOTE_DESTINATION_LABELS[status]}?`)) {
      void runTransition(status)
    }
  }

  const handleReasonSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!reasonFor) return
    if (!lostReason.trim()) {
      setError('Indica el motivo de la pérdida.')
      return
    }
    await runTransition(reasonFor, lostReason.trim())
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {transitions.map((status) => (
        <Button
          key={status}
          type="button"
          variant={status === 'ganada' ? 'primary' : 'secondary'}
          className="text-xs"
          disabled={isMutating}
          onClick={() => handleClick(status)}
        >
          {QUOTE_DESTINATION_LABELS[status]}
        </Button>
      ))}

      <Modal
        open={reasonFor !== null}
        onClose={() => setReasonFor(null)}
        title={reasonFor ? QUOTE_DESTINATION_LABELS[reasonFor] : ''}
        size="sm"
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setReasonFor(null)}>
              Cancelar
            </Button>
            <Button type="submit" form="quote-status-reason-form" loading={isMutating}>
              Confirmar
            </Button>
          </>
        }
      >
        <form id="quote-status-reason-form" onSubmit={handleReasonSubmit} className="space-y-4">
          {error && (
            <Alert variant="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}
          <Input
            label="Motivo de la pérdida"
            name="lostReason"
            value={lostReason}
            onChange={(e) => setLostReason(e.target.value)}
            required
            placeholder="Ej. competencia, precio, sin presupuesto…"
          />
        </form>
      </Modal>
    </div>
  )
}
