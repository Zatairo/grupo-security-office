import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Table } from '../components/ui'
import QuoteStatusBadge from '../features/quotes/components/QuoteStatusBadge'
import QuoteFormModal from '../features/quotes/components/QuoteFormModal'
import { useQuotes } from '../features/quotes/hooks/useQuotes'
import { useQuoteMutations } from '../features/quotes/hooks/useQuoteMutations'
import {
  QUOTE_STATUSES,
  QUOTE_STATUS_LABELS,
  type Quote,
  type QuoteFilters,
} from '../features/quotes/types/quote.types'
import { formatDate, formatMoney } from '../features/quotes/utils/format'

const PAGE_SIZE = 20

export default function QuotesPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<QuoteFilters['status']>()
  const [page, setPage] = useState(1)
  const [modalOpen, setModalOpen] = useState(false)

  const filters: QuoteFilters = useMemo(
    () => ({ search: search || undefined, status: statusFilter }),
    [search, statusFilter]
  )

  const { quotes, total, totalPages, isLoading, error } = useQuotes({
    filters,
    page,
    pageSize: PAGE_SIZE,
  })
  const { create } = useQuoteMutations()

  const columns = useMemo(
    () => [
      {
        key: 'code',
        header: 'Código',
        render: (q: Quote) => (
          <span className="font-mono text-xs text-neutral-500">{q.code}</span>
        ),
      },
      {
        key: 'customer',
        header: 'Cliente',
        render: (q: Quote) => (
          <p className="font-medium text-neutral-800 truncate">
            {q.customer?.name ?? '—'}
          </p>
        ),
      },
      {
        key: 'lista',
        header: 'Lista',
        render: (q: Quote) => (
          <span className="text-sm text-neutral-600">
            {q.lista?.name ?? '—'}
          </span>
        ),
      },
      {
        key: 'items',
        header: 'Ítems',
        render: (q: Quote) => (
          <span className="text-sm text-neutral-600">
            {q._count?.items ?? q.items?.length ?? 0}
          </span>
        ),
      },
      {
        key: 'total',
        header: 'Total',
        render: (q: Quote) => (
          <span className="text-sm font-medium text-neutral-800">
            {formatMoney(q.total, q.currency)}
          </span>
        ),
      },
      {
        key: 'status',
        header: 'Estado',
        render: (q: Quote) => <QuoteStatusBadge status={q.status} />,
      },
      {
        key: 'validUntil',
        header: 'Válida hasta',
        render: (q: Quote) => (
          <span className="text-sm text-neutral-600">
            {formatDate(q.validUntil)}
          </span>
        ),
      },
    ],
    []
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-condensed font-semibold text-neutral-800">
            Cotizaciones
          </h1>
          <p className="text-sm text-neutral-500">
            {total} registro{total === 1 ? '' : 's'} en tu alcance
          </p>
        </div>
        <Button type="button" onClick={() => setModalOpen(true)}>
          Nueva cotización
        </Button>
      </div>

      <div className="relative min-w-0 max-w-xl">
        <span
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
          aria-hidden="true"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="m21 21-4.35-4.35m1.35-5.15a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0Z" />
          </svg>
        </span>
        <input
          type="search"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(1)
          }}
          placeholder="Buscar por código de cotización"
          aria-label="Buscar cotizaciones"
          className="w-full rounded-lg border border-neutral-300 bg-white py-2.5 pl-10 pr-4 text-sm text-neutral-800 placeholder:text-neutral-400 focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-focus-ring)]"
        />
      </div>

      <div
        className="flex flex-wrap items-center gap-2"
        role="group"
        aria-label="Filtrar por estado"
      >
        <button
          type="button"
          onClick={() => {
            setStatusFilter(undefined)
            setPage(1)
          }}
          className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus-ring)] ${
            !statusFilter
              ? 'border-[var(--color-primary)] bg-[var(--color-primary-bg-subtle)] text-[var(--color-primary)]'
              : 'border-neutral-300 bg-white text-neutral-600 hover:bg-neutral-50'
          }`}
        >
          Todos
        </button>
        {QUOTE_STATUSES.map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => {
              setStatusFilter(status)
              setPage(1)
            }}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-focus-ring)] ${
              statusFilter === status
                ? 'border-[var(--color-primary)] bg-[var(--color-primary-bg-subtle)] text-[var(--color-primary)]'
                : 'border-neutral-300 bg-white text-neutral-600 hover:bg-neutral-50'
            }`}
          >
            {QUOTE_STATUS_LABELS[status]}
          </button>
        ))}
      </div>

      {error && (
        <p className="text-sm text-[var(--color-error)]">
          No se pudieron cargar las cotizaciones. Intenta de nuevo.
        </p>
      )}

      <Table
        columns={columns}
        data={quotes}
        isLoading={isLoading}
        emptyMessage="No hay cotizaciones con estos filtros"
        keyExtractor={(q) => q.id}
        onRowClick={(q) => navigate(`/commercial/quotes/${q.id}`)}
      />

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-neutral-600">
          <span>
            Página {page} de {totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Anterior
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Siguiente
            </Button>
          </div>
        </div>
      )}

      <QuoteFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={async (payload) => {
          const quote = await create.mutateAsync(payload)
          navigate(`/commercial/quotes/${quote.id}`)
        }}
        isSubmitting={create.isPending}
      />
    </div>
  )
}
