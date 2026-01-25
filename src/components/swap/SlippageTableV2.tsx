import { useMemo } from 'react'
import { usePoolStoreV2 } from '../../store/usePoolStoreV2'
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card'

interface SlippageRow {
  percent: number
  amountIn: number
  amountOut: number
  priceImpact: number
  effectivePrice: number
}

function formatNumber(num: number): string {
  if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B'
  if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M'
  if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K'
  if (num >= 1) return num.toFixed(4)
  if (num >= 0.0001) return num.toFixed(6)
  return num.toExponential(2)
}

export function SlippageTableV2() {
  const { initialized, reserve0, reserve1, tokenA, tokenB, swapDirection, swapAmount, fee } = usePoolStoreV2()

  const rows = useMemo(() => {
    if (!initialized || reserve0 <= 0 || reserve1 <= 0) return []

    const baseAmount = parseFloat(swapAmount)
    if (!baseAmount || isNaN(baseAmount) || baseAmount <= 0) return []

    const percentages = [25, 50, 75, 100]
    const newRows: SlippageRow[] = []
    const feeMultiplier = 1 - fee / 1000000

    const spotPrice = swapDirection === 'aToB' ? reserve1 / reserve0 : reserve0 / reserve1

    for (const percent of percentages) {
      const amountIn = baseAmount * (percent / 100)
      const amountInWithFee = amountIn * feeMultiplier

      let amountOut: number

      if (swapDirection === 'aToB') {
        // dy = y * dx / (x + dx)
        amountOut = (reserve1 * amountInWithFee) / (reserve0 + amountInWithFee)
        // Check if we'd drain the pool
        if (amountOut >= reserve1 * 0.99) continue
      } else {
        amountOut = (reserve0 * amountInWithFee) / (reserve1 + amountInWithFee)
        if (amountOut >= reserve0 * 0.99) continue
      }

      const effectivePrice = amountOut / amountIn
      const priceImpact = Math.abs((effectivePrice - spotPrice) / spotPrice) * 100

      newRows.push({
        percent,
        amountIn,
        amountOut,
        priceImpact,
        effectivePrice,
      })
    }

    return newRows
  }, [initialized, reserve0, reserve1, swapDirection, swapAmount, fee])

  const tokenIn = swapDirection === 'aToB' ? tokenA : tokenB
  const tokenOut = swapDirection === 'aToB' ? tokenB : tokenA

  if (!initialized || reserve0 <= 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Price Impact Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-[var(--text-muted)] text-sm">
            Initialize pool to see analysis
          </div>
        </CardContent>
      </Card>
    )
  }

  if (rows.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Price Impact Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-[var(--text-muted)] text-sm">
            Enter swap amount to see breakdown
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Price Impact Analysis</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[var(--text-muted)] text-xs">
                <th className="text-left py-1.5 px-2">Size</th>
                <th className="text-right py-1.5 px-2">{tokenIn.symbol} In</th>
                <th className="text-right py-1.5 px-2">{tokenOut.symbol} Out</th>
                <th className="text-right py-1.5 px-2">Rate</th>
                <th className="text-right py-1.5 px-2">Impact</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.percent}
                  className={`border-t border-[var(--border-primary)] hover:bg-[var(--bg-tertiary)] ${
                    row.percent === 100 ? 'bg-[var(--neon-blue)]/5' : ''
                  }`}
                >
                  <td className="py-1.5 px-2 text-[var(--text-secondary)]">
                    {row.percent}%
                    {row.percent === 100 && <span className="text-[10px] text-[var(--neon-blue)] ml-1">current</span>}
                  </td>
                  <td className="py-1.5 px-2 text-right font-mono text-[var(--text-primary)] text-xs">
                    {formatNumber(row.amountIn)}
                  </td>
                  <td className="py-1.5 px-2 text-right font-mono text-[var(--text-primary)] text-xs">
                    {formatNumber(row.amountOut)}
                  </td>
                  <td className="py-1.5 px-2 text-right font-mono text-[var(--text-muted)] text-xs">
                    {formatNumber(row.effectivePrice)}
                  </td>
                  <td
                    className={`py-1.5 px-2 text-right font-mono text-xs ${
                      row.priceImpact > 10
                        ? 'text-[var(--neon-red)]'
                        : row.priceImpact > 5
                          ? 'text-yellow-500'
                          : 'text-[var(--neon-green)]'
                    }`}
                  >
                    {row.priceImpact.toFixed(2)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* V2 Formula explanation */}
        <div className="mt-4 p-3 rounded-lg bg-[var(--bg-tertiary)] text-xs text-[var(--text-muted)]">
          <div className="font-medium mb-1">V2 Price Impact Formula:</div>
          <div className="font-mono text-[10px]">
            impact = |effective_price - spot_price| / spot_price
          </div>
          <div className="mt-1 text-[10px]">
            In V2, larger swaps cause exponentially higher price impact due to the constant product curve.
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
