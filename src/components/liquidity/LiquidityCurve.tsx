import { useMemo, useRef, useState, useCallback, useEffect } from 'react'

interface LiquidityCurveProps {
  tickLower: number
  tickUpper: number
  currentTick: number
  tickSpacing: number
  onRangeChange?: (lower: number, upper: number) => void
}

const RANGE_PRESETS = [
  { label: '±1%', ticks: 100 },
  { label: '±5%', ticks: 500 },
  { label: '±10%', ticks: 1000 },
  { label: 'Full', ticks: 887220 },
]

const MIN_TICK = -887272
const MAX_TICK = 887272

export function LiquidityCurve({ tickLower, tickUpper, currentTick, tickSpacing, onRangeChange }: LiquidityCurveProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [dragging, setDragging] = useState<'lower' | 'upper' | null>(null)

  // Local preview during drag (allows smooth movement without snapping)
  const [dragPreview, setDragPreview] = useState<{ lower: number; upper: number } | null>(null)
  // Track committed values to clear preview only when props catch up
  const [committedValues, setCommittedValues] = useState<{ lower: number; upper: number } | null>(null)

  // Clamp to valid range
  const baseLower = Math.max(MIN_TICK, Math.min(MAX_TICK, tickLower))
  const baseUpper = Math.max(MIN_TICK, Math.min(MAX_TICK, tickUpper))
  const current = Math.max(MIN_TICK, Math.min(MAX_TICK, currentTick))

  // Clear dragPreview once props catch up to committed values
  useEffect(() => {
    if (committedValues && !dragging) {
      if (baseLower === committedValues.lower && baseUpper === committedValues.upper) {
        setDragPreview(null)
        setCommittedValues(null)
      }
    }
  }, [baseLower, baseUpper, committedValues, dragging])

  // Use preview values during drag, otherwise use props
  const lower = dragPreview?.lower ?? baseLower
  const upper = dragPreview?.upper ?? baseUpper

  const width = 400
  const height = 200
  const padding = { top: 25, right: 20, bottom: 25, left: 20 }
  const innerWidth = width - padding.left - padding.right
  const innerHeight = height - padding.top - padding.bottom

  // Calculate view range
  const viewRange = useMemo(() => {
    const minNeeded = Math.min(lower, current)
    const maxNeeded = Math.max(upper, current)
    const span = Math.max(maxNeeded - minNeeded, tickSpacing * 20)
    const pad = span * 0.3
    return { min: minNeeded - pad, max: maxNeeded + pad }
  }, [lower, upper, current, tickSpacing])

  // Convert tick to screen X (current tick is always at center)
  const tickToX = useCallback((tick: number) => {
    const t = (tick - viewRange.min) / (viewRange.max - viewRange.min)
    return padding.left + t * innerWidth
  }, [viewRange, innerWidth])

  // Convert screen X to tick (raw, without snapping for smooth drag)
  const xToTickRaw = useCallback((x: number) => {
    const t = (x - padding.left) / innerWidth
    return viewRange.min + t * (viewRange.max - viewRange.min)
  }, [viewRange, innerWidth])

  // Snap tick to tickSpacing
  const snapTick = useCallback((tick: number) => {
    return Math.round(tick / tickSpacing) * tickSpacing
  }, [tickSpacing])

  // X positions for boundaries and current tick
  const lowerX = tickToX(lower)
  const upperX = tickToX(upper)
  const currentX = tickToX(current)

  // Generate curve data - hyperbola shape that scales with tick range
  const curve = useMemo(() => {
    const points: { x: number; y: number }[] = []
    const steps = 100

    // Curvature based on tick range - wider range = steeper curve
    const tickRange = viewRange.max - viewRange.min
    const rangeRatio = Math.min(1, tickRange / (MAX_TICK - MIN_TICK))
    const curvature = 0.3 + rangeRatio * 1.7

    for (let i = 0; i <= steps; i++) {
      const x = padding.left + (i / steps) * innerWidth
      // Hyperbola: y = 1 / (x + offset), scaled by curvature
      const t = (i / steps) * 2  // 0 to 2
      const y = 1 / (t * curvature + 0.5)
      points.push({ x, y })
    }

    // Normalize Y to fit in view
    const yValues = points.map(p => p.y)
    const yMin = Math.min(...yValues)
    const yMax = Math.max(...yValues)
    const yRange = yMax - yMin || 1

    points.forEach(p => {
      p.y = padding.top + innerHeight * 0.05 + ((yMax - p.y) / yRange) * innerHeight * 0.9
    })

    // Path
    const pathData = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')

    // Get Y at specific X
    const getYAtX = (targetX: number) => {
      const idx = ((targetX - padding.left) / innerWidth) * steps
      const i = Math.max(0, Math.min(steps - 1, Math.floor(idx)))
      const frac = idx - i
      if (i >= steps - 1) return points[steps].y
      return points[i].y * (1 - frac) + points[i + 1].y * frac
    }

    const bottomY = padding.top + innerHeight

    // Build range fill path
    const clampedLowerX = Math.max(padding.left, Math.min(padding.left + innerWidth, lowerX))
    const clampedUpperX = Math.max(padding.left, Math.min(padding.left + innerWidth, upperX))

    const lowerY = getYAtX(clampedLowerX)
    const upperY = getYAtX(clampedUpperX)

    let rangePath = `M ${clampedLowerX.toFixed(1)} ${lowerY.toFixed(1)}`
    const startIdx = Math.max(0, Math.ceil(((clampedLowerX - padding.left) / innerWidth) * steps))
    const endIdx = Math.min(steps, Math.floor(((clampedUpperX - padding.left) / innerWidth) * steps))

    for (let i = startIdx; i <= endIdx; i++) {
      rangePath += ` L ${points[i].x.toFixed(1)} ${points[i].y.toFixed(1)}`
    }
    rangePath += ` L ${clampedUpperX.toFixed(1)} ${upperY.toFixed(1)}`
    rangePath += ` L ${clampedUpperX.toFixed(1)} ${bottomY} L ${clampedLowerX.toFixed(1)} ${bottomY} Z`

    const currentY = getYAtX(currentX)

    return { pathData, rangePath, currentY, bottomY, topY: padding.top, getYAtX }
  }, [viewRange, innerWidth, innerHeight, lowerX, upperX, currentX])

  const isInRange = current >= lower && current <= upper

  // Drag handlers
  const handleMouseDown = (type: 'lower' | 'upper') => (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    // Clear any pending commit and use current visual values
    setCommittedValues(null)
    setDragPreview({ lower, upper })
    setDragging(type)
  }

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging || !svgRef.current) return

    const rect = svgRef.current.getBoundingClientRect()
    const scaleX = width / rect.width
    const x = (e.clientX - rect.left) * scaleX
    const rawTick = xToTickRaw(x)
    const clampedTick = Math.max(MIN_TICK, Math.min(MAX_TICK, rawTick))

    // Update local preview for smooth visual (no snapping)
    if (dragging === 'lower' && clampedTick < upper - tickSpacing) {
      setDragPreview({ lower: clampedTick, upper })
    } else if (dragging === 'upper' && clampedTick > lower + tickSpacing) {
      setDragPreview({ lower, upper: clampedTick })
    }
  }, [dragging, xToTickRaw, lower, upper, tickSpacing])

  // Commit snapped values on release
  const handleMouseUp = useCallback(() => {
    if (dragging && dragPreview && onRangeChange) {
      const snappedLower = snapTick(dragPreview.lower)
      const snappedUpper = snapTick(dragPreview.upper)
      // Keep preview at snapped values until props catch up
      setDragPreview({ lower: snappedLower, upper: snappedUpper })
      setCommittedValues({ lower: snappedLower, upper: snappedUpper })
      onRangeChange(snappedLower, snappedUpper)
    }
    setDragging(null)
  }, [dragging, dragPreview, onRangeChange, snapTick])

  const handleMouseLeave = useCallback(() => {
    if (dragging && dragPreview && onRangeChange) {
      const snappedLower = snapTick(dragPreview.lower)
      const snappedUpper = snapTick(dragPreview.upper)
      // Keep preview at snapped values until props catch up
      setDragPreview({ lower: snappedLower, upper: snappedUpper })
      setCommittedValues({ lower: snappedLower, upper: snappedUpper })
      onRangeChange(snappedLower, snappedUpper)
    }
    setDragging(null)
  }, [dragging, dragPreview, onRangeChange, snapTick])

  // Format tick for display
  const formatTick = (tick: number) => {
    if (Math.abs(tick) >= 1000) return `${(tick / 1000).toFixed(0)}k`
    return tick.toString()
  }

  return (
    <div className="relative w-full" style={{ height: '280px' }}>
      <svg
        ref={svgRef}
        className="w-full h-full select-none"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        <defs>
          <linearGradient id="curveGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="var(--neon-blue)" stopOpacity="0.6" />
            <stop offset="50%" stopColor="var(--neon-purple)" stopOpacity="0.6" />
            <stop offset="100%" stopColor="var(--neon-pink)" stopOpacity="0.6" />
          </linearGradient>
          <linearGradient id="rangeFill" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="var(--neon-blue)" stopOpacity="0.4" />
            <stop offset="100%" stopColor="var(--neon-blue)" stopOpacity="0.05" />
          </linearGradient>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Grid */}
        <g opacity="0.1">
          {[0.25, 0.5, 0.75].map(ratio => (
            <line key={`h-${ratio}`} x1={padding.left} y1={padding.top + innerHeight * ratio} x2={padding.left + innerWidth} y2={padding.top + innerHeight * ratio} stroke="currentColor" strokeDasharray="2,4" />
          ))}
        </g>

        {/* Center line (current tick reference) */}
        <line x1={currentX} y1={padding.top} x2={currentX} y2={curve.bottomY} stroke="var(--text-muted)" strokeWidth="1" strokeDasharray="2,4" opacity="0.3" />

        {/* Range fill */}
        <path d={curve.rangePath} fill="url(#rangeFill)" stroke="none" />

        {/* Curve */}
        <path d={curve.pathData} fill="none" stroke="url(#curveGradient)" strokeWidth="2" strokeLinecap="round" filter="url(#glow)" />

        {/* Lower boundary - draggable */}
        {lowerX >= padding.left - 20 && lowerX <= padding.left + innerWidth + 20 && (
          <g style={{ cursor: 'pointer' }} onMouseDown={handleMouseDown('lower')}>
            <line
              x1={lowerX} y1={curve.topY} x2={lowerX} y2={curve.bottomY}
              stroke="var(--neon-pink)"
              strokeWidth={dragging === 'lower' ? 4 : 2}
              opacity={dragging === 'lower' ? 1 : 0.9}
            />
            {/* Wide hit area */}
            <rect x={lowerX - 20} y={curve.topY - 10} width={40} height={curve.bottomY - curve.topY + 20} fill="transparent" />
            {/* Handle */}
            <rect x={lowerX - 6} y={curve.topY - 2} width={12} height={24} rx={3} fill="var(--neon-pink)" stroke="white" strokeWidth={1.5} style={{ filter: 'drop-shadow(0 0 6px var(--neon-pink))' }} />
            {/* Label */}
            <text x={lowerX} y={curve.bottomY + 12} textAnchor="middle" fontSize="8" fill="var(--neon-pink)" fontWeight="500">
              {formatTick(lower)}
            </text>
          </g>
        )}

        {/* Upper boundary - draggable */}
        {upperX >= padding.left - 20 && upperX <= padding.left + innerWidth + 20 && (
          <g style={{ cursor: 'pointer' }} onMouseDown={handleMouseDown('upper')}>
            <line
              x1={upperX} y1={curve.topY} x2={upperX} y2={curve.bottomY}
              stroke="var(--neon-purple)"
              strokeWidth={dragging === 'upper' ? 4 : 2}
              opacity={dragging === 'upper' ? 1 : 0.9}
            />
            {/* Wide hit area */}
            <rect x={upperX - 20} y={curve.topY - 10} width={40} height={curve.bottomY - curve.topY + 20} fill="transparent" />
            {/* Handle */}
            <rect x={upperX - 6} y={curve.topY - 2} width={12} height={24} rx={3} fill="var(--neon-purple)" stroke="white" strokeWidth={1.5} style={{ filter: 'drop-shadow(0 0 6px var(--neon-purple))' }} />
            <text x={upperX} y={curve.bottomY + 12} textAnchor="middle" fontSize="8" fill="var(--neon-purple)" fontWeight="500">
              {formatTick(upper)}
            </text>
          </g>
        )}

        {/* Current tick marker */}
        <line x1={currentX} y1={curve.topY} x2={currentX} y2={curve.bottomY} stroke={isInRange ? 'var(--neon-green)' : 'var(--neon-red)'} strokeWidth="2" opacity="0.9" />
        <circle cx={currentX} cy={curve.currentY} r="6" fill={isInRange ? 'var(--neon-green)' : 'var(--neon-red)'} filter="url(#glow)" />
        <circle cx={currentX} cy={curve.currentY} r="3" fill="white" />
        <text x={currentX} y={curve.topY - 8} textAnchor="middle" fontSize="9" fill={isInRange ? 'var(--neon-green)' : 'var(--neon-red)'} fontWeight="600">
          {formatTick(current)}
        </text>

        {/* Tick scale */}
        {(() => {
          const range = viewRange.max - viewRange.min
          // Nice intervals for tick marks
          const niceIntervals = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000, 200000, 500000]
          // Target 6-10 ticks on screen
          const targetTicks = 8
          const rawInterval = range / targetTicks
          // Find the smallest nice interval that gives us <= targetTicks
          const interval = niceIntervals.find(i => i >= rawInterval) || niceIntervals[niceIntervals.length - 1]

          const startTick = Math.ceil(viewRange.min / interval) * interval
          const ticks: number[] = []
          for (let t = startTick; t <= viewRange.max; t += interval) {
            ticks.push(t)
          }

          return ticks.map(tick => {
            const x = tickToX(tick)
            // Skip if outside view
            if (x < padding.left + 5 || x > padding.left + innerWidth - 5) return null
            // Skip if too close to lower or upper boundary
            if (Math.abs(x - lowerX) < 25 || Math.abs(x - upperX) < 25) return null

            return (
              <g key={tick}>
                <line x1={x} y1={curve.bottomY} x2={x} y2={curve.bottomY + 4} stroke="var(--text-muted)" strokeWidth="1" opacity="0.3" />
                <text x={x} y={curve.bottomY + 14} textAnchor="middle" fontSize="7" fill="var(--text-muted)" opacity="0.5">
                  {formatTick(tick)}
                </text>
              </g>
            )
          })
        })()}
      </svg>

      {/* Presets */}
      <div className="absolute top-1 right-1 flex gap-0.5">
        {RANGE_PRESETS.map((preset) => {
          const presetLower = preset.label === 'Full'
            ? Math.ceil(-887220 / tickSpacing) * tickSpacing
            : Math.round((current - preset.ticks) / tickSpacing) * tickSpacing
          const presetUpper = preset.label === 'Full'
            ? Math.floor(887220 / tickSpacing) * tickSpacing
            : Math.round((current + preset.ticks) / tickSpacing) * tickSpacing
          const isActive = Math.abs(lower - presetLower) < tickSpacing * 2 && Math.abs(upper - presetUpper) < tickSpacing * 2

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
