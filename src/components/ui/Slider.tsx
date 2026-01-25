import { useState, useMemo } from 'react'
import type { InputHTMLAttributes } from 'react'

interface SliderProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string
  showValue?: boolean
  formatValue?: (value: number) => string
}

export function Slider({
  label,
  showValue = true,
  formatValue,
  className = '',
  value,
  ...props
}: SliderProps) {
  const numValue = typeof value === 'string' ? parseFloat(value) : (value as number)
  const displayValue = formatValue ? formatValue(numValue) : numValue

  return (
    <div className="space-y-1.5">
      {(label || showValue) && (
        <div className="flex items-center justify-between">
          {label && (
            <label className="text-sm text-[var(--text-muted)]">{label}</label>
          )}
          {showValue && (
            <span className="text-sm font-mono text-[var(--text-primary)]">
              {displayValue}
            </span>
          )}
        </div>
      )}
      <input
        type="range"
        value={value}
        className={`
          w-full h-3 rounded-full appearance-none cursor-pointer
          bg-[var(--bg-tertiary)]
          [&::-webkit-slider-thumb]:appearance-none
          [&::-webkit-slider-thumb]:w-5
          [&::-webkit-slider-thumb]:h-5
          [&::-webkit-slider-thumb]:rounded-full
          [&::-webkit-slider-thumb]:bg-gradient-to-r
          [&::-webkit-slider-thumb]:from-[var(--neon-pink)]
          [&::-webkit-slider-thumb]:to-[var(--neon-purple)]
          [&::-webkit-slider-thumb]:shadow-[0_0_12px_var(--neon-pink)]
          [&::-webkit-slider-thumb]:cursor-grab
          [&::-webkit-slider-thumb]:active:cursor-grabbing
          [&::-webkit-slider-thumb]:active:scale-110
          [&::-webkit-slider-thumb]:transition-transform
          [&::-moz-range-thumb]:w-5
          [&::-moz-range-thumb]:h-5
          [&::-moz-range-thumb]:rounded-full
          [&::-moz-range-thumb]:bg-gradient-to-r
          [&::-moz-range-thumb]:from-[var(--neon-pink)]
          [&::-moz-range-thumb]:to-[var(--neon-purple)]
          [&::-moz-range-thumb]:border-0
          [&::-moz-range-thumb]:cursor-grab
          [&::-moz-range-thumb]:active:cursor-grabbing
          [&::-webkit-slider-runnable-track]:rounded-full
          [&::-webkit-slider-runnable-track]:h-3
          [&::-moz-range-track]:rounded-full
          [&::-moz-range-track]:h-3
          ${className}
        `}
        {...props}
      />
    </div>
  )
}

interface RangeSliderProps {
  label?: string
  minValue: number
  maxValue: number
  min: number
  max: number
  step?: number
  onMinChange: (value: number) => void
  onMaxChange: (value: number) => void
  formatValue?: (value: number) => string
  showLabels?: boolean
}

interface AdaptiveRangeSliderProps {
  tickLower: number
  tickUpper: number
  currentTick: number
  tickSpacing: number
  onTickLowerChange: (tick: number) => void
  onTickUpperChange: (tick: number) => void
  absoluteMin?: number
  absoluteMax?: number
}

