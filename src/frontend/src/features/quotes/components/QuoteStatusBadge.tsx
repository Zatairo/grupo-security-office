import { Badge } from '../../../components/ui'
import {
  QUOTE_STATUS_LABELS,
  type QuoteDisplayStatus,
} from '../types/quote.types'

const STATUS_VARIANTS: Record<
  QuoteDisplayStatus,
  'success' | 'warning' | 'error' | 'info' | 'neutral'
> = {
  borrador: 'neutral',
  enviada: 'info',
  negociacion: 'warning',
  ganada: 'success',
  perdida: 'error',
  cancelada: 'neutral',
  vencida: 'warning',
}

export default function QuoteStatusBadge({
  status,
}: {
  status: QuoteDisplayStatus
}) {
  return <Badge variant={STATUS_VARIANTS[status]}>{QUOTE_STATUS_LABELS[status]}</Badge>
}
