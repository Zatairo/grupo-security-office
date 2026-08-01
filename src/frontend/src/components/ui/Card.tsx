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
  primary: 'bg-[var(--color-primary)] border border-[var(--color-border)]',
  secondary: 'bg-gray-50 border border-gray-200',
  success: 'bg-green-50 border border-green-200',
  warning: 'bg-yellow-50 border border-yellow-200',
  error: 'bg-red-50 border border-red-200',
  info: 'bg-blue-50 border border-blue-200',
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