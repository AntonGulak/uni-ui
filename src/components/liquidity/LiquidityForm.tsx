import { useCallback, useRef, useEffect, useState } from 'react'
import { usePoolStore } from '../../store/usePoolStore'
import { Input } from '../ui/Input'
import { Button } from '../ui/Button'
import { LiquidityCurve } from './LiquidityCurve'
import {
  tickToPrice,
  formatAmountRaw,
  parseAmount,
  TickMath,
  SqrtPriceMath,
  maxLiquidityForAmount0Precise,
  maxLiquidityForAmount1,
} from '../../core'
import JSBI from 'jsbi'

const MIN_TICK = TickMath.MIN_TICK
const MAX_TICK = TickMath.MAX_TICK

function formatPrice(price: number, tick?: number): string {
  // Handle extreme ticks - show infinity symbols
  if (tick !== undefined) {
    if (tick <= MIN_TICK + 1000) return '≈0'
    if (tick >= MAX_TICK - 1000) return '∞'
  }

  if (!isFinite(price) || isNaN(price)) return '—'
  if (price <= 0) return '0'
  if (price >= 1e15) return '∞'
  if (price <= 1e-15) return '≈0'
  if (price >= 1e12) return (price / 1e12).toFixed(1) + 'T'
  if (price >= 1e9) return (price / 1e9).toFixed(1) + 'B'
  if (price >= 1e6) return (price / 1e6).toFixed(1) + 'M'
  if (price >= 1000) return price.toFixed(0)
  if (price >= 1) return price.toFixed(2)
  if (price >= 0.0001) return price.toFixed(4)
  if (price >= 1e-8) return price.toExponential(1)
  return '≈0'
}

interface LiquidityFormProps {
  onSuccess?: () => void
}

