import { usePoolStoreV2 } from '../../store/usePoolStoreV2'
import { Button } from '../ui/Button'
import { SlippageTableV2 } from './SlippageTableV2'

function formatNumber(num: number): string {
  if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B'
  if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M'
  if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K'
  if (num >= 1) return num.toFixed(4)
  if (num >= 0.0001) return num.toFixed(6)
  return num.toExponential(2)
}

export function SwapTabV2() {
  const {
    tokenA,
    tokenB,
    reserve0,
    reserve1,
    fee,
    swapAmount,
    swapDirection,
    setSwapAmount,
    setSwapDirection,
    simulateSwap,
    executeSwap,
  } = usePoolStoreV2()

  const simulation = simulateSwap()

  const inputToken = swapDirection === 'aToB' ? tokenA : tokenB
  const outputToken = swapDirection === 'aToB' ? tokenB : tokenA

  const handleSwap = () => {
    const result = executeSwap()
    if (result) {
      console.log('Swap executed:', result)
    }
  }

  const toggleDirection = () => {
    setSwapDirection(swapDirection === 'aToB' ? 'bToA' : 'aToB')
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Left: Swap Form */}
      <div className="space-y-4">
        <div className="p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-primary)] space-y-4">
          <h3 className="text-sm font-medium text-[var(--text-primary)]">Swap</h3>

          {/* Input */}
          <div className="p-3 rounded-lg bg-[var(--bg-tertiary)]">
            <div className="flex justify-between mb-1">
              <span className="text-xs text-[var(--text-muted)]">You pay</span>
              <span className="text-xs text-[var(--text-muted)]">
                Balance: {formatNumber(swapDirection === 'aToB' ? reserve0 : reserve1)}
              </span>
            </div>
            <div className="flex gap-2">
              <input
                type="number"
                value={swapAmount}
                onChange={(e) => setSwapAmount(e.target.value)}
                placeholder="0.0"
                className="flex-1 bg-transparent text-xl font-mono text-[var(--text-primary)] focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <span className="text-lg font-medium text-[var(--text-primary)]">{inputToken.symbol}</span>
            </div>
          </div>

          {/* Swap direction button */}
          <div className="flex justify-center">
            <button
              onClick={toggleDirection}
              className="p-2 rounded-full bg-[var(--bg-tertiary)] hover:bg-[var(--neon-blue)]/20 transition-colors"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
              </svg>
            </button>
          </div>

          {/* Output */}
          <div className="p-3 rounded-lg bg-[var(--bg-tertiary)]">
            <div className="flex justify-between mb-1">
              <span className="text-xs text-[var(--text-muted)]">You receive</span>
            </div>
            <div className="flex gap-2">
              <span className="flex-1 text-xl font-mono text-[var(--neon-green)]">
                {simulation ? formatNumber(simulation.amountOut) : '0.0'}
              </span>
              <span className="text-lg font-medium text-[var(--text-primary)]">{outputToken.symbol}</span>
            </div>
          </div>

          {/* Swap details */}
          {simulation && parseFloat(swapAmount) > 0 && (
            <div className="p-3 rounded-lg bg-[var(--bg-tertiary)] space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Rate</span>
                <span className="font-mono">
                  1 {inputToken.symbol} = {formatNumber(simulation.amountOut / parseFloat(swapAmount))} {outputToken.symbol}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Price Impact</span>
                <span className={`font-mono ${simulation.priceImpact > 1 ? 'text-[var(--neon-red)]' : 'text-[var(--neon-green)]'}`}>
                  {simulation.priceImpact.toFixed(2)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Fee ({(fee / 10000).toFixed(2)}%)</span>
                <span className="font-mono">
                  {formatNumber(parseFloat(swapAmount) * fee / 1000000)} {inputToken.symbol}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">New Price</span>
                <span className="font-mono">
                  {formatNumber(simulation.newPrice)} {tokenB.symbol}/{tokenA.symbol}
                </span>
              </div>
            </div>
          )}

          <Button
            onClick={handleSwap}
            className="w-full"
            disabled={!simulation || parseFloat(swapAmount) <= 0}
          >
            Swap
          </Button>
        </div>
      </div>

      {/* Right: Impact Table */}
      <SlippageTableV2 />
    </div>
  )
}
