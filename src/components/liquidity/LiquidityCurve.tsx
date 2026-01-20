import { useMemo } from 'react'

interface LiquidityCurveProps {
  tickLower: number
  tickUpper: number
  currentTick: number
  tickSpacing: number
  onRangeChange?: (lower: number, upper: number) => void
}

// Range presets
const RANGE_PRESETS = [
  { label: '±1%', ticks: 100 },
  { label: '±5%', ticks: 500 },
  { label: '±10%', ticks: 1000 },
  { label: 'Full', ticks: 887220 },
]

export function LiquidityCurve({ tickLower, tickUpper, currentTick, tickSpacing, onRangeChange }: LiquidityCurveProps) {
  const width = 320
  const height = 180
  const padding = { top: 20, right: 20, bottom: 30, left: 20 }
  const innerWidth = width - padding.left - padding.right
  const innerHeight = height - padding.top - padding.bottom

  const curve = useMemo(() => {
    // View adapts to show the range with padding
    const rangeWidth = Math.abs(tickUpper - tickLower)
    const rangePadding = Math.max(rangeWidth * 0.5, tickSpacing * 10)
    const minTick = Math.min(tickLower, currentTick) - rangePadding
    const maxTick = Math.max(tickUpper, currentTick) + rangePadding

    // Helper to get screen X from tick (current tick is always at center)
    const tickToScreenX = (tick: number) => {
      const t = (tick - minTick) / (maxTick - minTick)
      return padding.left + t * innerWidth
    }

    // Generate hyperbola points - centered on current tick
    const points: { tick: number; screenX: number; screenY: number }[] = []
    const steps = 120

    for (let i = 0; i <= steps; i++) {
      const tick = minTick + (maxTick - minTick) * (i / steps)
      const screenX = padding.left + (i / steps) * innerWidth

      // Hyperbola shape centered on current tick
      const t = (i / steps) * 2 - 1 // -1 to 1
      const y = 1 / (t + 1.5)
      points.push({ tick, screenX, screenY: y })
    }

    // Normalize Y to fit in chart
    const yValues = points.map(p => p.screenY)
    const yMin = Math.min(...yValues)
    const yMax = Math.max(...yValues)
    const yRange = yMax - yMin || 1

    const yPadding = 0.1
    points.forEach(p => {
      p.screenY = padding.top + innerHeight * yPadding +
        ((yMax - p.screenY) / yRange) * innerHeight * (1 - 2 * yPadding)
    })

    // Helper to get screen Y from tick
    const tickToScreenY = (tick: number) => {
      const t = (tick - minTick) / (maxTick - minTick)
      const idx = t * steps
      const i = Math.floor(idx)
      if (i >= steps) return points[steps].screenY
      if (i < 0) return points[0].screenY
      const frac = idx - i
      return points[i].screenY * (1 - frac) + points[i + 1].screenY * frac
    }

    // Create path for the full curve
    const pathData = points
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.screenX.toFixed(2)} ${p.screenY.toFixed(2)}`)
      .join(' ')

    // Create path for the selected range (filled area under curve)
    const lowerX = tickToScreenX(tickLower)
    const upperX = tickToScreenX(tickUpper)
    const bottomY = padding.top + innerHeight

    // Build range path by finding points within range
    const rangePoints = points.filter(p => p.tick >= tickLower && p.tick <= tickUpper)
    let rangePath = ''
    if (rangePoints.length > 0) {
      // Add interpolated start point at exact tickLower
      const startY = tickToScreenY(tickLower)
      rangePath = `M ${lowerX.toFixed(2)} ${startY.toFixed(2)}`

      // Add all points in range
      rangePoints.forEach(p => {
        rangePath += ` L ${p.screenX.toFixed(2)} ${p.screenY.toFixed(2)}`
      })

      // Add interpolated end point at exact tickUpper
      const endY = tickToScreenY(tickUpper)
      rangePath += ` L ${upperX.toFixed(2)} ${endY.toFixed(2)}`

      // Close the path
      rangePath += ` L ${upperX.toFixed(2)} ${bottomY} L ${lowerX.toFixed(2)} ${bottomY} Z`
    }

    // Current tick is at center
    const currentX = tickToScreenX(currentTick)
    const currentY = tickToScreenY(currentTick)

    return {
      pathData,
      rangePath,
      currentX,
      currentY,
      lowerX,
      upperX,
      bottomY,
      topY: padding.top,
    }
  }, [tickLower, tickUpper, currentTick, tickSpacing, innerWidth, innerHeight])

  const isInRange = currentTick >= tickLower && currentTick <= tickUpper

  return (
    <div className="relative">
      <svg width={width} height={height} className="w-full" viewBox={`0 0 ${width} ${height}`}>
        <defs>
          {/* Gradient for the curve */}
          <linearGradient id="curveGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="var(--neon-blue)" stopOpacity="0.6" />
            <stop offset="50%" stopColor="var(--neon-purple)" stopOpacity="0.6" />
            <stop offset="100%" stopColor="var(--neon-pink)" stopOpacity="0.6" />
          </linearGradient>

          {/* Gradient for the selected range fill */}
          <linearGradient id="rangeFill" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="var(--neon-blue)" stopOpacity="0.4" />
            <stop offset="100%" stopColor="var(--neon-blue)" stopOpacity="0.05" />
          </linearGradient>

          {/* Glow filter */}
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Background grid */}
        <g opacity="0.1">
          {[0.25, 0.5, 0.75].map(ratio => (
            <line
              key={`h-${ratio}`}
              x1={padding.left}
              y1={padding.top + innerHeight * ratio}
              x2={padding.left + innerWidth}
              y2={padding.top + innerHeight * ratio}
              stroke="currentColor"
              strokeDasharray="2,4"
            />
          ))}
          {[0.25, 0.5, 0.75].map(ratio => (
            <line
              key={`v-${ratio}`}
              x1={padding.left + innerWidth * ratio}
              y1={padding.top}
              x2={padding.left + innerWidth * ratio}
              y2={padding.top + innerHeight}
              stroke="currentColor"
              strokeDasharray="2,4"
            />
          ))}
        </g>

        {/* Selected range fill */}
        {curve.rangePath && (
          <path
            d={curve.rangePath}
            fill="url(#rangeFill)"
            stroke="none"
          />
        )}

        {/* Range boundary lines */}
        <line
          x1={curve.lowerX}
          y1={curve.topY}
          x2={curve.lowerX}
          y2={curve.bottomY}
          stroke="var(--neon-blue)"
          strokeWidth="1"
          strokeDasharray="4,2"
          opacity="0.6"
        />
        <line
          x1={curve.upperX}
          y1={curve.topY}
          x2={curve.upperX}
          y2={curve.bottomY}
          stroke="var(--neon-blue)"
          strokeWidth="1"
          strokeDasharray="4,2"
          opacity="0.6"
        />

        {/* The hyperbola curve */}
        <path
          d={curve.pathData}
          fill="none"
          stroke="url(#curveGradient)"
          strokeWidth="2"
          strokeLinecap="round"
          filter="url(#glow)"
        />

        {/* Current tick line */}
        <line
          x1={curve.currentX}
          y1={curve.topY}
          x2={curve.currentX}
          y2={curve.bottomY}
          stroke={isInRange ? 'var(--neon-green)' : 'var(--neon-pink)'}
          strokeWidth="2"
          opacity="0.8"
        />

        {/* Current position dot */}
        <circle
          cx={curve.currentX}
          cy={curve.currentY}
          r="5"
          fill={isInRange ? 'var(--neon-green)' : 'var(--neon-pink)'}
          filter="url(#glow)"
        />
        <circle
          cx={curve.currentX}
          cy={curve.currentY}
          r="3"
          fill="white"
        />

        {/* Labels */}
        <text
          x={curve.lowerX}
          y={curve.bottomY + 12}
          textAnchor="middle"
          fontSize="9"
          fill="var(--text-muted)"
        >
          Lower
        </text>
        <text
          x={curve.upperX}
          y={curve.bottomY + 12}
          textAnchor="middle"
          fontSize="9"
          fill="var(--text-muted)"
        >
          Upper
        </text>
        <text
          x={curve.currentX}
          y={curve.topY - 6}
          textAnchor="middle"
          fontSize="9"
          fill={isInRange ? 'var(--neon-green)' : 'var(--neon-pink)'}
          fontWeight="500"
        >
          Current
        </text>

      </svg>

      {/* Range preset buttons */}
      <div className="absolute top-1 right-1 flex gap-0.5">
        {RANGE_PRESETS.map((preset) => {
          const presetLower = preset.label === 'Full'
            ? Math.ceil(-887220 / tickSpacing) * tickSpacing
            : Math.round((currentTick - preset.ticks) / tickSpacing) * tickSpacing
          const presetUpper = preset.label === 'Full'
            ? Math.floor(887220 / tickSpacing) * tickSpacing
            : Math.round((currentTick + preset.ticks) / tickSpacing) * tickSpacing
          const isActive = Math.abs(tickLower - presetLower) < tickSpacing * 2 &&
                          Math.abs(tickUpper - presetUpper) < tickSpacing * 2

          return (
            <button
              key={preset.label}
              onClick={() => onRangeChange?.(presetLower, presetUpper)}
              className={`px-1.5 py-0.5 text-[10px] rounded transition-colors ${
                isActive
                  ? 'bg-[var(--neon-blue)]/30 text-[var(--neon-blue)]'
                  : 'bg-[var(--bg-tertiary)]/50 text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              {preset.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
