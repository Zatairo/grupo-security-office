import type { ButtonHTMLAttributes, ReactNode } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  loading?: boolean
  icon?: ReactNode
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-brand-primary text-white hover:bg-brand-primary-hover shadow-sm shadow-brand-primary/20',
  secondary:
    'bg-white text-brand-primary border border-neutral-300 hover:bg-brand-primary-light hover:border-brand-primary',
  ghost:
    'text-neutral-500 hover:text-brand-primary hover:bg-brand-primary-light border border-transparent',
  danger:
    'bg-brand-error text-white hover:bg-red-700',
}

export default function Button({
  variant = 'primary',
  loading = false,
  icon,
  children,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg font-medium text-sm transition-all focus:outline-none focus:ring-2 focus:ring-brand-primary/30 disabled:opacity-60 disabled:cursor-not-allowed ${variantClasses[variant]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      ) : icon ? (
        icon
      ) : null}
      {children}
    </button>
  )
}
