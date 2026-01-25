import { usePoolStoreV2 } from '../../store/usePoolStoreV2'
import { Input } from '../ui/Input'
import { Button } from '../ui/Button'

function formatNumber(num: number): string {
  if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B'
  if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M'
  if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K'
  if (num >= 1) return num.toFixed(2)
  if (num >= 0.0001) return num.toFixed(4)
  return num.toFixed(6)
}

export function LiquidityTabV2() {
  const {
    tokenA,
    tokenB,
    reserve0,
    reserve1,
    totalSupply,
    price,
    positions,
    amount0Input,
    amount1Input,
    calculateAmount0FromAmount1,
    calculateAmount1FromAmount0,
    addLiquidity,
    removeLiquidity,
  } = usePoolStoreV2()

  // Calculate LP preview
  const amt0 = parseFloat(amount0Input) || 0
  const amt1 = parseFloat(amount1Input) || 0
  let lpPreview = 0
  let sharePreview = 0

  if (amt0 > 0 && amt1 > 0 && totalSupply > 0) {
    const ratio0 = amt0 / reserve0
    const ratio1 = amt1 / reserve1
    lpPreview = Math.min(ratio0, ratio1) * totalSupply
    sharePreview = (lpPreview / (totalSupply + lpPreview)) * 100
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Left: Add Liquidity */}
      <div className="space-y-4">
        {/* Pool Stats */}
        <div className="p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-primary)]">
          <h3 className="text-sm font-medium text-[var(--text-muted)] mb-3">Pool Reserves</h3>

          {/* Curve Visualization */}
          <div className="mb-4">
            <svg viewBox="0 0 200 120" className="w-full h-28">
              <defs>
                <linearGradient id="v2CurveGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="var(--neon-blue)" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="var(--neon-cyan)" stopOpacity="0.8" />
                </linearGradient>
              </defs>

              {/* Grid */}
              <g opacity="0.1">
                {[0.25, 0.5, 0.75].map(r => (
                  <line key={r} x1="20" y1={15 + 90 * r} x2="180" y2={15 + 90 * r} stroke="currentColor" strokeDasharray="2,4" />
                ))}
              </g>

              {/* Curve */}
              <path
                d={(() => {
                  const k = 100 * 100
                  const points: string[] = []
                  for (let i = 0; i <= 50; i++) {
                    const x = 20 + (i / 50) * 160
                    const xVal = 10 + (i / 50) * 190
                    const yVal = k / xVal
                    const y = 105 - Math.min(90, (yVal / 200) * 90)
                    points.push(`${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`)
                  }
                  return points.join(' ')
                })()}
                fill="none"
                stroke="url(#v2CurveGrad)"
                strokeWidth="2.5"
                strokeLinecap="round"
              />

              {/* Current position */}
              {(() => {
                const k = 100 * 100
                const xRatio = reserve0 / (reserve0 + reserve1 / price)
                const x = 20 + Math.min(0.9, Math.max(0.1, xRatio)) * 160
                const xVal = 10 + Math.min(0.9, Math.max(0.1, xRatio)) * 190
                const yVal = k / xVal
                const y = 105 - Math.min(90, (yVal / 200) * 90)
                return (
                  <g>
                    <circle cx={x} cy={y} r="6" fill="var(--neon-green)" opacity="0.8" />
                    <circle cx={x} cy={y} r="3" fill="white" />
                  </g>
                )
              })()}

              {/* Labels */}
              <text x="100" y="118" textAnchor="middle" fontSize="8" fill="var(--text-muted)">{tokenA.symbol}</text>
              <text x="8" y="60" textAnchor="middle" fontSize="8" fill="var(--text-muted)" transform="rotate(-90, 8, 60)">{tokenB.symbol}</text>
            </svg>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2 rounded bg-[var(--bg-tertiary)]">
              <div className="text-[10px] text-[var(--text-muted)]">{tokenA.symbol}</div>
              <div className="font-mono">{formatNumber(reserve0)}</div>
            </div>
            <div className="p-2 rounded bg-[var(--bg-tertiary)]">
              <div className="text-[10px] text-[var(--text-muted)]">{tokenB.symbol}</div>
              <div className="font-mono">{formatNumber(reserve1)}</div>
            </div>
            <div className="p-2 rounded bg-[var(--bg-tertiary)]">
              <div className="text-[10px] text-[var(--text-muted)]">Price</div>
              <div className="font-mono">{formatNumber(price)}</div>
            </div>
            <div className="p-2 rounded bg-[var(--bg-tertiary)]">
              <div className="text-[10px] text-[var(--text-muted)]">Total LP</div>
              <div className="font-mono">{formatNumber(totalSupply)}</div>
            </div>
          </div>
        </div>

        {/* Add Liquidity Form */}
        <div className="p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-primary)] space-y-3">
          <h3 className="text-sm font-medium text-[var(--text-primary)]">Add Liquidity</h3>

          <div className="p-2 rounded bg-[var(--neon-blue)]/10 border border-[var(--neon-blue)]/20 text-[10px] text-[var(--neon-blue)]">
            V2: Must add both tokens in current ratio
          </div>

          <Input
            label={tokenA.symbol}
            type="number"
            value={amount0Input}
            onChange={(e) => calculateAmount1FromAmount0(e.target.value)}
            placeholder="0.0"
            step="any"
          />

          <Input
            label={tokenB.symbol}
            type="number"
            value={amount1Input}
            onChange={(e) => calculateAmount0FromAmount1(e.target.value)}
            placeholder="0.0"
            step="any"
          />

          {lpPreview > 0 && (
            <div className="p-2 rounded bg-[var(--bg-tertiary)] space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">LP Tokens</span>
                <span className="font-mono text-[var(--neon-green)]">{formatNumber(lpPreview)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Pool Share</span>
                <span className="font-mono text-[var(--neon-cyan)]">{sharePreview.toFixed(2)}%</span>
              </div>
            </div>
          )}

          <Button onClick={() => addLiquidity()} className="w-full" disabled={amt0 <= 0 || amt1 <= 0}>
            Add Liquidity
          </Button>
        </div>
      </div>

      {/* Right: Positions */}
      <div className="p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-primary)]">
        <h3 className="text-sm font-medium text-[var(--text-primary)] mb-3">
          Your Positions ({positions.length})
        </h3>

        {positions.length === 0 ? (
          <div className="py-8 text-center">
            <div className="text-3xl mb-2 opacity-50">💧</div>
            <p className="text-sm text-[var(--text-muted)]">No liquidity positions yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {positions.map((pos) => {
              // Calculate current value based on pool ratio
              const currentShare = pos.lpTokens / totalSupply
              const currentAmount0 = reserve0 * currentShare
              const currentAmount1 = reserve1 * currentShare

              return (
                <div
                  key={pos.id}
                  className="p-3 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-primary)]"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--neon-green)]/20 text-[var(--neon-green)]">
                        {pos.sharePercent.toFixed(2)}% share
                      </span>
                    </div>
                    <button
                      onClick={() => removeLiquidity(pos.id)}
                      className="p-1 text-[var(--text-muted)] hover:text-[var(--neon-red)] transition-colors"
                      title="Remove"
                    >
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                        <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <div className="text-[10px] text-[var(--text-muted)]">LP Tokens</div>
                      <div className="font-mono">{formatNumber(pos.lpTokens)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-[var(--text-muted)]">Current Value</div>
                      <div className="font-mono text-[var(--neon-cyan)]">
                        {formatNumber(currentAmount0)} {tokenA.symbol}
                      </div>
                      <div className="font-mono text-[var(--neon-cyan)]">
                        {formatNumber(currentAmount1)} {tokenB.symbol}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
