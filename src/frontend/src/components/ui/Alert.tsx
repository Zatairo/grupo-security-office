import type { ReactNode } from 'react'

type AlertVariant = 'success' | 'warning' | 'error' | 'info'

interface AlertProps {
  variant?: AlertVariant
  children: ReactNode
  className?: string
  onClose?: () => void
}

const variantClasses: Record<AlertVariant, string> = {
  success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  warning: 'bg-amber-50 border-amber-200 text-amber-800',
  error: 'bg-red-50 border-red-200 text-red-800',
  info: 'bg-brand-primary-light border-brand-primary-subtle text-brand-primary',
}

const variantIcons: Record<AlertVariant, ReactNode> = {
  success: (
    <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  warning: (
    <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
    </svg>
  ),
  error: (
    <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  info: (
    <svg className="w-5 h-5 text-brand-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
}

export default function Alert({ variant = 'info', children, className = '', onClose }: AlertProps) {
  return (
    <div
      className={`flex items-start gap-3 p-3.5 rounded-lg border text-sm ${variantClasses[variant]} ${className}`}
      role="alert"
    >
      <span className="flex-shrink-0 mt-0.5">{variantIcons[variant]}</span>
      <span className="flex-1">{children}</span>
      {onClose && (
        <button
          onClick={onClose}
          className="flex-shrink-0 p-0.5 rounded hover:bg-black/5 transition-colors"
          aria-label="Cerrar"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  )
}
