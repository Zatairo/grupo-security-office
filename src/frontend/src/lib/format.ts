export function formatCurrency(
  value: number,
  currency = 'COP',
  maximumFractionDigits = 0
): string {
  try {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency,
      maximumFractionDigits,
    }).format(value)
  } catch {
    return `${currency} ${value}`
  }
}
