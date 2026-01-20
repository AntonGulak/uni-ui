import { type SelectHTMLAttributes, forwardRef } from 'react'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  options: { value: string | number; label: string }[]
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className = '', label, options, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm text-[var(--text-secondary)] mb-1.5">{label}</label>
        )}
        <select
          ref={ref}
          className={`
            w-full px-4 py-2.5
            bg-[var(--bg-tertiary)]
            border border-[var(--neon-purple)]/20
            rounded-xl
            text-[var(--text-primary)]
            transition-all duration-200
            focus:outline-none focus:border-[var(--neon-pink)]/60 focus:ring-1 focus:ring-[var(--neon-pink)]/30
            hover:border-[var(--neon-purple)]/40
            cursor-pointer
            ${className}
          `}
          {...props}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    )
  }
)

Select.displayName = 'Select'
