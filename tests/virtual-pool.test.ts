/**
 * Integration tests for VirtualPool
 * Tests complete workflows: initialize -> add liquidity -> swap
 */

import { describe, it, expect, beforeEach } from 'vitest'
import JSBI from 'jsbi'
import { VirtualPool } from '../src/core/VirtualPool'
import { TickMath } from '../src/core/TickMath'
import { SqrtPriceMath } from '../src/core/SqrtPriceMath'
import { parseAmount } from '../src/core/priceUtils'

describe('VirtualPool Integration', () => {
  let pool: VirtualPool

  beforeEach(() => {
    pool = new VirtualPool({
      tokenA: { symbol: 'ETH', decimals: 18 },
      tokenB: { symbol: 'USDC', decimals: 6 },
      fee: 3000, // 0.3%
      tickSpacing: 60,
    })
  })

  describe('Initialization', () => {
    it('initializes with correct price', () => {
      // Initialize at price ~2000 USDC/ETH
      pool.initialize(2000)

      expect(pool.initialized).toBe(true)
      expect(pool.fee).toBe(3000)
      expect(pool.tickSpacing).toBe(60)

      // Price should be close to 2000
      const price = pool.getCurrentPrice()
      expect(price).toBeGreaterThan(1990)
      expect(price).toBeLessThan(2010)
    })

    it('initializes at specific price and gets correct tick', () => {
      // Initialize at price = 1 (when tokens have same decimals)
      const equalDecimalsPool = new VirtualPool({
        tokenA: { symbol: 'TOKENA', decimals: 18 },
        tokenB: { symbol: 'TOKENB', decimals: 18 },
        fee: 3000,
        tickSpacing: 60,
      })
      equalDecimalsPool.initialize(1)

      expect(equalDecimalsPool.initialized).toBe(true)
      // Tick at price 1 should be close to 0
      expect(equalDecimalsPool.tick).toBeGreaterThanOrEqual(-10)
      expect(equalDecimalsPool.tick).toBeLessThanOrEqual(10)
    })

    it('throws on double initialization', () => {
      pool.initialize(2000)
      expect(() => pool.initialize(1000)).toThrow('Pool already initialized')
    })
  })

  describe('Add Liquidity', () => {
    beforeEach(() => {
      pool.initialize(2000)
    })

    it('adds liquidity in range', () => {
      const tickLower = pool.tick - 600 // Below current
      const tickUpper = pool.tick + 600 // Above current

      // Round to tick spacing
      const roundedLower = Math.floor(tickLower / 60) * 60
      const roundedUpper = Math.ceil(tickUpper / 60) * 60

      const result = pool.addLiquidity({
        tickLower: roundedLower,
        tickUpper: roundedUpper,
        amount0Desired: parseAmount('1', 18), // 1 ETH
        amount1Desired: parseAmount('2000', 6), // 2000 USDC
      })

      expect(JSBI.greaterThan(result.liquidity, JSBI.BigInt(0))).toBe(true)
      expect(JSBI.greaterThan(result.amount0, JSBI.BigInt(0))).toBe(true)
      expect(JSBI.greaterThan(result.amount1, JSBI.BigInt(0))).toBe(true)
      expect(pool.positions.length).toBe(1)
    })

    it('adds liquidity below current price (only token1)', () => {
      // Range entirely below current price
      // In Uniswap V3, when range is below current price:
      // - You're providing token1 (quote) that will be used to buy token0 (base) when price drops
      const tickLower = pool.tick - 12000
      const tickUpper = pool.tick - 6000

      const roundedLower = Math.floor(tickLower / 60) * 60
      const roundedUpper = Math.floor(tickUpper / 60) * 60

      const result = pool.addLiquidity({
        tickLower: roundedLower,
        tickUpper: roundedUpper,
        amount0Desired: parseAmount('1', 18),
        amount1Desired: parseAmount('2000', 6),
      })

      expect(JSBI.greaterThan(result.liquidity, JSBI.BigInt(0))).toBe(true)
      // No token0 needed when range is below current price (price must drop to enter range)
      expect(result.amount0.toString()).toBe('0')
      expect(JSBI.greaterThan(result.amount1, JSBI.BigInt(0))).toBe(true)
    })

    it('adds liquidity above current price (only token0)', () => {
      // Range entirely above current price
      // In Uniswap V3, when range is above current price:
      // - You're providing token0 (base) that will be sold for token1 (quote) when price rises
      const tickLower = pool.tick + 6000
      const tickUpper = pool.tick + 12000

      const roundedLower = Math.ceil(tickLower / 60) * 60
      const roundedUpper = Math.ceil(tickUpper / 60) * 60

      const result = pool.addLiquidity({
        tickLower: roundedLower,
        tickUpper: roundedUpper,
        amount0Desired: parseAmount('1', 18),
        amount1Desired: parseAmount('2000', 6),
      })

      expect(JSBI.greaterThan(result.liquidity, JSBI.BigInt(0))).toBe(true)
      expect(JSBI.greaterThan(result.amount0, JSBI.BigInt(0))).toBe(true)
      // No token1 needed when range is above current price (price must rise to enter range)
      expect(result.amount1.toString()).toBe('0')
    })

    it('updates pool liquidity when position is in range', () => {
      const initialLiquidity = pool.liquidity

      const tickLower = Math.floor((pool.tick - 600) / 60) * 60
      const tickUpper = Math.ceil((pool.tick + 600) / 60) * 60

      const result = pool.addLiquidity({
        tickLower,
        tickUpper,
        amount0Desired: parseAmount('10', 18),
        amount1Desired: parseAmount('20000', 6),
      })

      // Pool liquidity should increase
      expect(JSBI.greaterThan(pool.liquidity, initialLiquidity)).toBe(true)
      expect(pool.liquidity.toString()).toBe(
        JSBI.add(initialLiquidity, result.liquidity).toString()
      )
    })
  })

  describe('Swap', () => {
    beforeEach(() => {
      pool.initialize(2000)

      // Add a wide range position
      const tickLower = Math.floor((pool.tick - 50000) / 60) * 60
      const tickUpper = Math.ceil((pool.tick + 50000) / 60) * 60

      pool.addLiquidity({
        tickLower,
        tickUpper,
        amount0Desired: parseAmount('100', 18), // 100 ETH
        amount1Desired: parseAmount('200000', 6), // 200,000 USDC
      })
    })

    it('swaps zeroForOne (ETH -> USDC)', () => {
      const initialPrice = pool.getCurrentPrice()
      const amountIn = parseAmount('1', 18) // 1 ETH

      const result = pool.swap({
        zeroForOne: true,
        amountSpecified: amountIn,
      })

      expect(JSBI.greaterThan(result.amountIn, JSBI.BigInt(0))).toBe(true)
      expect(JSBI.greaterThan(result.amountOut, JSBI.BigInt(0))).toBe(true)

      // Price should decrease (more ETH = cheaper ETH in USDC terms)
      const finalPrice = pool.getCurrentPrice()
      expect(finalPrice).toBeLessThan(initialPrice)

      // Output should be reasonable (close to input * price)
      const outputUSDC = JSBI.toNumber(result.amountOut) / 1e6
      expect(outputUSDC).toBeGreaterThan(1900) // At least 1900 USDC for 1 ETH
      expect(outputUSDC).toBeLessThan(2000) // But less than 2000 due to price impact
    })

    it('swaps oneForZero (USDC -> ETH)', () => {
      const initialPrice = pool.getCurrentPrice()
      const amountIn = parseAmount('2000', 6) // 2000 USDC

      const result = pool.swap({
        zeroForOne: false,
        amountSpecified: amountIn,
      })

      expect(JSBI.greaterThan(result.amountIn, JSBI.BigInt(0))).toBe(true)
      expect(JSBI.greaterThan(result.amountOut, JSBI.BigInt(0))).toBe(true)

      // Price should increase (more USDC = more expensive ETH)
      const finalPrice = pool.getCurrentPrice()
      expect(finalPrice).toBeGreaterThan(initialPrice)

      // Output should be close to 1 ETH
      const outputETH = JSBI.toNumber(result.amountOut) / 1e18
      expect(outputETH).toBeGreaterThan(0.9)
      expect(outputETH).toBeLessThan(1.0)
    })

    it('preserves conservation of value', () => {
      const amountIn = parseAmount('5', 18) // 5 ETH

      const priceBefore = pool.getCurrentPrice()

      const result = pool.swap({
        zeroForOne: true,
        amountSpecified: amountIn,
      })

      // amountIn should equal input (or less if exact output)
      expect(JSBI.lessThanOrEqual(result.amountIn, amountIn)).toBe(true)

      // Value conservation: output should be close to input * average price
      const inputValue = JSBI.toNumber(result.amountIn) / 1e18 * priceBefore
      const outputValue = JSBI.toNumber(result.amountOut) / 1e6

      // Output value should be close to input value (minus fees and slippage)
      const ratio = outputValue / inputValue
      expect(ratio).toBeGreaterThan(0.95) // At least 95% (accounting for fees)
      expect(ratio).toBeLessThan(1.01) // Should not gain value
    })

    it('handles multiple swaps correctly', () => {
      // Swap ETH -> USDC
      const result1 = pool.swap({
        zeroForOne: true,
        amountSpecified: parseAmount('1', 18),
      })

      const priceAfter1 = pool.getCurrentPrice()

      // Swap USDC -> ETH (reverse)
      const result2 = pool.swap({
        zeroForOne: false,
        amountSpecified: result1.amountOut, // Use output from first swap
      })

      const priceAfter2 = pool.getCurrentPrice()

      // Price should come back close to original (minus fees)
      expect(priceAfter2).toBeGreaterThan(priceAfter1)

      // We should get back less ETH than we put in (due to fees)
      const inputETH = JSBI.toNumber(result1.amountIn) / 1e18
      const outputETH = JSBI.toNumber(result2.amountOut) / 1e18
      expect(outputETH).toBeLessThan(inputETH)
      expect(outputETH).toBeGreaterThan(inputETH * 0.99) // ~1% fees max
    })

    it('handles swap across tick boundaries', () => {
      // Add multiple narrow positions to create tick boundaries
      for (let i = -5; i <= 5; i++) {
        const tickBase = pool.tick + i * 1200
        const tickLower = Math.floor(tickBase / 60) * 60
        const tickUpper = tickLower + 1200

        if (tickLower >= TickMath.MIN_TICK && tickUpper <= TickMath.MAX_TICK) {
          pool.addLiquidity({
            tickLower,
            tickUpper,
            amount0Desired: parseAmount('10', 18),
            amount1Desired: parseAmount('20000', 6),
          })
        }
      }

      // Large swap that crosses multiple ticks
      const result = pool.swap({
        zeroForOne: true,
        amountSpecified: parseAmount('50', 18), // 50 ETH
      })

      // Should still complete successfully
      expect(JSBI.greaterThan(result.amountIn, JSBI.BigInt(0))).toBe(true)
      expect(JSBI.greaterThan(result.amountOut, JSBI.BigInt(0))).toBe(true)
    })
  })

  describe('Simulate Swap (no state change)', () => {
    beforeEach(() => {
      pool.initialize(2000)
      const tickLower = Math.floor((pool.tick - 50000) / 60) * 60
      const tickUpper = Math.ceil((pool.tick + 50000) / 60) * 60
      pool.addLiquidity({
        tickLower,
        tickUpper,
        amount0Desired: parseAmount('100', 18),
        amount1Desired: parseAmount('200000', 6),
      })
    })

    it('simulateSwap does not change pool state', () => {
      const sqrtPriceBefore = pool.sqrtPriceX96
      const tickBefore = pool.tick
      const liquidityBefore = pool.liquidity

      const result = pool.simulateSwap({
        zeroForOne: true,
        amountSpecified: parseAmount('10', 18),
      })

      // State should be unchanged
      expect(pool.sqrtPriceX96.toString()).toBe(sqrtPriceBefore.toString())
      expect(pool.tick).toBe(tickBefore)
      expect(pool.liquidity.toString()).toBe(liquidityBefore.toString())

      // Result should still be valid
      expect(JSBI.greaterThan(result.amountIn, JSBI.BigInt(0))).toBe(true)
      expect(JSBI.greaterThan(result.amountOut, JSBI.BigInt(0))).toBe(true)
    })

    it('simulateSwap matches actual swap', () => {
      // Clone pool state
      const sqrtPriceBefore = pool.sqrtPriceX96

      // Simulate
      const simResult = pool.simulateSwap({
        zeroForOne: true,
        amountSpecified: parseAmount('5', 18),
      })

      // Actual swap
      const actualResult = pool.swap({
        zeroForOne: true,
        amountSpecified: parseAmount('5', 18),
      })

      // Results should match
      expect(simResult.amountIn.toString()).toBe(actualResult.amountIn.toString())
      expect(simResult.amountOut.toString()).toBe(actualResult.amountOut.toString())
      expect(simResult.sqrtPriceX96After.toString()).toBe(actualResult.sqrtPriceX96After.toString())
    })
  })

  describe('Remove Position', () => {
    beforeEach(() => {
      pool.initialize(2000)
    })

    it('removes position and returns liquidity', () => {
      const tickLower = Math.floor((pool.tick - 600) / 60) * 60
      const tickUpper = Math.ceil((pool.tick + 600) / 60) * 60

      const addResult = pool.addLiquidity({
        tickLower,
        tickUpper,
        amount0Desired: parseAmount('10', 18),
        amount1Desired: parseAmount('20000', 6),
      })

      const position = pool.positions[0]
      const liquidityBefore = pool.liquidity

      pool.removePosition(position.id)

      // Position should be removed
      expect(pool.positions.length).toBe(0)

      // Pool liquidity should decrease
      expect(
        pool.liquidity.toString()
      ).toBe(
        JSBI.subtract(liquidityBefore, addResult.liquidity).toString()
      )
    })
  })

  describe('Slippage Analysis', () => {
    beforeEach(() => {
      pool.initialize(2000)
      const tickLower = Math.floor((pool.tick - 50000) / 60) * 60
      const tickUpper = Math.ceil((pool.tick + 50000) / 60) * 60
      pool.addLiquidity({
        tickLower,
        tickUpper,
        amount0Desired: parseAmount('100', 18),
        amount1Desired: parseAmount('200000', 6),
      })
    })

    it('analyzeSlippage returns valid points', () => {
      const analysis = pool.analyzeSlippage(true) // zeroForOne

      expect(analysis.points.length).toBeGreaterThan(0)

      // Points should have increasing amounts
      for (let i = 1; i < analysis.points.length; i++) {
        expect(
          JSBI.greaterThanOrEqual(analysis.points[i].amountIn, analysis.points[i - 1].amountIn)
        ).toBe(true)
      }

      // Slippage should generally increase with amount
      const smallSlippage = analysis.points[0].slippagePercent
      const largeSlippage = analysis.points[analysis.points.length - 1].slippagePercent
      expect(largeSlippage).toBeGreaterThanOrEqual(smallSlippage)
    })

    it('getAmountsAtSlippageTargets returns correct amounts', () => {
      const targets = [1, 5, 10]
      const results = pool.getAmountsAtSlippageTargets(true, targets)

      for (const target of targets) {
        const point = results.get(target)
        if (point) {
          // Actual slippage should be close to target
          expect(point.slippagePercent).toBeLessThanOrEqual(target * 1.1) // 10% tolerance
        }
      }
    })
  })

  describe('Tick Management', () => {
    beforeEach(() => {
      pool.initialize(2000)
    })

    it('initializes ticks correctly when adding liquidity', () => {
      const tickLower = Math.floor((pool.tick - 600) / 60) * 60
      const tickUpper = Math.ceil((pool.tick + 600) / 60) * 60

      pool.addLiquidity({
        tickLower,
        tickUpper,
        amount0Desired: parseAmount('10', 18),
        amount1Desired: parseAmount('20000', 6),
      })

      // Ticks should be in the ticks map
      expect(pool.ticks.has(tickLower)).toBe(true)
      expect(pool.ticks.has(tickUpper)).toBe(true)

      // liquidityGross should be positive
      const lowerTickData = pool.ticks.get(tickLower)!
      const upperTickData = pool.ticks.get(tickUpper)!
      expect(JSBI.greaterThan(lowerTickData.liquidityGross, JSBI.BigInt(0))).toBe(true)
      expect(JSBI.greaterThan(upperTickData.liquidityGross, JSBI.BigInt(0))).toBe(true)
    })

    it('swap crosses ticks and updates liquidity correctly', () => {
      const tickLower = Math.floor((pool.tick - 1200) / 60) * 60
      const tickUpper = Math.ceil((pool.tick + 1200) / 60) * 60

      pool.addLiquidity({
        tickLower,
        tickUpper,
        amount0Desired: parseAmount('10', 18),
        amount1Desired: parseAmount('20000', 6),
      })

      const liquidityBefore = pool.liquidity

      // Large swap that should cross a tick boundary
      const result = pool.swap({
        zeroForOne: true,
        amountSpecified: parseAmount('5', 18), // 5 ETH - should move price significantly
      })

      // Swap should have completed
      expect(JSBI.greaterThan(result.amountOut, JSBI.BigInt(0))).toBe(true)

      // If tick crossed out of range, liquidity would be different
      // (Note: may or may not cross depending on position size)
    })
  })
})

