import { type ButtonHTMLAttributes, forwardRef } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'primary', size = 'md', children, disabled, ...props }, ref) => {
    const baseStyles =
      'inline-flex items-center justify-center font-medium rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[var(--bg-primary)]'

    const variants = {
      primary:
        'bg-gradient-to-r from-[var(--neon-blue)] via-[var(--neon-purple)] to-[var(--neon-pink)] text-white hover:opacity-90 focus:ring-[var(--neon-pink)] disabled:opacity-50 disabled:cursor-not-allowed',
      secondary:
        'bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--neon-purple)]/30 hover:border-[var(--neon-purple)]/60 hover:bg-[var(--bg-accent)] focus:ring-[var(--neon-purple)]',
      ghost:
        'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] focus:ring-[var(--neon-purple)]',
    }

    const sizes = {
      sm: 'px-2 py-1 text-xs',
      md: 'px-4 py-2 text-sm',
      lg: 'px-5 py-2.5 text-base',
    }

    return (
      <button
        ref={ref}
        className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
        disabled={disabled}
        {...props}
      >
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'
