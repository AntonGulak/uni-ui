import { useState } from 'react'
import { TabNavigation } from './TabNavigation'
import { TabNavigationV2 } from './TabNavigationV2'

export function VersionSwitcher() {
  const [version, setVersion] = useState<'v3' | 'v2'>('v3')

  return (
    <div className="space-y-4">
      {/* Version Switcher */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 p-1 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-primary)]">
          <button
            onClick={() => setVersion('v3')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              version === 'v3'
                ? 'bg-gradient-to-r from-[var(--neon-purple)] to-[var(--neon-pink)] text-white shadow-lg'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            <span className="flex items-center gap-2">
              <span>Uniswap V3</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded ${version === 'v3' ? 'bg-white/20' : 'bg-[var(--bg-secondary)]'}`}>
                Concentrated
              </span>
            </span>
          </button>
          <button
            onClick={() => setVersion('v2')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              version === 'v2'
                ? 'bg-gradient-to-r from-[var(--neon-blue)] to-[var(--neon-cyan)] text-white shadow-lg'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            <span className="flex items-center gap-2">
              <span>Uniswap V2</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded ${version === 'v2' ? 'bg-white/20' : 'bg-[var(--bg-secondary)]'}`}>
                Full Range
              </span>
            </span>
          </button>
        </div>

        {/* Info badge */}
        <div className="text-[10px] text-[var(--text-muted)] max-w-[200px] text-right">
          {version === 'v3'
            ? 'Concentrated liquidity with custom price ranges'
            : 'Classic AMM with full price range (0 → ∞)'
          }
        </div>
      </div>

      {/* Content */}
      {version === 'v3' ? <TabNavigation /> : <TabNavigationV2 />}
    </div>
  )
}
