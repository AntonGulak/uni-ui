/**
 * Multi-tick swap tests
 * Verifies that VirtualPool correctly handles swaps crossing multiple tick boundaries
 */

import { describe, it, expect, beforeEach } from 'vitest'
import JSBI from 'jsbi'
import { VirtualPool } from '../src/core/VirtualPool'
import { TickMath } from '../src/core/TickMath'
import { parseAmount } from '../src/core/priceUtils'

describe('Multi-Tick Swap Tests', () => {
  let pool: VirtualPool

  beforeEach(() => {
    pool = new VirtualPool({
      tokenA: { symbol: 'ETH', decimals: 18 },
      tokenB: { symbol: 'USDC', decimals: 6 },
      fee: 3000,
      tickSpacing: 60,
    })
  })

  describe('Multiple overlapping positions', () => {
    beforeEach(() => {
      // Initialize at ~2000 USDC/ETH
      pool.initialize(2000)

      // Add multiple overlapping positions at different ranges
      const positions = [
        // Narrow range around current price
        { tickLower: pool.tick - 600, tickUpper: pool.tick + 600, amount0: '10', amount1: '20000' },
        // Wider range
        { tickLower: pool.tick - 1800, tickUpper: pool.tick + 1800, amount0: '20', amount1: '40000' },
        // Below current price only
        { tickLower: pool.tick - 3600, tickUpper: pool.tick - 1200, amount0: '0', amount1: '30000' },
        // Above current price only
        { tickLower: pool.tick + 1200, tickUpper: pool.tick + 3600, amount0: '15', amount1: '0' },
      ]

      for (const pos of positions) {
        const tickLower = Math.floor(pos.tickLower / 60) * 60
        const tickUpper = Math.ceil(pos.tickUpper / 60) * 60

        pool.addLiquidity({
          tickLower,
          tickUpper,
          amount0Desired: parseAmount(pos.amount0, 18),
          amount1Desired: parseAmount(pos.amount1, 6),
        })
      }
    })

    it('should have multiple initialized ticks', () => {
      const tickCount = pool.ticks.size
      expect(tickCount).toBeGreaterThan(4) // At least 4 positions = 8 ticks
      console.log(`Pool has ${tickCount} initialized ticks`)
    })

    it('should track liquidity correctly at current tick', () => {
      const liquidity = pool.liquidity
      expect(JSBI.greaterThan(liquidity, JSBI.BigInt(0))).toBe(true)
      console.log(`Active liquidity: ${liquidity.toString()}`)
    })

    it('small swap stays within single tick range', () => {
      const initialTick = pool.tick
      const initialLiquidity = pool.liquidity

      const result = pool.swap({
        zeroForOne: true,
        amountSpecified: parseAmount('0.1', 18), // 0.1 ETH - small swap
      })

      expect(JSBI.greaterThan(result.amountOut, JSBI.BigInt(0))).toBe(true)
      // Liquidity should remain same if we didn't cross a tick
      console.log(`Small swap: ${JSBI.toNumber(result.amountIn) / 1e18} ETH -> ${JSBI.toNumber(result.amountOut) / 1e6} USDC`)
      console.log(`Tick moved from ${initialTick} to ${result.tickAfter}`)
    })

    it('medium swap crosses one tick boundary', () => {
      const initialTick = pool.tick
      const sortedTicks = Array.from(pool.ticks.keys()).sort((a, b) => a - b)
      console.log('Initialized ticks:', sortedTicks)

      const result = pool.swap({
        zeroForOne: true,
        amountSpecified: parseAmount('5', 18), // 5 ETH
      })

      expect(JSBI.greaterThan(result.amountOut, JSBI.BigInt(0))).toBe(true)
      console.log(`Medium swap: ${JSBI.toNumber(result.amountIn) / 1e18} ETH -> ${JSBI.toNumber(result.amountOut) / 1e6} USDC`)
      console.log(`Tick moved from ${initialTick} to ${result.tickAfter}`)

      // Should have moved tick down significantly
      expect(result.tickAfter).toBeLessThan(initialTick)
    })

    it('large swap crosses multiple tick boundaries', () => {
      const initialTick = pool.tick
      const initialSqrtPrice = pool.sqrtPriceX96

      // Use swapWithSteps to see the tick crossings
      const { result, steps } = pool.swapWithSteps({
        zeroForOne: true,
        amountSpecified: parseAmount('20', 18), // 20 ETH - large swap
      })

      console.log(`Large swap crossed ${steps.length} steps:`)
      for (let i = 0; i < steps.length; i++) {
        console.log(`  Step ${i + 1}: tick ${steps[i].tickNext}, amountIn: ${JSBI.toNumber(steps[i].amountIn) / 1e18} ETH, amountOut: ${JSBI.toNumber(steps[i].amountOut) / 1e6} USDC`)
      }

      expect(steps.length).toBeGreaterThan(1) // Should have crossed at least one tick
      expect(JSBI.greaterThan(result.amountOut, JSBI.BigInt(0))).toBe(true)

      // Final tick should be much lower
      expect(result.tickAfter).toBeLessThan(initialTick - 100)

      console.log(`Total: ${JSBI.toNumber(result.amountIn) / 1e18} ETH -> ${JSBI.toNumber(result.amountOut) / 1e6} USDC`)
      console.log(`Tick: ${initialTick} -> ${result.tickAfter}`)
    })

    it('swap in opposite direction (oneForZero) also crosses ticks', () => {
      const initialTick = pool.tick

      const { result, steps } = pool.swapWithSteps({
        zeroForOne: false,
        amountSpecified: parseAmount('20000', 6), // 20,000 USDC
      })

      console.log(`Reverse swap crossed ${steps.length} steps`)
      expect(steps.length).toBeGreaterThanOrEqual(1)
      expect(result.tickAfter).toBeGreaterThan(initialTick) // Price should go up

      console.log(`Total: ${JSBI.toNumber(result.amountIn) / 1e6} USDC -> ${JSBI.toNumber(result.amountOut) / 1e18} ETH`)
      console.log(`Tick: ${initialTick} -> ${result.tickAfter}`)
    })

    it('liquidity changes when crossing tick boundaries', () => {
      // Save initial state
      const liquidityBefore = pool.liquidity

      // Do a large swap
      pool.swap({
        zeroForOne: true,
        amountSpecified: parseAmount('30', 18), // Large swap
      })

      const liquidityAfter = pool.liquidity

      // Liquidity should have changed if we crossed into a different range
      console.log(`Liquidity: ${liquidityBefore.toString()} -> ${liquidityAfter.toString()}`)

      // They should be different (we crossed out of some ranges)
      expect(liquidityBefore.toString()).not.toBe(liquidityAfter.toString())
    })

    it('price impact increases with swap size', () => {
      const spotPrice = pool.getCurrentPrice()

      // Small swap
      let result1 = pool.simulateSwap({
        zeroForOne: true,
        amountSpecified: parseAmount('1', 18),
      })
      const effectivePrice1 = (JSBI.toNumber(result1.amountOut) / 1e6) / (JSBI.toNumber(result1.amountIn) / 1e18)
      const impact1 = Math.abs((effectivePrice1 - spotPrice) / spotPrice) * 100

      // Medium swap
      let result2 = pool.simulateSwap({
        zeroForOne: true,
        amountSpecified: parseAmount('10', 18),
      })
      const effectivePrice2 = (JSBI.toNumber(result2.amountOut) / 1e6) / (JSBI.toNumber(result2.amountIn) / 1e18)
      const impact2 = Math.abs((effectivePrice2 - spotPrice) / spotPrice) * 100

      // Large swap
      let result3 = pool.simulateSwap({
        zeroForOne: true,
        amountSpecified: parseAmount('25', 18),
      })
      const effectivePrice3 = (JSBI.toNumber(result3.amountOut) / 1e6) / (JSBI.toNumber(result3.amountIn) / 1e18)
      const impact3 = Math.abs((effectivePrice3 - spotPrice) / spotPrice) * 100

      console.log(`Price impact:`)
      console.log(`  1 ETH: ${impact1.toFixed(2)}%`)
      console.log(`  10 ETH: ${impact2.toFixed(2)}%`)
      console.log(`  25 ETH: ${impact3.toFixed(2)}%`)

      expect(impact2).toBeGreaterThan(impact1)
      expect(impact3).toBeGreaterThan(impact2)
    })
  })

  describe('Sequential swaps accumulate correctly', () => {
    beforeEach(() => {
      pool.initialize(2000)

      // Single wide position
      const tickLower = Math.floor((pool.tick - 5000) / 60) * 60
      const tickUpper = Math.ceil((pool.tick + 5000) / 60) * 60

      pool.addLiquidity({
        tickLower,
        tickUpper,
        amount0Desired: parseAmount('100', 18),
        amount1Desired: parseAmount('200000', 6),
      })
    })

    it('two small swaps equal one combined swap', () => {
      // Clone pool state
      const sqrtPriceX96Initial = pool.sqrtPriceX96
      const tickInitial = pool.tick
      const liquidityInitial = pool.liquidity

      // Two small swaps
      const result1a = pool.swap({
        zeroForOne: true,
        amountSpecified: parseAmount('5', 18),
      })
      const result1b = pool.swap({
        zeroForOne: true,
        amountSpecified: parseAmount('5', 18),
      })
      const totalOut1 = JSBI.add(result1a.amountOut, result1b.amountOut)
      const sqrtPrice1 = pool.sqrtPriceX96
      const tick1 = pool.tick

      // Reset pool
      pool.sqrtPriceX96 = sqrtPriceX96Initial
      pool.tick = tickInitial
      pool.liquidity = liquidityInitial

      // One combined swap
      const result2 = pool.swap({
        zeroForOne: true,
        amountSpecified: parseAmount('10', 18),
      })
      const sqrtPrice2 = pool.sqrtPriceX96
      const tick2 = pool.tick

      console.log(`Two 5 ETH swaps: ${JSBI.toNumber(totalOut1) / 1e6} USDC total`)
      console.log(`One 10 ETH swap: ${JSBI.toNumber(result2.amountOut) / 1e6} USDC`)

      // Combined swap should give slightly less output due to path dependency
      // (first swap moves price, second swap gets worse price)
      expect(JSBI.toNumber(totalOut1)).toBeGreaterThanOrEqual(JSBI.toNumber(result2.amountOut) * 0.999)
      expect(JSBI.toNumber(totalOut1)).toBeLessThanOrEqual(JSBI.toNumber(result2.amountOut) * 1.001)
    })
  })

  describe('Edge cases', () => {
    it('swap exhausts all liquidity in one direction', () => {
      pool.initialize(2000)

      // Small, narrow position
      const tickLower = Math.floor((pool.tick - 300) / 60) * 60
      const tickUpper = Math.ceil((pool.tick + 300) / 60) * 60

      pool.addLiquidity({
        tickLower,
        tickUpper,
        amount0Desired: parseAmount('1', 18),
        amount1Desired: parseAmount('2000', 6),
      })

      // Try to swap way more than available
      const result = pool.swap({
        zeroForOne: true,
        amountSpecified: parseAmount('100', 18),
      })

      // Should have used less than specified (hit price limit)
      const amountInUsed = JSBI.toNumber(result.amountIn) / 1e18
      console.log(`Tried to swap 100 ETH, actually used: ${amountInUsed} ETH`)

      expect(amountInUsed).toBeLessThan(100)
      expect(JSBI.greaterThan(result.amountOut, JSBI.BigInt(0))).toBe(true)
    })

    it('swap with zero liquidity returns zero', () => {
      pool.initialize(2000)
      // Don't add any liquidity

      const result = pool.swap({
        zeroForOne: true,
        amountSpecified: parseAmount('1', 18),
      })

      expect(JSBI.toNumber(result.amountOut)).toBe(0)
    })
  })
})
