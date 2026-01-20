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
