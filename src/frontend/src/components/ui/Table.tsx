import type { ReactNode } from 'react'

interface Column<T> {
  key: string
  header: string
  render?: (item: T) => ReactNode
  className?: string
}

interface TableProps<T> {
  columns: Column<T>[]
  data: T[]
  isLoading?: boolean
  emptyMessage?: string
  onRowClick?: (item: T) => void
  keyExtractor: (item: T) => string | number
}

export default function Table<T>({
  columns,
  data,
  isLoading = false,
  emptyMessage = 'No hay datos',
  onRowClick,
  keyExtractor,
}: TableProps<T>) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        <TableHeader columns={columns} />
        <div className="p-12 text-center text-neutral-400 text-sm">Cargando...</div>
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        <TableHeader columns={columns} />
        <div className="p-12 text-center">
          <p className="text-neutral-400 font-medium">{emptyMessage}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-neutral-200">
          <TableHeader columns={columns} />
          <tbody className="divide-y divide-neutral-100">
            {data.map((item) => (
              <tr
                key={keyExtractor(item)}
                onClick={onRowClick ? () => onRowClick(item) : undefined}
                className={`transition-colors ${onRowClick ? 'cursor-pointer hover:bg-brand-primary-light' : 'hover:bg-neutral-50'}`}
              >
                {columns.map((col) => (
                  <td key={col.key} className={`px-4 py-3 text-sm text-neutral-700 ${col.className || ''}`}>
                    {col.render ? col.render(item) : (item as any)[col.key] ?? '-'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function TableHeader<T>({ columns }: { columns: Column<T>[] }) {
  return (
    <thead className="bg-neutral-100">
      <tr>
        {columns.map((col) => (
          <th
            key={col.key}
            className={`px-4 py-3 text-left text-xs font-condensed font-semibold text-neutral-500 uppercase tracking-wider ${col.className || ''}`}
          >
            {col.header}
          </th>
        ))}
      </tr>
    </thead>
  )
}
