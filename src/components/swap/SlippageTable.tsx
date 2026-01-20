import { useEffect, useState } from 'react'
import { usePoolStore } from '../../store/usePoolStore'
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card'
import { formatAmount, parseAmount } from '../../core'
import JSBI from 'jsbi'

interface SlippageRow {
  percent: number
  amountIn: string
  amountOut: string
  slippage: number
}

export function SlippageTable() {
  const { pool, swapDirection, swapAmount } = usePoolStore()
  const [rows, setRows] = useState<SlippageRow[]>([])

  const tokenIn = swapDirection === 'zeroForOne' ? pool.tokenA : pool.tokenB
  const tokenOut = swapDirection === 'zeroForOne' ? pool.tokenB : pool.tokenA

  useEffect(() => {
    if (!pool.initialized || JSBI.equal(pool.liquidity, JSBI.BigInt(0))) {
      setRows([])
      return
    }

    const baseAmount = parseFloat(swapAmount)
    if (!baseAmount || isNaN(baseAmount) || baseAmount <= 0) {
      setRows([])
      return
    }

    const percentages = [25, 50, 75, 100]
    const newRows: SlippageRow[] = []
    const zeroForOne = swapDirection === 'zeroForOne'
    const spotPrice = pool.getCurrentPrice()
    const expectedPrice = zeroForOne ? spotPrice : 1 / spotPrice

    for (const percent of percentages) {
      const amount = baseAmount * (percent / 100)

      try {
        const amountInJSBI = parseAmount(amount.toString(), tokenIn.decimals)
        const result = pool.simulateSwap({
          zeroForOne,
          amountSpecified: amountInJSBI,
        })

        if (JSBI.greaterThan(result.amountOut, JSBI.BigInt(0))) {
          // Calculate effective price with decimal normalization
          const amountInNorm = JSBI.toNumber(result.amountIn) / Math.pow(10, tokenIn.decimals)
          const amountOutNorm = JSBI.toNumber(result.amountOut) / Math.pow(10, tokenOut.decimals)
          const effectivePrice = amountOutNorm / amountInNorm
          const slippage = Math.abs((effectivePrice - expectedPrice) / expectedPrice) * 100

          newRows.push({
            percent,
            amountIn: formatAmount(result.amountIn, tokenIn.decimals),
            amountOut: formatAmount(result.amountOut, tokenOut.decimals),
            slippage,
          })
        }
      } catch {
        // Skip if simulation fails
      }
    }

    setRows(newRows)
  }, [pool.initialized, pool.liquidity, swapDirection, swapAmount, tokenIn.decimals, tokenOut.decimals])

  if (!pool.initialized || JSBI.equal(pool.liquidity, JSBI.BigInt(0))) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Swap Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-[var(--text-muted)] text-sm">
            Add liquidity to see breakdown
          </div>
        </CardContent>
      </Card>
    )
  }

  if (rows.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Swap Breakdown</CardTitle>
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
        <CardTitle>Swap Breakdown</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[var(--text-muted)] text-xs">
                <th className="text-left py-1.5 px-2">%</th>
                <th className="text-right py-1.5 px-2">{tokenIn.symbol} In</th>
                <th className="text-right py-1.5 px-2">{tokenOut.symbol} Out</th>
                <th className="text-right py-1.5 px-2">Impact</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.percent}
                  className="border-t border-[var(--border-primary)] hover:bg-[var(--bg-tertiary)]"
                >
                  <td className="py-1.5 px-2 text-[var(--text-secondary)]">{row.percent}%</td>
                  <td className="py-1.5 px-2 text-right font-mono text-[var(--text-primary)] text-xs">
                    {row.amountIn}
                  </td>
                  <td className="py-1.5 px-2 text-right font-mono text-[var(--text-primary)] text-xs">
                    {row.amountOut}
                  </td>
                  <td
                    className={`py-1.5 px-2 text-right font-mono text-xs ${
                      row.slippage > 10
                        ? 'text-[var(--neon-red)]'
                        : row.slippage > 5
                          ? 'text-yellow-500'
                          : 'text-[var(--neon-green)]'
                    }`}
                  >
                    {row.slippage.toFixed(2)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
