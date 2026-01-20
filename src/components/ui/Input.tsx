import { type InputHTMLAttributes, forwardRef } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  suffix?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', label, error, suffix, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-xs text-[var(--text-muted)] mb-1">{label}</label>
        )}
        <div className="relative">
          <input
            ref={ref}
            className={`
              w-full px-3 py-2
              bg-[var(--bg-tertiary)]
              border border-[var(--border-primary)]
              rounded-lg
              text-[var(--text-primary)]
              placeholder-[var(--text-muted)]
              font-mono text-sm
              transition-all duration-200
              focus:outline-none focus:border-[var(--neon-purple)]/50
              hover:border-[var(--neon-purple)]/30
              disabled:opacity-50 disabled:cursor-not-allowed
              ${suffix ? 'pr-14' : ''}
              ${error ? 'border-[var(--neon-red)]/60' : ''}
              ${className}
            `}
            {...props}
          />
          {suffix && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] text-xs">
              {suffix}
            </span>
          )}
        </div>
        {error && <p className="mt-1 text-sm text-[var(--neon-red)]">{error}</p>}
      </div>
    )
  }
)

Input.displayName = 'Input'
