import type { ReactNode } from 'react'

type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral'

interface BadgeProps {
  variant?: BadgeVariant
  children: ReactNode
  className?: string
}

const variantClasses: Record<BadgeVariant, string> = {
  success: 'bg-[var(--color-success-bg-subtle)] text-[var(--color-success)] border-[var(--color-success)]/20',
  warning: 'bg-[var(--color-warning-bg-subtle)] text-[var(--color-warning)] border-[var(--color-warning)]/20',
  error: 'bg-[var(--color-error-bg-subtle)] text-[var(--color-error)] border-[var(--color-error)]/20',
  info: 'bg-[var(--color-primary-bg-subtle)] text-[var(--color-primary)] border-[var(--color-primary)]/20',
  neutral: 'bg-[var(--color-bg-surface)] text-[var(--color-text-secondary)] border-[var(--color-border)]',
}

export default function Badge({ variant = 'info', children, className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${variantClasses[variant]} ${className}`}
    >
      {children}
    </span>
  )
}
