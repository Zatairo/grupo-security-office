// Utilidades PURAS de formato (presentación). Nunca calculan montos:
// solo convierten a número lo que el backend ya calculó (serializado
// como string por Prisma Decimal) para poder darle formato local.

import type { MoneyValue } from '../types/quote.types'

export function toNumber(value: MoneyValue): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

export function formatMoney(value: MoneyValue, currency = 'COP'): string {
  const n = toNumber(value)
  if (n === null) return '—'
  try {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(n)
  } catch {
    return `${currency} ${n.toLocaleString('es-CO')}`
  }
}

export function formatPercent(value: MoneyValue): string {
  const n = toNumber(value)
  if (n === null) return '—'
  return `${n.toLocaleString('es-CO', { maximumFractionDigits: 2 })}%`
}

export function formatDate(value?: string | null): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}