export function RangeSlider({
  label,
  minValue,
  maxValue,
  min,
  max,
  step = 1,
  onMinChange,
  onMaxChange,
  formatValue,
  showLabels = true,
}: RangeSliderProps) {
  const formatDisplay = formatValue || ((v) => v.toString())

  // Calculate positions as percentages
  const minPercent = ((minValue - min) / (max - min)) * 100
  const maxPercent = ((maxValue - min) / (max - min)) * 100

  return (
    <div className="space-y-2">
      {label && (
        <label className="text-sm text-[var(--text-muted)]">{label}</label>
      )}

      <div className="relative h-8 flex items-center">
        {/* Track background */}
        <div className="absolute w-full h-2 rounded-full bg-[var(--bg-tertiary)]" />

        {/* Active range highlight */}
        <div
          className="absolute h-2 rounded-full bg-gradient-to-r from-[var(--neon-pink)]/40 to-[var(--neon-purple)]/40"
          style={{
            left: `${minPercent}%`,
            width: `${maxPercent - minPercent}%`,
          }}
        />

        {/* Min slider */}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={minValue}
          onChange={(e) => {
            const newMin = parseFloat(e.target.value)
            // Allow up to maxValue - step (minimum gap)
            const clampedMin = Math.min(newMin, maxValue - step)
            onMinChange(clampedMin)
          }}
          className="absolute w-full h-2 appearance-none bg-transparent cursor-pointer pointer-events-none
            [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:pointer-events-auto
            [&::-webkit-slider-thumb]:w-4
            [&::-webkit-slider-thumb]:h-4
            [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:bg-[var(--neon-pink)]
            [&::-webkit-slider-thumb]:shadow-[0_0_10px_var(--neon-pink)]
            [&::-webkit-slider-thumb]:cursor-grab
            [&::-webkit-slider-thumb]:active:cursor-grabbing
            [&::-moz-range-thumb]:pointer-events-auto
            [&::-moz-range-thumb]:w-4
            [&::-moz-range-thumb]:h-4
            [&::-moz-range-thumb]:rounded-full
            [&::-moz-range-thumb]:bg-[var(--neon-pink)]
            [&::-moz-range-thumb]:border-0
            [&::-moz-range-thumb]:cursor-grab
          "
          style={{ zIndex: minPercent > 50 ? 5 : 3 }}
        />

        {/* Max slider */}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={maxValue}
          onChange={(e) => {
            const newMax = parseFloat(e.target.value)
            // Allow down to minValue + step (minimum gap)
            const clampedMax = Math.max(newMax, minValue + step)
            onMaxChange(clampedMax)
          }}
          className="absolute w-full h-2 appearance-none bg-transparent cursor-pointer pointer-events-none
            [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:pointer-events-auto
            [&::-webkit-slider-thumb]:w-4
            [&::-webkit-slider-thumb]:h-4
            [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:bg-[var(--neon-purple)]
            [&::-webkit-slider-thumb]:shadow-[0_0_10px_var(--neon-purple)]
            [&::-webkit-slider-thumb]:cursor-grab
            [&::-webkit-slider-thumb]:active:cursor-grabbing
            [&::-moz-range-thumb]:pointer-events-auto
            [&::-moz-range-thumb]:w-4
            [&::-moz-range-thumb]:h-4
            [&::-moz-range-thumb]:rounded-full
            [&::-moz-range-thumb]:bg-[var(--neon-purple)]
            [&::-moz-range-thumb]:border-0
            [&::-moz-range-thumb]:cursor-grab
          "
          style={{ zIndex: maxPercent < 50 ? 5 : 4 }}
        />
      </div>

      {/* Value labels */}
      {showLabels && (
        <div className="flex justify-between text-xs font-mono">
          <span className="text-[var(--text-muted)]">{formatDisplay(minValue)}</span>
          <span className="text-[var(--text-muted)]">{formatDisplay(maxValue)}</span>
        </div>
      )}
    </div>
  )
}

/**
 * Dual Tick Sliders - two separate sliders for lower and upper tick
 * Clean design with constraints to prevent crossing
 */
export function DualTickSliders({
  tickLower,
  tickUpper,
  currentTick,
  tickSpacing,
  onTickLowerChange,
  onTickUpperChange,
  absoluteMin = -887220,
  absoluteMax = 887220,
}: AdaptiveRangeSliderProps) {
  // ±10% in ticks ≈ ±1000 ticks (since 1.0001^1000 ≈ 1.105)
  const defaultRange = Math.max(1000, tickSpacing * 20)

  // Stable viewport - only changes when user clicks zoom buttons
  const [viewportCenter, setViewportCenter] = useState(currentTick)
  const [viewportHalfRange, setViewportHalfRange] = useState(defaultRange)

  const viewport = useMemo(() => {
    const min = Math.max(absoluteMin, Math.round((viewportCenter - viewportHalfRange) / tickSpacing) * tickSpacing)
    const max = Math.min(absoluteMax, Math.round((viewportCenter + viewportHalfRange) / tickSpacing) * tickSpacing)
    return { min, max, range: max - min }
  }, [viewportCenter, viewportHalfRange, tickSpacing, absoluteMin, absoluteMax])

  // Positions as percentages
  const lowerPercent = viewport.range > 0 ? ((tickLower - viewport.min) / viewport.range) * 100 : 50
  const upperPercent = viewport.range > 0 ? ((tickUpper - viewport.min) / viewport.range) * 100 : 50
  const currentPercent = viewport.range > 0 ? ((currentTick - viewport.min) / viewport.range) * 100 : 50

  const handleLowerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value)
    const snapped = Math.round(value / tickSpacing) * tickSpacing
    const clamped = Math.min(snapped, tickUpper - tickSpacing)
    onTickLowerChange(Math.max(absoluteMin, clamped))
  }

  const handleUpperChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value)
    const snapped = Math.round(value / tickSpacing) * tickSpacing
    const clamped = Math.max(snapped, tickLower + tickSpacing)
    onTickUpperChange(Math.min(absoluteMax, clamped))
  }

  const zoomIn = () => setViewportHalfRange(r => Math.max(tickSpacing * 10, r / 2))
  const zoomOut = () => setViewportHalfRange(r => Math.min((absoluteMax - absoluteMin) / 2, r * 2))
  const centerOnSelection = () => {
    setViewportCenter(Math.round((tickLower + tickUpper) / 2 / tickSpacing) * tickSpacing)
    setViewportHalfRange(Math.max(tickSpacing * 10, Math.abs(tickUpper - tickLower)))
  }

  return (
    <div className="space-y-2">
      {/* Zoom controls */}
      <div className="flex items-center justify-end gap-1">
        <button onClick={zoomIn} className="w-6 h-6 rounded bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] text-xs" title="Zoom in">+</button>
        <button onClick={zoomOut} className="w-6 h-6 rounded bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] text-xs" title="Zoom out">−</button>
        <button onClick={centerOnSelection} className="w-6 h-6 rounded bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] text-xs" title="Center on selection">⊙</button>
      </div>

      {/* Lower tick slider */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-[var(--neon-pink)] uppercase tracking-wider">Min Tick</span>
          <span className="text-[10px] font-mono text-[var(--text-muted)]">{tickLower}</span>
        </div>
        <div className="relative h-6 flex items-center">
          <div className="absolute w-full h-1.5 rounded-full bg-[var(--bg-tertiary)]" />
          {/* Selected range indicator */}
          {lowerPercent >= 0 && upperPercent <= 100 && (
            <div
              className="absolute h-1.5 rounded-full bg-[var(--neon-pink)]/30"
              style={{
                left: `${Math.max(0, lowerPercent)}%`,
                width: `${Math.min(100, upperPercent) - Math.max(0, lowerPercent)}%`
              }}
            />
          )}
          {/* Current tick marker */}
          {currentPercent >= 0 && currentPercent <= 100 && (
            <div
              className="absolute h-4 w-0.5 bg-[var(--text-primary)]/40 pointer-events-none"
              style={{ left: `${currentPercent}%` }}
            />
          )}
          <input
            type="range"
            min={viewport.min}
            max={viewport.max}
            step={tickSpacing}
            value={Math.max(viewport.min, Math.min(viewport.max, tickLower))}
            onChange={handleLowerChange}
            className="absolute w-full h-1.5 appearance-none bg-transparent cursor-pointer
              [&::-webkit-slider-thumb]:appearance-none
              [&::-webkit-slider-thumb]:w-4
              [&::-webkit-slider-thumb]:h-4
              [&::-webkit-slider-thumb]:rounded-full
              [&::-webkit-slider-thumb]:bg-[var(--neon-pink)]
              [&::-webkit-slider-thumb]:shadow-[0_0_8px_var(--neon-pink)]
              [&::-webkit-slider-thumb]:cursor-grab
              [&::-webkit-slider-thumb]:active:cursor-grabbing
              [&::-moz-range-thumb]:w-4
              [&::-moz-range-thumb]:h-4
              [&::-moz-range-thumb]:rounded-full
              [&::-moz-range-thumb]:bg-[var(--neon-pink)]
              [&::-moz-range-thumb]:border-0
              [&::-moz-range-thumb]:cursor-grab
            "
          />
        </div>
      </div>

      {/* Upper tick slider */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-[var(--neon-purple)] uppercase tracking-wider">Max Tick</span>
          <span className="text-[10px] font-mono text-[var(--text-muted)]">{tickUpper}</span>
        </div>
        <div className="relative h-6 flex items-center">
          <div className="absolute w-full h-1.5 rounded-full bg-[var(--bg-tertiary)]" />
          {/* Selected range indicator */}
          {lowerPercent >= 0 && upperPercent <= 100 && (
            <div
              className="absolute h-1.5 rounded-full bg-[var(--neon-purple)]/30"
              style={{
                left: `${Math.max(0, lowerPercent)}%`,
                width: `${Math.min(100, upperPercent) - Math.max(0, lowerPercent)}%`
              }}
            />
          )}
          {/* Current tick marker */}
          {currentPercent >= 0 && currentPercent <= 100 && (
            <div
              className="absolute h-4 w-0.5 bg-[var(--text-primary)]/40 pointer-events-none"
              style={{ left: `${currentPercent}%` }}
            />
          )}
          <input
            type="range"
            min={viewport.min}
            max={viewport.max}
            step={tickSpacing}
            value={Math.max(viewport.min, Math.min(viewport.max, tickUpper))}
            onChange={handleUpperChange}
            className="absolute w-full h-1.5 appearance-none bg-transparent cursor-pointer
              [&::-webkit-slider-thumb]:appearance-none
              [&::-webkit-slider-thumb]:w-4
              [&::-webkit-slider-thumb]:h-4
              [&::-webkit-slider-thumb]:rounded-full
              [&::-webkit-slider-thumb]:bg-[var(--neon-purple)]
              [&::-webkit-slider-thumb]:shadow-[0_0_8px_var(--neon-purple)]
              [&::-webkit-slider-thumb]:cursor-grab
              [&::-webkit-slider-thumb]:active:cursor-grabbing
              [&::-moz-range-thumb]:w-4
              [&::-moz-range-thumb]:h-4
              [&::-moz-range-thumb]:rounded-full
              [&::-moz-range-thumb]:bg-[var(--neon-purple)]
              [&::-moz-range-thumb]:border-0
              [&::-moz-range-thumb]:cursor-grab
            "
          />
        </div>
      </div>

      {/* Viewport info */}
      <div className="flex justify-between text-[9px] font-mono text-[var(--text-muted)]/40">
        <span>{viewport.min}</span>
        <span>{viewport.max}</span>
      </div>
    </div>
  )
}
