export function getApiErrorMessage(error: unknown, fallback = 'Ocurrió un error inesperado'): string {
  if (error && typeof error === 'object' && 'response' in error) {
    const data = (error as { response?: { data?: unknown } }).response?.data
    if (data && typeof data === 'object' && 'message' in data) {
      const message = (data as { message?: unknown }).message
      if (Array.isArray(message)) return message.join(', ')
      if (typeof message === 'string') return message
    }
  }
  return fallback
}
