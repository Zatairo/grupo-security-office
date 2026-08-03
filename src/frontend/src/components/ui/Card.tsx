import type { ReactNode, HTMLAttributes } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  padding?: 'none' | 'sm' | 'md' | 'lg'
  hover?: boolean
  variant?: 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info'
  elevated?: boolean
}

const paddingClasses = {
  none: 'p-0',
  sm: 'p-4',
  md: 'p-5',
  lg: 'p-6',
}

const variantClasses = {
  default: 'bg-[var(--color-bg-card)] border border-[var(--color-border)]',
  primary: 'bg-[var(--color-primary-bg-subtle)] border border-[var(--color-primary)]/20',
  secondary: 'bg-[var(--color-secondary)]/5 border border-[var(--color-secondary)]/20',
  success: 'bg-[var(--color-success-bg-subtle)] border border-[var(--color-success)]/20',
  warning: 'bg-[var(--color-warning-bg-subtle)] border border-[var(--color-warning)]/20',
  error: 'bg-[var(--color-error-bg-subtle)] border border-[var(--color-error)]/20',
  info: 'bg-[var(--color-info-bg-subtle)] border border-[var(--color-info)]/20',
}

const elevatedClasses: Record<string, string> = {
  default: 'shadow-sm',
  primary: 'shadow-sm',
  secondary: 'shadow-sm',
  success: 'shadow-sm',
  warning: 'shadow-sm',
  error: 'shadow-sm',
  info: 'shadow-sm',
}

export default function Card({
  children,
  padding = 'md',
  hover = false,
  variant = 'default',
  elevated = true,
  className = '',
  ...props
}: CardProps) {
  return (
    <div
      className={`${variantClasses[variant]} rounded-xl ${paddingClasses[padding]} ${
        elevated ? elevatedClasses[variant] : ''
      } ${
        hover
          ? 'hover:shadow-md hover:border-neutral-300/50 transition-all duration-200'
          : ''
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}