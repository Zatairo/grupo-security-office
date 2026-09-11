import { Badge } from '../../../components/ui'
import {
  CUSTOMER_STATUS_LABELS,
  type CustomerStatus,
} from '../types/customer.types'

const STATUS_VARIANT: Record<CustomerStatus, 'info' | 'success' | 'neutral'> = {
  LEAD: 'info',
  CLIENTE: 'success',
  INACTIVO: 'neutral',
}

export default function CustomerStatusBadge({ status }: { status: CustomerStatus }) {
  return (
    <Badge variant={STATUS_VARIANT[status]}>
      {CUSTOMER_STATUS_LABELS[status] ?? status}
    </Badge>
  )
}
