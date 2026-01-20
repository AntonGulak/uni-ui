import { useEffect, useRef } from 'react'
import * as d3 from 'd3'
import JSBI from 'jsbi'
import { usePoolStore } from '../../store/usePoolStore'
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card'

function formatNumber(num: number): string {
  if (num >= 1e6) return `${(num / 1e6).toFixed(1)}M`
  if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K`
  if (num >= 1) return num.toFixed(2)
  if (num >= 0.01) return num.toFixed(4)
  return num.toExponential(2)
}

export function SwapCurveChart() {
  const svgRef = useRef<SVGSVGElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const { pool, swapDirection, slippageAnalysis } = usePoolStore()

  const tokenIn = swapDirection === 'zeroForOne' ? pool.tokenA : pool.tokenB
  const tokenOut = swapDirection === 'zeroForOne' ? pool.tokenB : pool.tokenA

  useEffect(() => {
    if (!svgRef.current || !pool.initialized || !slippageAnalysis) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const margin = { top: 20, right: 20, bottom: 40, left: 50 }
    const width = svgRef.current.clientWidth - margin.left - margin.right
    const height = 240 - margin.top - margin.bottom

    if (width <= 0 || height <= 0 || slippageAnalysis.points.length === 0) return

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`)

    // Prepare data - normalize by actual token decimals
    const decimalsIn = tokenIn.decimals
    const data = slippageAnalysis.points
      .filter((p) =>
        p.slippagePercent < 100 &&
        Number.isFinite(p.effectivePrice) &&
        Number.isFinite(p.slippagePercent) &&
        p.effectivePrice > 0
      )
      .map((p) => ({
        amountIn: JSBI.toNumber(p.amountIn) / Math.pow(10, decimalsIn),
        effectivePrice: p.effectivePrice,
        slippage: p.slippagePercent,
      }))
      .filter((d) => Number.isFinite(d.amountIn) && d.amountIn > 0)
      .sort((a, b) => a.amountIn - b.amountIn)

    if (data.length < 2) return

    // Scales
    const xMax = d3.max(data, (d) => d.amountIn) || 1
    const xScale = d3
      .scaleLinear()
      .domain([0, xMax])
      .range([0, width])

    const yMin = d3.min(data, (d) => d.effectivePrice) || 0
    const yMax = d3.max(data, (d) => d.effectivePrice) || 1
    // Ensure valid domain (min != max)
    const yPadding = yMax === yMin ? yMax * 0.1 || 0.1 : 0
    const yScale = d3
      .scaleLinear()
      .domain([
        (yMin - yPadding) * 0.95,
        (yMax + yPadding) * 1.02,
      ])
      .range([height, 0])

    // Gradient for line
    const defs = svg.append('defs')
    const gradient = defs
      .append('linearGradient')
      .attr('id', 'line-gradient')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '100%')
      .attr('y2', '0%')

    gradient.append('stop').attr('offset', '0%').attr('stop-color', 'var(--neon-blue)')
    gradient.append('stop').attr('offset', '50%').attr('stop-color', 'var(--neon-purple)')
    gradient.append('stop').attr('offset', '100%').attr('stop-color', 'var(--neon-pink)')

    // Grid lines
    g.append('g')
      .attr('class', 'grid')
      .attr('opacity', 0.1)
      .call(
        d3
          .axisLeft(yScale)
          .tickSize(-width)
          .tickFormat(() => '')
      )
      .selectAll('line')
      .attr('stroke', 'var(--text-muted)')

    // Line generator
    const line = d3
      .line<(typeof data)[0]>()
      .x((d) => xScale(d.amountIn))
      .y((d) => yScale(d.effectivePrice))
      .curve(d3.curveMonotoneX)

    // Area under line
    const area = d3
      .area<(typeof data)[0]>()
      .x((d) => xScale(d.amountIn))
      .y0(height)
      .y1((d) => yScale(d.effectivePrice))
      .curve(d3.curveMonotoneX)

    // Draw area
    g.append('path')
      .datum(data)
      .attr('fill', 'url(#line-gradient)')
      .attr('opacity', 0.1)
      .attr('d', area)

    // Draw line
    g.append('path')
      .datum(data)
      .attr('fill', 'none')
      .attr('stroke', 'url(#line-gradient)')
      .attr('stroke-width', 2.5)
      .attr('class', 'chart-line')
      .attr('d', line)

    // Spot price line
    const spotPrice = pool.getCurrentPrice()
    const adjustedSpotPrice = swapDirection === 'zeroForOne' ? spotPrice : 1 / spotPrice

    if (adjustedSpotPrice >= yScale.domain()[0] && adjustedSpotPrice <= yScale.domain()[1]) {
      g.append('line')
        .attr('x1', 0)
        .attr('x2', width)
        .attr('y1', yScale(adjustedSpotPrice))
        .attr('y2', yScale(adjustedSpotPrice))
        .attr('stroke', 'var(--text-muted)')
        .attr('stroke-dasharray', '4,4')
        .attr('stroke-width', 1)

      g.append('text')
        .attr('x', width)
        .attr('y', yScale(adjustedSpotPrice) - 5)
        .attr('text-anchor', 'end')
        .attr('fill', 'var(--text-muted)')
        .attr('font-size', '9px')
        .text('Spot')
    }

    // X axis
    g.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(
        d3
          .axisBottom(xScale)
          .ticks(5)
          .tickFormat((d) => formatNumber(d as number))
      )
      .attr('color', 'var(--text-muted)')
      .selectAll('text')
      .attr('fill', 'var(--text-secondary)')
      .attr('font-size', '9px')

    // X axis label
    g.append('text')
      .attr('x', width / 2)
      .attr('y', height + 30)
      .attr('text-anchor', 'middle')
      .attr('fill', 'var(--text-muted)')
      .attr('font-size', '10px')
      .text(`${tokenIn.symbol} In`)

    // Y axis - simplified without label
    g.append('g')
      .call(
        d3
          .axisLeft(yScale)
          .ticks(4)
          .tickFormat((d) => formatNumber(d as number))
      )
      .attr('color', 'var(--text-muted)')
      .selectAll('text')
      .attr('fill', 'var(--text-secondary)')
      .attr('font-size', '9px')

    // Hover interaction
    const hoverLine = g.append('line')
      .attr('stroke', 'var(--text-muted)')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '2,2')
      .style('opacity', 0)

    const hoverCircle = g.append('circle')
      .attr('r', 5)
      .attr('fill', 'var(--neon-pink)')
      .attr('stroke', 'var(--bg-primary)')
      .attr('stroke-width', 2)
      .style('opacity', 0)

    const tooltip = d3.select(tooltipRef.current)

    // Bisector for finding closest data point
    const bisect = d3.bisector((d: typeof data[0]) => d.amountIn).left

    // Overlay for mouse events
    g.append('rect')
      .attr('width', width)
      .attr('height', height)
      .attr('fill', 'transparent')
      .on('mousemove', function(event) {
        const [mouseX] = d3.pointer(event)
        const x0 = xScale.invert(mouseX)
        const i = bisect(data, x0, 1)
        const d0 = data[i - 1]
        const d1 = data[i]
        if (!d0 && !d1) return
        const d = !d1 ? d0 : !d0 ? d1 : x0 - d0.amountIn > d1.amountIn - x0 ? d1 : d0

        const cx = xScale(d.amountIn)
        const cy = yScale(d.effectivePrice)

        hoverLine
          .attr('x1', cx)
          .attr('x2', cx)
          .attr('y1', 0)
          .attr('y2', height)
          .style('opacity', 0.5)

        hoverCircle
          .attr('cx', cx)
          .attr('cy', cy)
          .style('opacity', 1)

        tooltip
          .style('opacity', 1)
          .style('left', `${cx + margin.left + 10}px`)
          .style('top', `${cy + margin.top - 10}px`)
          .html(`
            <div class="text-xs">
              <div><span class="text-[var(--text-muted)]">In:</span> ${formatNumber(d.amountIn)} ${tokenIn.symbol}</div>
              <div><span class="text-[var(--text-muted)]">Price:</span> ${formatNumber(d.effectivePrice)}</div>
              <div><span class="text-[var(--text-muted)]">Impact:</span> <span class="${d.slippage > 5 ? 'text-[var(--neon-red)]' : d.slippage > 1 ? 'text-yellow-500' : 'text-[var(--neon-green)]'}">${d.slippage.toFixed(2)}%</span></div>
            </div>
          `)
      })
      .on('mouseleave', function() {
        hoverLine.style('opacity', 0)
        hoverCircle.style('opacity', 0)
        tooltip.style('opacity', 0)
      })

  }, [slippageAnalysis, pool.initialized, swapDirection, tokenIn.decimals, tokenIn.symbol, tokenOut.symbol])

  if (!pool.initialized) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Price Impact Curve</CardTitle>
      </CardHeader>
      <CardContent>
        {!slippageAnalysis || slippageAnalysis.points.length === 0 ? (
          <div className="h-[240px] flex items-center justify-center text-[var(--text-muted)]">
            Add liquidity to see price impact curve
          </div>
        ) : slippageAnalysis.points.filter(p => p.slippagePercent < 100 && Number.isFinite(p.effectivePrice)).length < 2 ? (
          <div className="h-[240px] flex items-center justify-center text-[var(--text-muted)] text-center px-4">
            Not enough liquidity for price impact analysis.<br/>
            <span className="text-xs">Add more liquidity or reduce swap amount.</span>
          </div>
        ) : (
          <div className="relative">
            <svg
              ref={svgRef}
              width="100%"
              height="240"
              style={{ overflow: 'visible' }}
            />
            <div
              ref={tooltipRef}
              className="absolute pointer-events-none bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg px-2 py-1 shadow-lg transition-opacity"
              style={{ opacity: 0 }}
            />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
