import { usePoolStore } from '../../store/usePoolStore'
import { tickToPrice } from '../../core'
import JSBI from 'jsbi'

function formatPrice(price: number): string {
  if (!isFinite(price) || isNaN(price)) return '—'
  if (price === 0) return '0'
  if (price >= 1e12) return price.toExponential(2)
  if (price >= 1e9) return (price / 1e9).toFixed(2) + 'B'
  if (price >= 1e6) return (price / 1e6).toFixed(2) + 'M'
  if (price >= 1000) return price.toFixed(0)
  if (price >= 1) return price.toFixed(2)
  if (price >= 0.0001) return price.toFixed(6)
  if (price < 1e-12) return price.toExponential(2)
  return price.toExponential(2)
}

function formatLiquidity(liquidity: JSBI): string {
  const str = liquidity.toString()
  const len = str.length
  if (len <= 6) return Number(str).toLocaleString()
  const significantDigits = str.slice(0, Math.min(6, len))
  const scale = len - significantDigits.length
  const num = Number(significantDigits)
  if (len <= 9) return (num / Math.pow(10, 6 - scale)).toFixed(2) + 'M'
  if (len <= 12) return (num / Math.pow(10, 9 - scale)).toFixed(2) + 'B'
  if (len <= 15) return (num / Math.pow(10, 12 - scale)).toFixed(2) + 'T'
  return (num / Math.pow(10, significantDigits.length - 1)).toFixed(2) + 'e' + (len - 1)
}

export function PositionsList() {
  const { pool, removePosition } = usePoolStore()

  if (pool.positions.length === 0) {
    return (
      <div className="space-y-2">
        <div className="text-sm text-[var(--text-primary)] font-medium">Positions</div>
        <div className="text-center py-6 text-[var(--text-muted)] text-xs">
          No positions yet
        </div>
      </div>
    )
  }

  const currentTick = pool.tick
  const decimalAdjustment = Math.pow(10, pool.tokenB.decimals - pool.tokenA.decimals)

  return (
    <div className="space-y-2">
      <div className="text-sm text-[var(--text-primary)] font-medium">
        Positions ({pool.positions.length})
      </div>
      <div className="max-h-[280px] overflow-y-auto space-y-2 pr-1">
        {pool.positions.map((position) => {
          // Convert raw tick prices to human-readable
          const priceLower = tickToPrice(position.tickLower) / decimalAdjustment
          const priceUpper = tickToPrice(position.tickUpper) / decimalAdjustment
          const isInRange = currentTick > position.tickLower && currentTick < position.tickUpper

          return (
            <div
              key={position.id}
              className={`p-2 rounded-lg border text-xs ${
                isInRange
                  ? 'bg-[var(--neon-green)]/5 border-[var(--neon-green)]/20'
                  : 'bg-[var(--bg-tertiary)] border-[var(--border-primary)]'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1">
                  <div className={`w-1.5 h-1.5 rounded-full ${isInRange ? 'bg-[var(--neon-green)]' : 'bg-[var(--text-muted)]'}`} />
                  <span className="text-[var(--text-muted)]">
                    {position.tickLower.toLocaleString()} → {position.tickUpper.toLocaleString()}
                  </span>
                </div>
                <button
                  onClick={() => removePosition(position.id)}
                  className="text-[var(--text-muted)] hover:text-[var(--neon-red)] transition-colors"
                >
                  ✕
                </button>
              </div>
              <div className="flex items-center justify-between text-[var(--text-muted)]">
                <span>{formatPrice(priceLower)} — {formatPrice(priceUpper)}</span>
                <span className="font-mono text-[var(--text-primary)]">{formatLiquidity(position.liquidity)}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
