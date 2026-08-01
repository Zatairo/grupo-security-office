import { forwardRef, type SelectHTMLAttributes } from 'react'

interface SelectOption {
  value: string
  label: string
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  options: SelectOption[]
  placeholder?: string
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, placeholder, className = '', id, ...props }, ref) => {
    const selectId = id || props.name

    return (
      <div className="space-y-1.5">
        {label && (
          <label htmlFor={selectId} className="block text-sm font-medium text-neutral-800">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={`w-full px-4 py-2.5 rounded-lg border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary disabled:bg-neutral-100 disabled:cursor-not-allowed ${
            error
              ? 'border-brand-error focus:ring-brand-error/30 focus:border-brand-error'
              : 'border-neutral-300'
          } ${className}`}
          aria-invalid={error ? 'true' : undefined}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && (
          <p className="text-sm text-brand-error" role="alert">
            {error}
          </p>
        )}
      </div>
    )
  }
)

Select.displayName = 'Select'
export default Select
