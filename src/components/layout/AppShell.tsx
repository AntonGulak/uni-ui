import type { ReactNode } from 'react'

interface AppShellProps {
  children: ReactNode
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-lg bg-[var(--bg-primary)]/80 border-b border-[var(--neon-purple)]/10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
              <svg
                className="w-5 h-5 text-white"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
            <span className="text-lg font-bold text-[var(--text-primary)]">UniCalc</span>
          </div>
          <div className="text-xs px-2 py-1 rounded-lg bg-[var(--bg-tertiary)] text-[var(--text-muted)]">
            Concentrated Liquidity
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-4xl mx-auto px-4 py-6">{children}</main>

      {/* Footer gradient glow */}
      <div className="fixed bottom-0 left-0 right-0 h-32 pointer-events-none bg-gradient-to-t from-[var(--neon-purple)]/5 to-transparent" />
    </div>
  )
}