export function LiquidityForm({ onSuccess }: LiquidityFormProps = {}) {
  const {
    pool,
    tickLower: storeLower,
    tickUpper: storeUpper,
    amount0,
    amount1,
    setTickLower: setStoreLower,
    setTickUpper: setStoreUpper,
    setAmount0,
    setAmount1,
    addLiquidity,
  } = usePoolStore()

  const tickSpacing = pool.tickSpacing
  const currentTick = pool.tick
  const decimalAdjustment = Math.pow(10, pool.tokenB.decimals - pool.tokenA.decimals)

  // Parse stored values
  const parseLower = parseInt(storeLower)
  const parseUpper = parseInt(storeUpper)

  const isLowerValid = !isNaN(parseLower) && parseLower >= MIN_TICK && parseLower <= MAX_TICK
  const isUpperValid = !isNaN(parseUpper) && parseUpper >= MIN_TICK && parseUpper <= MAX_TICK

  // Default range ±10%
  const defaultRange = Math.round(1000 / tickSpacing) * tickSpacing
  const defaultLower = Math.round((currentTick - defaultRange) / tickSpacing) * tickSpacing
  const defaultUpper = Math.round((currentTick + defaultRange) / tickSpacing) * tickSpacing

  const tickLower = isLowerValid ? Math.round(parseLower / tickSpacing) * tickSpacing : defaultLower
  const tickUpper = isUpperValid ? Math.round(parseUpper / tickSpacing) * tickSpacing : defaultUpper

  const effectiveLower = Math.min(tickLower, tickUpper - tickSpacing)
  const effectiveUpper = Math.max(tickUpper, tickLower + tickSpacing)

  // Local inputs
  const [lowerInput, setLowerInput] = useState(String(effectiveLower))
  const [upperInput, setUpperInput] = useState(String(effectiveUpper))

  useEffect(() => {
    if (isLowerValid) setLowerInput(storeLower)
  }, [storeLower, isLowerValid])

  useEffect(() => {
    if (isUpperValid) setUpperInput(storeUpper)
  }, [storeUpper, isUpperValid])

  // Init on mount
  useEffect(() => {
    if (!isLowerValid || !isUpperValid || parseLower >= parseUpper) {
      setStoreLower(String(defaultLower))
      setStoreUpper(String(defaultUpper))
      setLowerInput(String(defaultLower))
      setUpperInput(String(defaultUpper))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const priceLower = tickToPrice(effectiveLower) / decimalAdjustment
  const priceUpper = tickToPrice(effectiveUpper) / decimalAdjustment

  const deposit0Disabled = currentTick >= effectiveUpper
  const deposit1Disabled = currentTick <= effectiveLower
  const isInRange = !deposit0Disabled && !deposit1Disabled
  const invalidRange = effectiveLower >= effectiveUpper

  const liquidityRef = useRef<JSBI | null>(null)

  const handleAmount0Change = (value: string) => {
    setAmount0(value)
    const num = parseFloat(value)
    if (!value || isNaN(num) || num <= 0 || invalidRange || deposit0Disabled) {
      liquidityRef.current = null
      return
    }
    try {
      const sqrtUpper = TickMath.getSqrtRatioAtTick(effectiveUpper)
      const amt = parseAmount(value, pool.tokenA.decimals)
      const liq = maxLiquidityForAmount0Precise(pool.sqrtPriceX96, sqrtUpper, amt)
      liquidityRef.current = liq
      if (!deposit1Disabled) {
        const sqrtLower = TickMath.getSqrtRatioAtTick(effectiveLower)
        const amt1 = SqrtPriceMath.getAmount1Delta(sqrtLower, pool.sqrtPriceX96, liq, true)
        setAmount1(formatAmountRaw(amt1, pool.tokenB.decimals))
      }
    } catch (e) { console.error(e) }
  }

  const handleAmount1Change = (value: string) => {
    setAmount1(value)
    const num = parseFloat(value)
    if (!value || isNaN(num) || num <= 0 || invalidRange || deposit1Disabled) {
      liquidityRef.current = null
      return
    }
    try {
      const sqrtLower = TickMath.getSqrtRatioAtTick(effectiveLower)
      const amt = parseAmount(value, pool.tokenB.decimals)
      const liq = maxLiquidityForAmount1(sqrtLower, pool.sqrtPriceX96, amt)
      liquidityRef.current = liq
      if (!deposit0Disabled) {
        const sqrtUpper = TickMath.getSqrtRatioAtTick(effectiveUpper)
        const amt0 = SqrtPriceMath.getAmount0Delta(pool.sqrtPriceX96, sqrtUpper, liq, true)
        setAmount0(formatAmountRaw(amt0, pool.tokenA.decimals))
      }
    } catch (e) { console.error(e) }
  }

  // Recalc on range change
  useEffect(() => {
    if (invalidRange) return
    try {
      const sqrtLower = TickMath.getSqrtRatioAtTick(effectiveLower)
      const sqrtUpper = TickMath.getSqrtRatioAtTick(effectiveUpper)

      let liq = liquidityRef.current
      if (!liq) {
        const amt0Num = parseFloat(amount0)
        const amt1Num = parseFloat(amount1)
        if (!deposit0Disabled && amt0Num > 0) {
          liq = maxLiquidityForAmount0Precise(pool.sqrtPriceX96, sqrtUpper, parseAmount(amount0, pool.tokenA.decimals))
          liquidityRef.current = liq
        } else if (!deposit1Disabled && amt1Num > 0) {
          liq = maxLiquidityForAmount1(sqrtLower, pool.sqrtPriceX96, parseAmount(amount1, pool.tokenB.decimals))
          liquidityRef.current = liq
        }
      }
      if (!liq) return

      if (!deposit0Disabled) {
        setAmount0(formatAmountRaw(SqrtPriceMath.getAmount0Delta(pool.sqrtPriceX96, sqrtUpper, liq, true), pool.tokenA.decimals))
      } else {
        setAmount0('0')
      }
      if (!deposit1Disabled) {
        setAmount1(formatAmountRaw(SqrtPriceMath.getAmount1Delta(sqrtLower, pool.sqrtPriceX96, liq, true), pool.tokenB.decimals))
      } else {
        setAmount1('0')
      }
    } catch (e) { console.error(e) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveLower, effectiveUpper])

  const commitLower = useCallback(() => {
    const num = parseInt(lowerInput)
    if (isNaN(num)) {
      setLowerInput(String(effectiveLower))
      return
    }
    const clamped = Math.max(MIN_TICK, Math.min(MAX_TICK, num))
    const aligned = Math.round(clamped / tickSpacing) * tickSpacing
    const final = Math.min(aligned, effectiveUpper - tickSpacing)
    setStoreLower(String(final))
    setLowerInput(String(final))
  }, [lowerInput, effectiveLower, effectiveUpper, tickSpacing, setStoreLower])

  const commitUpper = useCallback(() => {
    const num = parseInt(upperInput)
    if (isNaN(num)) {
      setUpperInput(String(effectiveUpper))
      return
    }
    const clamped = Math.max(MIN_TICK, Math.min(MAX_TICK, num))
    const aligned = Math.round(clamped / tickSpacing) * tickSpacing
    const final = Math.max(aligned, effectiveLower + tickSpacing)
    setStoreUpper(String(final))
    setUpperInput(String(final))
  }, [upperInput, effectiveLower, effectiveUpper, tickSpacing, setStoreUpper])

  const adjustTick = useCallback((type: 'lower' | 'upper', dir: 1 | -1) => {
    if (type === 'lower') {
      const next = effectiveLower + dir * tickSpacing
      if (next >= MIN_TICK && next < effectiveUpper) {
        setStoreLower(String(next))
        setLowerInput(String(next))
      }
    } else {
      const next = effectiveUpper + dir * tickSpacing
      if (next <= MAX_TICK && next > effectiveLower) {
        setStoreUpper(String(next))
        setUpperInput(String(next))
      }
    }
  }, [effectiveLower, effectiveUpper, tickSpacing, setStoreLower, setStoreUpper])

  const handleRangeChange = useCallback((lower: number, upper: number) => {
    setStoreLower(String(lower))
    setStoreUpper(String(upper))
    setLowerInput(String(lower))
    setUpperInput(String(upper))
  }, [setStoreLower, setStoreUpper])

  const handleAddLiquidity = () => {
    const result = addLiquidity()
    if (result) onSuccess?.()
  }

  return (
    <div className="flex gap-4">
      {/* Chart */}
      <div className="flex-1 min-w-0">
        <div className="rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-primary)] p-3">
          <LiquidityCurve
            tickLower={effectiveLower}
            tickUpper={effectiveUpper}
            currentTick={currentTick}
            tickSpacing={tickSpacing}
            onRangeChange={handleRangeChange}
          />
        </div>
      </div>

      {/* Controls */}
      <div className="w-[200px] flex-shrink-0 space-y-2">
        {/* MIN */}
        <div className="p-2 rounded-lg bg-[var(--bg-tertiary)]">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-[var(--neon-pink)] uppercase">Min Tick</span>
            <span className="text-[10px] text-[var(--text-muted)]">{formatPrice(priceLower, effectiveLower)}</span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => adjustTick('lower', -1)} className="w-7 h-7 rounded bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] text-sm font-medium">−</button>
            <input
              type="number"
              value={lowerInput}
              onChange={(e) => setLowerInput(e.target.value)}
              onBlur={commitLower}
              onKeyDown={(e) => e.key === 'Enter' && commitLower()}
              className="flex-1 font-mono text-xs text-center bg-[var(--bg-secondary)] text-[var(--text-primary)] rounded px-1 py-1.5 focus:outline-none focus:ring-1 focus:ring-[var(--neon-pink)] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <button onClick={() => adjustTick('lower', 1)} className="w-7 h-7 rounded bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] text-sm font-medium">+</button>
          </div>
        </div>

        {/* MAX */}
        <div className="p-2 rounded-lg bg-[var(--bg-tertiary)]">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-[var(--neon-purple)] uppercase">Max Tick</span>
            <span className="text-[10px] text-[var(--text-muted)]">{formatPrice(priceUpper, effectiveUpper)}</span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => adjustTick('upper', -1)} className="w-7 h-7 rounded bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] text-sm font-medium">−</button>
            <input
              type="number"
              value={upperInput}
              onChange={(e) => setUpperInput(e.target.value)}
              onBlur={commitUpper}
              onKeyDown={(e) => e.key === 'Enter' && commitUpper()}
              className="flex-1 font-mono text-xs text-center bg-[var(--bg-secondary)] text-[var(--text-primary)] rounded px-1 py-1.5 focus:outline-none focus:ring-1 focus:ring-[var(--neon-purple)] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <button onClick={() => adjustTick('upper', 1)} className="w-7 h-7 rounded bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] text-sm font-medium">+</button>
          </div>
        </div>

        {/* Status */}
        {!invalidRange && (
          <div className={`px-2 py-1 rounded text-[10px] text-center ${isInRange ? 'bg-[var(--neon-green)]/10 text-[var(--neon-green)]' : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]'}`}>
            {isInRange ? 'In range' : deposit1Disabled ? `${pool.tokenA.symbol} only` : `${pool.tokenB.symbol} only`}
          </div>
        )}

        {/* Amounts */}
        <div className="space-y-1.5">
          <div className={deposit0Disabled ? 'opacity-40 pointer-events-none' : ''}>
            <Input label={pool.tokenA.symbol} type="number" value={amount0} onChange={(e) => handleAmount0Change(e.target.value)} placeholder="0.0" step="any" />
          </div>
          <div className={deposit1Disabled ? 'opacity-40 pointer-events-none' : ''}>
            <Input label={pool.tokenB.symbol} type="number" value={amount1} onChange={(e) => handleAmount1Change(e.target.value)} placeholder="0.0" step="any" />
          </div>
        </div>

        <Button onClick={handleAddLiquidity} className="w-full" disabled={invalidRange || (!parseFloat(amount0) && !parseFloat(amount1))}>
          {invalidRange ? 'Invalid Range' : 'Add Position'}
        </Button>
      </div>
    </div>
  )
}
