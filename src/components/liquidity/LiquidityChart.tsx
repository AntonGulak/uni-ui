import { useEffect, useRef } from 'react'
import * as d3 from 'd3'
import JSBI from 'jsbi'
import { usePoolStore } from '../../store/usePoolStore'
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card'
import { tickToPrice } from '../../core'

export function LiquidityChart() {
  const svgRef = useRef<SVGSVGElement>(null)
  const { pool, liquidityDistribution, updateLiquidityDistribution } = usePoolStore()

  useEffect(() => {
    if (pool.initialized) {
      updateLiquidityDistribution()
    }
  }, [pool.positions.length, pool.initialized])

  useEffect(() => {
    if (!svgRef.current || !pool.initialized) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const margin = { top: 20, right: 30, bottom: 40, left: 60 }
    const width = svgRef.current.clientWidth - margin.left - margin.right
    const height = 250 - margin.top - margin.bottom

    if (width <= 0 || height <= 0) return

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`)

    // If no liquidity data, show placeholder
    if (liquidityDistribution.length === 0) {
      g.append('text')
        .attr('x', width / 2)
        .attr('y', height / 2)
        .attr('text-anchor', 'middle')
        .attr('fill', 'var(--text-muted)')
        .text('Add liquidity to see distribution')
      return
    }

    // Prepare data for bars
    const data = liquidityDistribution.map((d) => ({
      tickLower: d.tickLower,
      tickUpper: d.tickUpper,
      liquidity: JSBI.toNumber(d.liquidity),
      priceLower: tickToPrice(d.tickLower),
      priceUpper: tickToPrice(d.tickUpper),
    }))

    // Find tick range with some padding
    const allTicks = data.flatMap((d) => [d.tickLower, d.tickUpper])
    const minTick = Math.min(...allTicks) - pool.tickSpacing * 5
    const maxTick = Math.max(...allTicks) + pool.tickSpacing * 5

    // X scale (tick)
    const xScale = d3.scaleLinear().domain([minTick, maxTick]).range([0, width])

    // Y scale (liquidity)
    const maxLiquidity = Math.max(...data.map((d) => d.liquidity))
    const yScale = d3
      .scaleLinear()
      .domain([0, maxLiquidity * 1.1])
      .range([height, 0])

    // Gradient for bars
    const defs = svg.append('defs')
    const gradient = defs
      .append('linearGradient')
      .attr('id', 'bar-gradient')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%')

    gradient.append('stop').attr('offset', '0%').attr('stop-color', 'var(--neon-blue)')
    gradient.append('stop').attr('offset', '100%').attr('stop-color', 'var(--neon-purple)')

    // Draw bars
    g.selectAll('rect.liquidity-bar')
      .data(data)
      .enter()
      .append('rect')
      .attr('class', 'liquidity-bar chart-bar')
      .attr('x', (d) => xScale(d.tickLower))
      .attr('y', (d) => yScale(d.liquidity))
      .attr('width', (d) => Math.max(1, xScale(d.tickUpper) - xScale(d.tickLower)))
      .attr('height', (d) => height - yScale(d.liquidity))
      .attr('fill', 'url(#bar-gradient)')
      .attr('opacity', 0.8)
      .attr('rx', 2)

    // Current tick line
    const currentTick = pool.tick
    if (currentTick >= minTick && currentTick <= maxTick) {
      g.append('line')
        .attr('x1', xScale(currentTick))
        .attr('x2', xScale(currentTick))
        .attr('y1', 0)
        .attr('y2', height)
        .attr('stroke', 'var(--neon-pink)')
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', '4,4')

      g.append('text')
        .attr('x', xScale(currentTick))
        .attr('y', -5)
        .attr('text-anchor', 'middle')
        .attr('fill', 'var(--neon-pink)')
        .attr('font-size', '10px')
        .text('Current')
    }

    // X axis
    g.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(
        d3
          .axisBottom(xScale)
          .ticks(5)
          .tickFormat((d) => `${d}`)
      )
      .attr('color', 'var(--text-muted)')
      .selectAll('text')
      .attr('fill', 'var(--text-secondary)')
      .attr('font-size', '10px')

    // X axis label
    g.append('text')
      .attr('x', width / 2)
      .attr('y', height + 35)
      .attr('text-anchor', 'middle')
      .attr('fill', 'var(--text-muted)')
      .attr('font-size', '11px')
      .text('Tick')

    // Y axis
    g.append('g')
      .call(
        d3
          .axisLeft(yScale)
          .ticks(5)
          .tickFormat((d) => {
            const num = d as number
            if (num >= 1e18) return `${(num / 1e18).toFixed(1)}e18`
            if (num >= 1e15) return `${(num / 1e15).toFixed(1)}e15`
            if (num >= 1e12) return `${(num / 1e12).toFixed(1)}e12`
            if (num >= 1e9) return `${(num / 1e9).toFixed(1)}B`
            if (num >= 1e6) return `${(num / 1e6).toFixed(1)}M`
            if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K`
            return `${num}`
          })
      )
      .attr('color', 'var(--text-muted)')
      .selectAll('text')
      .attr('fill', 'var(--text-secondary)')
      .attr('font-size', '10px')

    // Y axis label
    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', -50)
      .attr('x', -height / 2)
      .attr('text-anchor', 'middle')
      .attr('fill', 'var(--text-muted)')
      .attr('font-size', '11px')
      .text('Liquidity')
  }, [liquidityDistribution, pool.tick, pool.initialized])

  if (!pool.initialized) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Liquidity Distribution</CardTitle>
      </CardHeader>
      <CardContent>
        <svg
          ref={svgRef}
          width="100%"
          height="250"
          style={{ overflow: 'visible' }}
        />
      </CardContent>
    </Card>
  )
}
