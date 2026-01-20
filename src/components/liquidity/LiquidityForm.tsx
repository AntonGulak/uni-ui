import { useState, useCallback, useRef } from 'react'
import { usePoolStore } from '../../store/usePoolStore'
import { Input } from '../ui/Input'
import { Button } from '../ui/Button'
import { RangeSlider } from '../ui/Slider'
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

interface LiquidityFormProps {
  onSuccess?: () => void
}

type Step = 'range' | 'amounts'

export function LiquidityForm({ onSuccess }: LiquidityFormProps = {}) {
  const {
    pool,
    tickLower,
    tickUpper,
    amount0,
    amount1,
    setTickLower,
    setTickUpper,
    setAmount0,
    setAmount1,
    addLiquidity,
  } = usePoolStore()

  const [step, setStep] = useState<Step>('range')
  const liquidityRef = useRef<JSBI | null>(null)

  const tickLowerNum = parseInt(tickLower) || 0
  const tickUpperNum = parseInt(tickUpper) || 0
  const tickSpacing = pool.tickSpacing
  const currentTick = pool.tick

  const decimalAdjustment = Math.pow(10, pool.tokenB.decimals - pool.tokenA.decimals)
  const priceLower = tickToPrice(tickLowerNum) / decimalAdjustment
  const priceUpper = tickToPrice(tickUpperNum) / decimalAdjustment

  const deposit0Disabled = currentTick >= tickUpperNum
  const deposit1Disabled = currentTick <= tickLowerNum
  const depositADisabled = deposit0Disabled
  const depositBDisabled = deposit1Disabled
  const isInRange = !depositADisabled && !depositBDisabled
  const invalidRange = tickLowerNum >= tickUpperNum

  // Handle amount0 input
  const handleAmount0Change = (value: string) => {
    setAmount0(value)

    const num = parseFloat(value)
    if (!value || isNaN(num) || num <= 0 || invalidRange || deposit0Disabled) {
      liquidityRef.current = null
      return
    }

    try {
      const sqrtUpper = TickMath.getSqrtRatioAtTick(tickUpperNum)
      const amt = parseAmount(value, pool.tokenA.decimals)
      const liq = maxLiquidityForAmount0Precise(pool.sqrtPriceX96, sqrtUpper, amt)
      liquidityRef.current = liq

      if (!deposit1Disabled) {
        const sqrtLower = TickMath.getSqrtRatioAtTick(tickLowerNum)
        const amt1 = SqrtPriceMath.getAmount1Delta(sqrtLower, pool.sqrtPriceX96, liq, true)
        setAmount1(formatAmountRaw(amt1, pool.tokenB.decimals))
      }
    } catch (e) { console.error(e) }
  }

  // Handle amount1 input
  const handleAmount1Change = (value: string) => {
    setAmount1(value)

    const num = parseFloat(value)
    if (!value || isNaN(num) || num <= 0 || invalidRange || deposit1Disabled) {
      liquidityRef.current = null
      return
    }

    try {
      const sqrtLower = TickMath.getSqrtRatioAtTick(tickLowerNum)
      const amt = parseAmount(value, pool.tokenB.decimals)
      const liq = maxLiquidityForAmount1(sqrtLower, pool.sqrtPriceX96, amt)
      liquidityRef.current = liq

      if (!deposit0Disabled) {
        const sqrtUpper = TickMath.getSqrtRatioAtTick(tickUpperNum)
        const amt0 = SqrtPriceMath.getAmount0Delta(pool.sqrtPriceX96, sqrtUpper, liq, true)
        setAmount0(formatAmountRaw(amt0, pool.tokenA.decimals))
      }
    } catch (e) { console.error(e) }
  }

  const adjustTick = useCallback((type: 'lower' | 'upper', direction: 1 | -1) => {
    const tick = type === 'lower' ? tickLowerNum : tickUpperNum
    const newTick = tick + direction * tickSpacing
    if (newTick < TickMath.MIN_TICK || newTick > TickMath.MAX_TICK) return
    if (type === 'lower' && newTick < tickUpperNum) setTickLower(String(newTick))
    if (type === 'upper' && newTick > tickLowerNum) setTickUpper(String(newTick))
  }, [tickLowerNum, tickUpperNum, tickSpacing, setTickLower, setTickUpper])

  const handleConfirmRange = () => {
    setStep('amounts')
  }

  const handleBack = () => {
    setStep('range')
    setAmount0('')
    setAmount1('')
    liquidityRef.current = null
  }

  const handleAddLiquidity = () => {
    const result = addLiquidity()
    if (result) {
      onSuccess?.()
    }
  }

  // Step 1: Range Selection
  if (step === 'range') {
    return (
      <div className="space-y-3">
        {/* Liquidity Curve Visualization */}
        <div className="rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-primary)] p-2 -mx-1">
          <LiquidityCurve
            tickLower={tickLowerNum}
            tickUpper={tickUpperNum}
            currentTick={currentTick}
            tickSpacing={tickSpacing}
            onRangeChange={(lower, upper) => {
              setTickLower(String(lower))
              setTickUpper(String(upper))
            }}
          />
        </div>

        {/* Tick Range */}
        <div className="space-y-2">
          <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Select Price Range</span>

          {/* Ticks aligned left-right */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <button onClick={() => adjustTick('lower', -1)} className="w-6 h-6 rounded bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] text-xs">−</button>
              <span className="font-mono text-[var(--text-primary)] min-w-[60px] text-center text-xs">{tickLowerNum.toLocaleString()}</span>
              <button onClick={() => adjustTick('lower', 1)} className="w-6 h-6 rounded bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] text-xs">+</button>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => adjustTick('upper', -1)} className="w-6 h-6 rounded bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] text-xs">−</button>
              <span className="font-mono text-[var(--text-primary)] min-w-[60px] text-center text-xs">{tickUpperNum.toLocaleString()}</span>
              <button onClick={() => adjustTick('upper', 1)} className="w-6 h-6 rounded bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] text-xs">+</button>
            </div>
          </div>

          {/* Price display below */}
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
            <span>{formatPrice(priceLower)}</span>
            <span>{pool.tokenB.symbol}/{pool.tokenA.symbol}</span>
            <span>{formatPrice(priceUpper)}</span>
          </div>

          {/* Tick Slider */}
          {(() => {
            const sliderMin = Math.ceil(TickMath.MIN_TICK / tickSpacing) * tickSpacing
            const sliderMax = Math.floor(TickMath.MAX_TICK / tickSpacing) * tickSpacing
            const sliderRange = sliderMax - sliderMin
            const currentTickPercent = ((currentTick - sliderMin) / sliderRange) * 100

            const reasonableTicks = Math.round(1000 / tickSpacing) * tickSpacing * 5
            const reasonableMin = Math.max(sliderMin, currentTick - reasonableTicks)
            const reasonableMax = Math.min(sliderMax, currentTick + reasonableTicks)
            const reasonableMinPercent = ((reasonableMin - sliderMin) / sliderRange) * 100
            const reasonableMaxPercent = ((reasonableMax - sliderMin) / sliderRange) * 100

            return (
              <div className="relative">
                <div
                  className="absolute top-[12px] h-2 rounded-full pointer-events-none z-0"
                  style={{
                    left: `${reasonableMinPercent}%`,
                    width: `${reasonableMaxPercent - reasonableMinPercent}%`,
                    background: 'linear-gradient(90deg, transparent 0%, rgba(76, 130, 251, 0.35) 15%, rgba(76, 130, 251, 0.35) 85%, transparent 100%)',
                  }}
                />
                <div
                  className="absolute top-[8px] h-4 w-px bg-[var(--text-primary)]/60 z-20 pointer-events-none"
                  style={{ left: `${Math.max(0, Math.min(100, currentTickPercent))}%` }}
                />
                <RangeSlider
                  minValue={tickLowerNum}
                  maxValue={tickUpperNum}
                  min={sliderMin}
                  max={sliderMax}
                  step={tickSpacing}
                  onMinChange={(v) => setTickLower(String(v))}
                  onMaxChange={(v) => setTickUpper(String(v))}
                  showLabels={false}
                />
              </div>
            )
          })()}
        </div>

        {/* Status */}
        {!invalidRange && (
          <div className={`px-2 py-1.5 rounded text-xs text-center ${
            isInRange
              ? 'bg-[var(--neon-green)]/10 text-[var(--neon-green)]'
              : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]'
          }`}>
            {isInRange
              ? '✓ In range'
              : depositBDisabled
                ? `Below range — ${pool.tokenA.symbol} only`
                : `Above range — ${pool.tokenB.symbol} only`}
          </div>
        )}

        <Button
          onClick={handleConfirmRange}
          className="w-full"
          disabled={invalidRange}
        >
          {invalidRange ? 'Invalid Range' : 'Confirm Range'}
        </Button>
      </div>
    )
  }

  // Step 2: Enter Amounts
  return (
    <div className="space-y-3">
      {/* Range Summary */}
      <div className="p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-primary)]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Selected Range</span>
          <button
            onClick={handleBack}
            className="text-xs text-[var(--neon-blue)] hover:underline"
          >
            Change
          </button>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="font-mono text-[var(--text-primary)]">{formatPrice(priceLower)}</span>
          <span className="text-[var(--text-muted)]">→</span>
          <span className="font-mono text-[var(--text-primary)]">{formatPrice(priceUpper)}</span>
        </div>
        <div className="text-center text-xs text-[var(--text-muted)] mt-1">
          {pool.tokenB.symbol}/{pool.tokenA.symbol}
        </div>
      </div>

      {/* Status */}
      <div className={`px-2 py-1.5 rounded text-xs text-center ${
        isInRange
          ? 'bg-[var(--neon-green)]/10 text-[var(--neon-green)]'
          : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]'
      }`}>
        {isInRange
          ? '✓ In range — deposit both tokens'
          : depositBDisabled
            ? `Below range — ${pool.tokenA.symbol} only`
            : `Above range — ${pool.tokenB.symbol} only`}
      </div>

      {/* Deposit Amounts */}
      <div className="space-y-2">
        <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Enter Amounts</span>
        <div className="grid grid-cols-2 gap-2">
          <div className={depositADisabled ? 'opacity-40 pointer-events-none' : ''}>
            <Input
              label={pool.tokenA.symbol}
              type="number"
              value={amount0}
              onChange={(e) => handleAmount0Change(e.target.value)}
              placeholder="0.0"
              step="any"
            />
          </div>
          <div className={depositBDisabled ? 'opacity-40 pointer-events-none' : ''}>
            <Input
              label={pool.tokenB.symbol}
              type="number"
              value={amount1}
              onChange={(e) => handleAmount1Change(e.target.value)}
              placeholder="0.0"
              step="any"
            />
          </div>
        </div>
      </div>

      <Button
        onClick={handleAddLiquidity}
        className="w-full"
        disabled={!parseFloat(amount0) && !parseFloat(amount1)}
      >
        {(!parseFloat(amount0) && !parseFloat(amount1)) ? 'Enter Amount' : 'Add Position'}
      </Button>
    </div>
  )
}
