import { useState } from 'react'
import { usePoolStore } from '../../store/usePoolStore'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { LiquidityForm } from '../liquidity/LiquidityForm'
import { tickToPrice } from '../../core'

function formatPrice(price: number): string {
  if (!isFinite(price) || isNaN(price)) return '—'
  if (price === 0) return '0'
  if (price >= 1e9) return (price / 1e9).toFixed(2) + 'B'
  if (price >= 1e6) return (price / 1e6).toFixed(2) + 'M'
  if (price >= 1000) return price.toFixed(0)
  if (price >= 1) return price.toFixed(2)
  if (price >= 0.0001) return price.toFixed(6)
  return price.toExponential(2)
}

function formatLiquidity(liquidity: string): string {
  const len = liquidity.length
  if (len <= 6) return Number(liquidity).toLocaleString()
  if (len <= 9) return (Number(liquidity.slice(0, len - 6)) / 1000).toFixed(1) + 'M'
  if (len <= 12) return (Number(liquidity.slice(0, len - 9)) / 1000).toFixed(1) + 'B'
  return (Number(liquidity.slice(0, len - 12)) / 1000).toFixed(1) + 'T'
}

export function PositionsTab() {
  const { pool, removePosition } = usePoolStore()
  const [isModalOpen, setIsModalOpen] = useState(false)

  const currentTick = pool.tick
  const decimalAdjustment = Math.pow(10, pool.tokenB.decimals - pool.tokenA.decimals)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">
            Positions
          </h2>
          <p className="text-sm text-[var(--text-muted)]">
            {pool.positions.length} position{pool.positions.length !== 1 ? 's' : ''} · Current tick: {currentTick.toLocaleString()}
          </p>
        </div>
        <Button onClick={() => setIsModalOpen(true)}>
          + Add Position
        </Button>
      </div>

      {/* Positions List */}
      {pool.positions.length === 0 ? (
        <div className="py-12 text-center">
          <div className="text-4xl mb-3 opacity-50">📊</div>
          <p className="text-[var(--text-muted)]">No positions yet</p>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Add liquidity to create your first position
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {pool.positions.map((position) => {
            const priceLower = tickToPrice(position.tickLower) / decimalAdjustment
            const priceUpper = tickToPrice(position.tickUpper) / decimalAdjustment
            const isInRange = currentTick > position.tickLower && currentTick < position.tickUpper

            return (
              <div
                key={position.id}
                className={`p-3 rounded-xl border transition-colors ${
                  isInRange
                    ? 'border-[var(--neon-green)]/30 bg-[var(--neon-green)]/5'
                    : 'border-[var(--border-primary)] bg-[var(--bg-secondary)]'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    {/* Status & Range */}
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${
                        isInRange
                          ? 'bg-[var(--neon-green)]/20 text-[var(--neon-green)]'
                          : 'bg-[var(--text-muted)]/20 text-[var(--text-muted)]'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${isInRange ? 'bg-[var(--neon-green)]' : 'bg-[var(--text-muted)]'}`} />
                        {isInRange ? 'In Range' : 'Out of Range'}
                      </span>
                    </div>

                    {/* Price Range */}
                    <div className="text-sm">
                      <span className="text-[var(--text-muted)]">Range: </span>
                      <span className="font-mono text-[var(--text-primary)]">
                        {formatPrice(priceLower)} — {formatPrice(priceUpper)}
                      </span>
                      <span className="text-[var(--text-muted)] ml-1">
                        {pool.tokenB.symbol}/{pool.tokenA.symbol}
                      </span>
                    </div>

                    {/* Ticks */}
                    <div className="text-xs text-[var(--text-muted)] mt-1">
                      Ticks: {position.tickLower.toLocaleString()} → {position.tickUpper.toLocaleString()}
                    </div>

                    {/* Liquidity */}
                    <div className="text-xs text-[var(--text-muted)] mt-1">
                      Liquidity: {formatLiquidity(position.liquidity.toString())}
                    </div>
                  </div>

                  {/* Remove button */}
                  <button
                    onClick={() => removePosition(position.id)}
                    className="p-2 text-[var(--text-muted)] hover:text-[var(--neon-red)] hover:bg-[var(--neon-red)]/10 rounded-lg transition-colors"
                    title="Remove position"
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add Position Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Add Liquidity Position"
        size="xl"
      >
        <LiquidityForm onSuccess={() => setIsModalOpen(false)} />
      </Modal>
    </div>
  )
}