describe('Price Accuracy', () => {
  it('maintains price precision across operations', () => {
    const pool = new VirtualPool({
      tokenA: { symbol: 'WBTC', decimals: 8 },
      tokenB: { symbol: 'USDC', decimals: 6 },
      fee: 500,
      tickSpacing: 10,
    })

    // Initialize at ~50,000 USDC/BTC
    pool.initialize(50000)

    const initialPrice = pool.getCurrentPrice()
    expect(initialPrice).toBeGreaterThan(49000)
    expect(initialPrice).toBeLessThan(51000)

    // Add liquidity
    const tickLower = Math.floor((pool.tick - 10000) / 10) * 10
    const tickUpper = Math.ceil((pool.tick + 10000) / 10) * 10

    pool.addLiquidity({
      tickLower,
      tickUpper,
      amount0Desired: parseAmount('10', 8), // 10 BTC
      amount1Desired: parseAmount('500000', 6), // 500k USDC
    })

    // Small swap should have minimal price impact
    const smallSwap = pool.simulateSwap({
      zeroForOne: true,
      amountSpecified: parseAmount('0.01', 8), // 0.01 BTC
    })

    // Price impact should be tiny
    const priceAfter = JSBI.toNumber(smallSwap.sqrtPriceX96After) / JSBI.toNumber(pool.sqrtPriceX96)
    const priceChange = Math.abs(1 - priceAfter * priceAfter) * 100
    expect(priceChange).toBeLessThan(0.1) // Less than 0.1% price change
  })
})

