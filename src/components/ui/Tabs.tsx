import { createContext, useContext, type ReactNode } from 'react'

interface TabsContextValue {
  value: string
  onValueChange: (value: string) => void
}

const TabsContext = createContext<TabsContextValue | null>(null)

interface TabsProps {
  value: string
  onValueChange: (value: string) => void
  children: ReactNode
  className?: string
}

export function Tabs({ value, onValueChange, children, className = '' }: TabsProps) {
  return (
    <TabsContext.Provider value={{ value, onValueChange }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  )
}

interface TabsListProps {
  children: ReactNode
  className?: string
}

export function TabsList({ children, className = '' }: TabsListProps) {
  return (
    <div
      className={`
        flex gap-1 p-1
        bg-[var(--bg-tertiary)]
        rounded-xl
        ${className}
      `}
    >
      {children}
    </div>
  )
}

interface TabsTriggerProps {
  value: string
  children: ReactNode
  className?: string
  disabled?: boolean
}

export function TabsTrigger({ value, children, className = '', disabled }: TabsTriggerProps) {
  const context = useContext(TabsContext)
  if (!context) throw new Error('TabsTrigger must be used within Tabs')

  const isActive = context.value === value

  return (
    <button
      onClick={() => !disabled && context.onValueChange(value)}
      disabled={disabled}
      className={`
        flex-1 px-4 py-2
        text-sm font-medium
        rounded-lg
        transition-all duration-200
        ${
          isActive
            ? 'bg-gradient-to-r from-[var(--neon-blue)]/20 via-[var(--neon-purple)]/20 to-[var(--neon-pink)]/20 text-[var(--text-primary)] border border-[var(--neon-purple)]/40'
            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-accent)]'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${className}
      `}
    >
      {children}
    </button>
  )
}

interface TabsContentProps {
  value: string
  children: ReactNode
  className?: string
}

export function TabsContent({ value, children, className = '' }: TabsContentProps) {
  const context = useContext(TabsContext)
  if (!context) throw new Error('TabsContent must be used within Tabs')

  if (context.value !== value) return null

  return <div className={`mt-4 ${className}`}>{children}</div>
}
