import { usePoolStore } from '../../store/usePoolStore'
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card'
import { Input } from '../ui/Input'
import { Button } from '../ui/Button'
import { formatAmount, sqrtPriceX96ToPrice } from '../../core'
import JSBI from 'jsbi'

export function SwapForm() {
  const {
    pool,
    swapDirection,
    swapAmount,
    swapResult,
    setSwapDirection,
    setSwapAmount,
    executeSwap,
    simulateSwap,
  } = usePoolStore()

  const tokenIn = swapDirection === 'zeroForOne' ? pool.tokenA : pool.tokenB
  const tokenOut = swapDirection === 'zeroForOne' ? pool.tokenB : pool.tokenA

  const handleDirectionToggle = () => {
    setSwapDirection(swapDirection === 'zeroForOne' ? 'oneForZero' : 'zeroForOne')
  }

  // Calculate effective price and slippage
  let effectivePrice = 0
  let slippagePercent = 0
  let insufficientLiquidity = false
  const spotPrice = pool.getCurrentPrice()

  if (swapResult && JSBI.greaterThan(swapResult.amountIn, JSBI.BigInt(0))) {
    // Normalize amounts by decimals
    const decimalsIn = swapDirection === 'zeroForOne' ? pool.tokenA.decimals : pool.tokenB.decimals
    const decimalsOut = swapDirection === 'zeroForOne' ? pool.tokenB.decimals : pool.tokenA.decimals

    const amountInNum = JSBI.toNumber(swapResult.amountIn) / Math.pow(10, decimalsIn)
    const amountOutNum = JSBI.toNumber(swapResult.amountOut) / Math.pow(10, decimalsOut)

    // Check for insufficient liquidity
    if (amountOutNum <= 0 || !Number.isFinite(amountOutNum)) {
      insufficientLiquidity = true
    } else {
      // effectivePrice = how much tokenOut per 1 tokenIn
      effectivePrice = amountOutNum / amountInNum

      // spotPrice is tokenB/tokenA, so adjust based on direction
      const expectedPrice = swapDirection === 'zeroForOne' ? spotPrice : 1 / spotPrice
      slippagePercent = Math.abs((effectivePrice - expectedPrice) / expectedPrice) * 100

      // Check for extreme slippage (>99% likely means insufficient liquidity)
      if (slippagePercent > 99 || !Number.isFinite(slippagePercent)) {
        insufficientLiquidity = true
      }
    }
  } else if (swapResult && JSBI.equal(swapResult.amountOut, JSBI.BigInt(0))) {
    insufficientLiquidity = true
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Swap Simulation</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* Direction toggle - compact */}
          <div className="flex items-center gap-2">
            <div className="flex-1 px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] flex items-center justify-between">
              <span className="text-xs text-[var(--text-muted)]">From</span>
              <span className="font-medium text-sm text-[var(--text-primary)]">{tokenIn.symbol}</span>
            </div>

            <button
              onClick={handleDirectionToggle}
              className="p-1.5 rounded-lg bg-[var(--bg-tertiary)] hover:bg-[var(--bg-accent)] transition-colors"
            >
              <svg
                className="w-4 h-4 text-[var(--text-secondary)]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                />
              </svg>
            </button>

            <div className="flex-1 px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] flex items-center justify-between">
              <span className="text-xs text-[var(--text-muted)]">To</span>
              <span className="font-medium text-sm text-[var(--text-primary)]">{tokenOut.symbol}</span>
            </div>
          </div>

          {/* Amount input */}
          <Input
            label={`Amount In (${tokenIn.symbol})`}
            type="number"
            value={swapAmount}
            onChange={(e) => setSwapAmount(e.target.value)}
            onBlur={simulateSwap}
            suffix={tokenIn.symbol}
            step="any"
          />

          {/* Simulation result */}
          {swapResult && !insufficientLiquidity && (
            <div className="space-y-3 p-4 rounded-xl bg-[var(--bg-tertiary)]">
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Amount Out</span>
                <span className="font-mono text-[var(--text-primary)]">
                  {formatAmount(swapResult.amountOut, tokenOut.decimals)} {tokenOut.symbol}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Effective Price</span>
                <span className="font-mono text-[var(--text-primary)]">
                  {effectivePrice.toFixed(6)} {tokenOut.symbol}/{tokenIn.symbol}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Price Impact</span>
                <span
                  className={`font-mono ${
                    slippagePercent > 5
                      ? 'text-[var(--neon-red)]'
                      : slippagePercent > 1
                        ? 'text-yellow-500'
                        : 'text-[var(--neon-green)]'
                  }`}
                >
                  {slippagePercent.toFixed(4)}%
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">New Price</span>
                <span className="font-mono text-[var(--text-primary)]">
                  {(() => {
                    const rawPrice = sqrtPriceX96ToPrice(swapResult.sqrtPriceX96After)
                    const decimalAdj = Math.pow(10, pool.tokenB.decimals - pool.tokenA.decimals)
                    return (rawPrice / decimalAdj).toFixed(6)
                  })()}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">New Tick</span>
                <span className="font-mono text-[var(--text-primary)]">
                  {swapResult.tickAfter}
                </span>
              </div>
            </div>
          )}

          {/* Warning for insufficient liquidity */}
          {insufficientLiquidity && (
            <div className="p-3 rounded-lg bg-[var(--neon-red)]/10 text-[var(--neon-red)] text-sm">
              Insufficient liquidity for this swap size. Add more liquidity or reduce amount.
            </div>
          )}

          {/* Warning for high slippage */}
          {!insufficientLiquidity && slippagePercent > 5 && (
            <div className="p-3 rounded-lg bg-[var(--neon-red)]/10 text-[var(--neon-red)] text-sm">
              High price impact! Consider reducing swap size.
            </div>
          )}

          <Button onClick={executeSwap} className="w-full">
            Execute Swap
          </Button>

          <p className="text-xs text-center text-[var(--text-muted)]">
            This will update the pool state. Use simulation preview above to test without changes.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
