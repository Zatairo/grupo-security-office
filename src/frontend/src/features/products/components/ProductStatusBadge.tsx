interface ProductStatusBadgeProps {
  label: string
  className?: string
  onClick?: () => void
}

export function ProductStatusBadge({ label, className, onClick }: ProductStatusBadgeProps) {
  if (onClick) {
    return (
      <button onClick={onClick} className={className}>
        {label}
      </button>
    )
  }
  return (
    <span className={className}>
      {label}
    </span>
  )
}
