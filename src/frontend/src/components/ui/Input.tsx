import { forwardRef, type InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = '', id, ...props }, ref) => {
    const inputId = id || props.name

    return (
      <div className="space-y-1.5">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-neutral-800">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`w-full px-4 py-2.5 rounded-lg border text-sm transition-all placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary disabled:bg-neutral-100 disabled:cursor-not-allowed ${
            error
              ? 'border-brand-error focus:ring-brand-error/30 focus:border-brand-error'
              : 'border-neutral-300'
          } ${className}`}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? `${inputId}-error` : undefined}
          {...props}
        />
        {error && (
          <p id={`${inputId}-error`} className="text-sm text-brand-error" role="alert">
            {error}
          </p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'
export default Input
