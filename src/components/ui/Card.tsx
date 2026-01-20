import { type HTMLAttributes, forwardRef } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated'
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className = '', variant = 'default', children, ...props }, ref) => {
    const variants = {
      default:
        'bg-[var(--bg-secondary)] border border-[var(--border-primary)]',
      elevated:
        'gradient-card border border-[var(--border-primary)] card-glow',
    }

    return (
      <div
        ref={ref}
        className={`rounded-2xl p-5 transition-all duration-300 ${variants[variant]} ${className}`}
        {...props}
      >
        {children}
      </div>
    )
  }
)

Card.displayName = 'Card'

export const CardHeader = ({ className = '', children, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div className={`mb-4 ${className}`} {...props}>
    {children}
  </div>
)

export const CardTitle = ({ className = '', children, ...props }: HTMLAttributes<HTMLHeadingElement>) => (
  <h3 className={`text-lg font-semibold text-[var(--text-primary)] ${className}`} {...props}>
    {children}
  </h3>
)

export const CardDescription = ({ className = '', children, ...props }: HTMLAttributes<HTMLParagraphElement>) => (
  <p className={`text-sm text-[var(--text-secondary)] mt-1 ${className}`} {...props}>
    {children}
  </p>
)

export const CardContent = ({ className = '', children, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div className={className} {...props}>
    {children}
  </div>
)