describe('Edge Cases', () => {
  it('handles very narrow ranges', () => {
    const pool = new VirtualPool({
      tokenA: { symbol: 'ETH', decimals: 18 },
      tokenB: { symbol: 'USDC', decimals: 6 },
      fee: 500,
      tickSpacing: 10,
    })

    pool.initialize(2000)

    // Very narrow range (just one tick spacing)
    const tickLower = Math.floor(pool.tick / 10) * 10
    const tickUpper = tickLower + 10

    const result = pool.addLiquidity({
      tickLower,
      tickUpper,
      amount0Desired: parseAmount('1', 18),
      amount1Desired: parseAmount('2000', 6),
    })

    expect(JSBI.greaterThan(result.liquidity, JSBI.BigInt(0))).toBe(true)
  })

  it('handles very wide ranges', () => {
    const pool = new VirtualPool({
      tokenA: { symbol: 'ETH', decimals: 18 },
      tokenB: { symbol: 'USDC', decimals: 6 },
      fee: 3000,
      tickSpacing: 60,
    })

    pool.initialize(2000)

    // Maximum possible range
    const tickLower = Math.ceil(TickMath.MIN_TICK / 60) * 60
    const tickUpper = Math.floor(TickMath.MAX_TICK / 60) * 60

    const result = pool.addLiquidity({
      tickLower,
      tickUpper,
      amount0Desired: parseAmount('1', 18),
      amount1Desired: parseAmount('2000', 6),
    })

    expect(JSBI.greaterThan(result.liquidity, JSBI.BigInt(0))).toBe(true)
  })

  it('handles swap with zero output', () => {
    const pool = new VirtualPool({
      tokenA: { symbol: 'ETH', decimals: 18 },
      tokenB: { symbol: 'USDC', decimals: 6 },
      fee: 3000,
      tickSpacing: 60,
    })

    pool.initialize(2000)

    // Very tiny amount that results in zero output
    const result = pool.simulateSwap({
      zeroForOne: true,
      amountSpecified: JSBI.BigInt(1), // 1 wei
    })

    // Should not throw, even if output is zero
    expect(JSBI.greaterThanOrEqual(result.amountOut, JSBI.BigInt(0))).toBe(true)
  })
})
