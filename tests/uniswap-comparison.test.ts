/**
 * Comprehensive comparison tests between our VirtualPool implementation
 * and the official Uniswap V3 SDK
 */

import { describe, it, expect } from 'vitest'
import JSBI from 'jsbi'

// Our implementations
import { TickMath as OurTickMath } from '../src/core/TickMath'
import { SqrtPriceMath as OurSqrtPriceMath } from '../src/core/SqrtPriceMath'
import { SwapMath as OurSwapMath } from '../src/core/SwapMath'
import {
  maxLiquidityForAmounts as ourMaxLiquidityForAmounts,
  maxLiquidityForAmount0Precise as ourMaxLiqForAmount0Precise,
  maxLiquidityForAmount1 as ourMaxLiqForAmount1,
} from '../src/core/LiquidityMath'

// Official Uniswap V3 SDK
import {
  TickMath as UniTickMath,
  SqrtPriceMath as UniSqrtPriceMath,
  SwapMath as UniSwapMath,
  maxLiquidityForAmounts as uniMaxLiquidityForAmounts,
} from '@uniswap/v3-sdk'
import { Token, CurrencyAmount } from '@uniswap/sdk-core'

// Helper to compare JSBI values
function jsbiEquals(a: JSBI, b: JSBI, tolerance = JSBI.BigInt(0)): boolean {
  const diff = JSBI.subtract(a, b)
  const absDiff = JSBI.lessThan(diff, JSBI.BigInt(0))
    ? JSBI.multiply(diff, JSBI.BigInt(-1))
    : diff
  return JSBI.lessThanOrEqual(absDiff, tolerance)
}

// Test token for the SDK
const USDC = new Token(1, '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', 6, 'USDC')
const WETH = new Token(1, '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', 18, 'WETH')

describe('TickMath Comparison', () => {
  const testTicks = [
    -887272, // MIN_TICK
    -887220,
    -500000,
    -100000,
    -50000,
    -10000,
    -1000,
    -100,
    -10,
    -1,
    0,
    1,
    10,
    100,
    1000,
    10000,
    50000,
    100000,
    500000,
    887220,
    887272, // MAX_TICK
  ]

  describe('getSqrtRatioAtTick', () => {
    testTicks.forEach((tick) => {
      it(`tick ${tick} should match`, () => {
        const ourResult = OurTickMath.getSqrtRatioAtTick(tick)
        const uniResult = UniTickMath.getSqrtRatioAtTick(tick)

        expect(ourResult.toString()).toBe(uniResult.toString())
      })
    })
  })

  describe('getTickAtSqrtRatio', () => {
    const testSqrtRatios = [
      OurTickMath.MIN_SQRT_RATIO,
      JSBI.BigInt('4295128739'), // Near MIN
      JSBI.BigInt('79228162514264337593543950336'), // tick 0
      JSBI.BigInt('1461446703485210103287273052203988822378723970341'), // Near MAX
    ]

    testSqrtRatios.forEach((sqrtRatio) => {
      it(`sqrtRatio ${sqrtRatio.toString().slice(0, 20)}... should match`, () => {
        const ourResult = OurTickMath.getTickAtSqrtRatio(sqrtRatio)
        const uniResult = UniTickMath.getTickAtSqrtRatio(sqrtRatio)

        expect(ourResult).toBe(uniResult)
      })
    })

    // Roundtrip tests
    testTicks.slice(1, -1).forEach((tick) => {
      it(`roundtrip tick ${tick}`, () => {
        const sqrtRatio = OurTickMath.getSqrtRatioAtTick(tick)
        const recoveredTick = OurTickMath.getTickAtSqrtRatio(sqrtRatio)
        const uniRecoveredTick = UniTickMath.getTickAtSqrtRatio(sqrtRatio)

        expect(recoveredTick).toBe(uniRecoveredTick)
        expect(recoveredTick).toBe(tick)
      })
    })
  })
})

describe('SqrtPriceMath Comparison', () => {
  const testCases = [
    {
      name: 'small range',
      sqrtA: JSBI.BigInt('79228162514264337593543950336'), // tick 0
      sqrtB: JSBI.BigInt('79426470787362580746886972461'), // tick ~100
      liquidity: JSBI.BigInt('1000000000000000000'), // 1e18
    },
    {
      name: 'medium range',
      sqrtA: JSBI.BigInt('56022770974786139918731938227'), // tick ~-5000
      sqrtB: JSBI.BigInt('111845585655934883912699299968'), // tick ~5000
      liquidity: JSBI.BigInt('100000000000000000000'), // 1e20
    },
    {
      name: 'wide range',
      sqrtA: JSBI.BigInt('4295128739'), // near MIN
      sqrtB: JSBI.BigInt('1461446703485210103287273052203988822378723970341'), // near MAX
      liquidity: JSBI.BigInt('1000000000000'), // 1e12
    },
    {
      name: 'ETH/USDC typical',
      sqrtA: OurTickMath.getSqrtRatioAtTick(-207240), // ~$1000
      sqrtB: OurTickMath.getSqrtRatioAtTick(-192240), // ~$4000
      liquidity: JSBI.BigInt('10000000000000000000'), // 10e18
    },
  ]

  describe('getAmount0Delta', () => {
    testCases.forEach(({ name, sqrtA, sqrtB, liquidity }) => {
      it(`${name} roundUp=true should match`, () => {
        const ourResult = OurSqrtPriceMath.getAmount0Delta(sqrtA, sqrtB, liquidity, true)
        const uniResult = UniSqrtPriceMath.getAmount0Delta(sqrtA, sqrtB, liquidity, true)

        expect(ourResult.toString()).toBe(uniResult.toString())
      })

      it(`${name} roundUp=false should match`, () => {
        const ourResult = OurSqrtPriceMath.getAmount0Delta(sqrtA, sqrtB, liquidity, false)
        const uniResult = UniSqrtPriceMath.getAmount0Delta(sqrtA, sqrtB, liquidity, false)

        expect(ourResult.toString()).toBe(uniResult.toString())
      })
    })
  })

  describe('getAmount1Delta', () => {
    testCases.forEach(({ name, sqrtA, sqrtB, liquidity }) => {
      it(`${name} roundUp=true should match`, () => {
        const ourResult = OurSqrtPriceMath.getAmount1Delta(sqrtA, sqrtB, liquidity, true)
        const uniResult = UniSqrtPriceMath.getAmount1Delta(sqrtA, sqrtB, liquidity, true)

        expect(ourResult.toString()).toBe(uniResult.toString())
      })

      it(`${name} roundUp=false should match`, () => {
        const ourResult = OurSqrtPriceMath.getAmount1Delta(sqrtA, sqrtB, liquidity, false)
        const uniResult = UniSqrtPriceMath.getAmount1Delta(sqrtA, sqrtB, liquidity, false)

        expect(ourResult.toString()).toBe(uniResult.toString())
      })
    })
  })

  describe('getNextSqrtPriceFromInput', () => {
    const inputTestCases = [
      {
        name: 'zeroForOne small input',
        sqrtP: JSBI.BigInt('79228162514264337593543950336'),
        liquidity: JSBI.BigInt('1000000000000000000'),
        amountIn: JSBI.BigInt('1000000000000000'), // 0.001 ETH
        zeroForOne: true,
      },
      {
        name: 'oneForZero small input',
        sqrtP: JSBI.BigInt('79228162514264337593543950336'),
        liquidity: JSBI.BigInt('1000000000000000000'),
        amountIn: JSBI.BigInt('1000000'), // 1 USDC
        zeroForOne: false,
      },
      {
        name: 'large liquidity',
        sqrtP: JSBI.BigInt('79228162514264337593543950336'),
        liquidity: JSBI.BigInt('10000000000000000000000'), // 10000 ETH worth
        amountIn: JSBI.BigInt('100000000000000000000'), // 100 ETH
        zeroForOne: true,
      },
    ]

    inputTestCases.forEach(({ name, sqrtP, liquidity, amountIn, zeroForOne }) => {
      it(`${name} should match`, () => {
        const ourResult = OurSqrtPriceMath.getNextSqrtPriceFromInput(sqrtP, liquidity, amountIn, zeroForOne)
        const uniResult = UniSqrtPriceMath.getNextSqrtPriceFromInput(sqrtP, liquidity, amountIn, zeroForOne)

        expect(ourResult.toString()).toBe(uniResult.toString())
      })
    })
  })

  describe('getNextSqrtPriceFromOutput', () => {
    const outputTestCases = [
      {
        name: 'zeroForOne small output',
        sqrtP: JSBI.BigInt('79228162514264337593543950336'),
        liquidity: JSBI.BigInt('1000000000000000000'),
        amountOut: JSBI.BigInt('500000'), // 0.5 USDC
        zeroForOne: true,
      },
      {
        name: 'oneForZero small output',
        sqrtP: JSBI.BigInt('79228162514264337593543950336'),
        liquidity: JSBI.BigInt('1000000000000000000'),
        amountOut: JSBI.BigInt('500000000000000'), // 0.0005 ETH
        zeroForOne: false,
      },
    ]

    outputTestCases.forEach(({ name, sqrtP, liquidity, amountOut, zeroForOne }) => {
      it(`${name} should match`, () => {
        const ourResult = OurSqrtPriceMath.getNextSqrtPriceFromOutput(sqrtP, liquidity, amountOut, zeroForOne)
        const uniResult = UniSqrtPriceMath.getNextSqrtPriceFromOutput(sqrtP, liquidity, amountOut, zeroForOne)

        expect(ourResult.toString()).toBe(uniResult.toString())
      })
    })
  })
})

describe('SwapMath Comparison', () => {
  const swapTestCases = [
    {
      name: 'exactIn zeroForOne partial fill',
      sqrtRatioCurrent: JSBI.BigInt('79228162514264337593543950336'),
      sqrtRatioTarget: JSBI.BigInt('79128162514264337593543950336'),
      liquidity: JSBI.BigInt('1000000000000000000'),
      amountRemaining: JSBI.BigInt('100000000000000000'), // 0.1 ETH (positive = exactIn)
      feePips: 3000,
    },
    {
      name: 'exactIn zeroForOne full fill',
      sqrtRatioCurrent: JSBI.BigInt('79228162514264337593543950336'),
      sqrtRatioTarget: JSBI.BigInt('79128162514264337593543950336'),
      liquidity: JSBI.BigInt('10000000000000000000000'),
      amountRemaining: JSBI.BigInt('10000000000000000'), // 0.01 ETH
      feePips: 3000,
    },
    {
      name: 'exactIn oneForZero',
      sqrtRatioCurrent: JSBI.BigInt('79228162514264337593543950336'),
      sqrtRatioTarget: JSBI.BigInt('79328162514264337593543950336'),
      liquidity: JSBI.BigInt('1000000000000000000'),
      amountRemaining: JSBI.BigInt('100000000'), // 100 USDC
      feePips: 500,
    },
    {
      name: 'exactOut zeroForOne',
      sqrtRatioCurrent: JSBI.BigInt('79228162514264337593543950336'),
      sqrtRatioTarget: JSBI.BigInt('79128162514264337593543950336'),
      liquidity: JSBI.BigInt('1000000000000000000'),
      amountRemaining: JSBI.BigInt('-50000000'), // -50 USDC (negative = exactOut)
      feePips: 3000,
    },
  ]

  describe('computeSwapStep', () => {
    swapTestCases.forEach(({ name, sqrtRatioCurrent, sqrtRatioTarget, liquidity, amountRemaining, feePips }) => {
      it(`${name} should match`, () => {
        const ourResult = OurSwapMath.computeSwapStep(
          sqrtRatioCurrent,
          sqrtRatioTarget,
          liquidity,
          amountRemaining,
          feePips
        )

        const uniResult = UniSwapMath.computeSwapStep(
          sqrtRatioCurrent,
          sqrtRatioTarget,
          liquidity,
          amountRemaining,
          feePips
        )

        expect(ourResult.sqrtRatioNextX96.toString()).toBe(uniResult[0].toString())
        expect(ourResult.amountIn.toString()).toBe(uniResult[1].toString())
        expect(ourResult.amountOut.toString()).toBe(uniResult[2].toString())
        expect(ourResult.feeAmount.toString()).toBe(uniResult[3].toString())
      })
    })
  })
})

describe('Liquidity Math Comparison', () => {
  // The Uniswap SDK's maxLiquidityForAmounts takes different params (Pool, position, etc)
  // We'll compare our raw functions against expected behavior

  describe('maxLiquidityForAmounts edge cases', () => {
    const testCases = [
      {
        name: 'price below range (only token0)',
        sqrtCurrent: JSBI.BigInt('56022770974786139918731938227'), // tick -5000
        sqrtLower: JSBI.BigInt('79228162514264337593543950336'), // tick 0
        sqrtUpper: JSBI.BigInt('79426470787362580746886972461'), // tick 100
        amount0: JSBI.BigInt('1000000000000000000'), // 1 ETH
        amount1: JSBI.BigInt('2000000000'), // 2000 USDC
      },
      {
        name: 'price in range (both tokens)',
        sqrtCurrent: JSBI.BigInt('79228162514264337593543950336'), // tick 0
        sqrtLower: JSBI.BigInt('56022770974786139918731938227'), // tick -5000
        sqrtUpper: JSBI.BigInt('111845585655934883912699299968'), // tick 5000
        amount0: JSBI.BigInt('1000000000000000000'),
        amount1: JSBI.BigInt('2000000000'),
      },
      {
        name: 'price above range (only token1)',
        sqrtCurrent: JSBI.BigInt('111845585655934883912699299968'), // tick 5000
        sqrtLower: JSBI.BigInt('56022770974786139918731938227'), // tick -5000
        sqrtUpper: JSBI.BigInt('79228162514264337593543950336'), // tick 0
        amount0: JSBI.BigInt('1000000000000000000'),
        amount1: JSBI.BigInt('2000000000'),
      },
    ]

    testCases.forEach(({ name, sqrtCurrent, sqrtLower, sqrtUpper, amount0, amount1 }) => {
      it(`${name} should be consistent`, () => {
        const ourLiquidity = ourMaxLiquidityForAmounts(
          sqrtCurrent,
          sqrtLower,
          sqrtUpper,
          amount0,
          amount1,
          true // useFullPrecision
        )

        // Verify liquidity is positive
        expect(JSBI.greaterThan(ourLiquidity, JSBI.BigInt(0))).toBe(true)

        // Verify amounts calculated from liquidity don't exceed input amounts
        const sqrtCurrentClamped = JSBI.lessThan(sqrtCurrent, sqrtLower)
          ? sqrtLower
          : JSBI.greaterThan(sqrtCurrent, sqrtUpper)
            ? sqrtUpper
            : sqrtCurrent

        if (JSBI.lessThan(sqrtCurrentClamped, sqrtUpper)) {
          const calculatedAmount0 = OurSqrtPriceMath.getAmount0Delta(
            sqrtCurrentClamped,
            sqrtUpper,
            ourLiquidity,
            true
          )
          // Should not exceed input (allow small rounding errors)
          expect(
            JSBI.lessThanOrEqual(calculatedAmount0, JSBI.add(amount0, JSBI.BigInt(1)))
          ).toBe(true)
        }

        if (JSBI.greaterThan(sqrtCurrentClamped, sqrtLower)) {
          const calculatedAmount1 = OurSqrtPriceMath.getAmount1Delta(
            sqrtLower,
            sqrtCurrentClamped,
            ourLiquidity,
            true
          )
          expect(
            JSBI.lessThanOrEqual(calculatedAmount1, JSBI.add(amount1, JSBI.BigInt(1)))
          ).toBe(true)
        }
      })
    })
  })

  describe('liquidity to amounts roundtrip', () => {
    const roundtripCases = [
      {
        name: 'in-range position',
        tickLower: -10000,
        tickUpper: 10000,
        currentTick: 0,
        amount0: JSBI.BigInt('1000000000000000000'), // 1 ETH
        amount1: JSBI.BigInt('2000000000'), // 2000 USDC
      },
      {
        name: 'narrow range',
        tickLower: -100,
        tickUpper: 100,
        currentTick: 0,
        amount0: JSBI.BigInt('5000000000000000000'),
        amount1: JSBI.BigInt('10000000000'),
      },
    ]

    roundtripCases.forEach(({ name, tickLower, tickUpper, currentTick, amount0, amount1 }) => {
      it(`${name} amounts should be recoverable from liquidity`, () => {
        const sqrtLower = OurTickMath.getSqrtRatioAtTick(tickLower)
        const sqrtUpper = OurTickMath.getSqrtRatioAtTick(tickUpper)
        const sqrtCurrent = OurTickMath.getSqrtRatioAtTick(currentTick)

        // Calculate liquidity from amounts
        const liquidity = ourMaxLiquidityForAmounts(
          sqrtCurrent,
          sqrtLower,
          sqrtUpper,
          amount0,
          amount1,
          true
        )

        // Calculate amounts from liquidity (roundUp = true for what user needs to deposit)
        const recoveredAmount0 = OurSqrtPriceMath.getAmount0Delta(sqrtCurrent, sqrtUpper, liquidity, true)
        const recoveredAmount1 = OurSqrtPriceMath.getAmount1Delta(sqrtLower, sqrtCurrent, liquidity, true)

        // At least one should match (the limiting factor)
        const amount0Match = JSBI.lessThanOrEqual(recoveredAmount0, amount0)
        const amount1Match = JSBI.lessThanOrEqual(recoveredAmount1, amount1)

        expect(amount0Match && amount1Match).toBe(true)
      })
    })
  })
})

describe('Full Swap Simulation', () => {
  // Test a complete swap through our VirtualPool logic
  it('swap simulation produces consistent results', () => {
    // Simulate a swap step by step
    const sqrtPriceStart = OurTickMath.getSqrtRatioAtTick(0)
    const sqrtPriceLimit = OurTickMath.getSqrtRatioAtTick(-1000)
    const liquidity = JSBI.BigInt('10000000000000000000000') // 10000 units
    const amountIn = JSBI.BigInt('1000000000000000000') // 1 ETH
    const feePips = 3000

    // Our swap step
    const ourStep = OurSwapMath.computeSwapStep(
      sqrtPriceStart,
      sqrtPriceLimit,
      liquidity,
      amountIn,
      feePips
    )

    // Uniswap SDK swap step
    const uniStep = UniSwapMath.computeSwapStep(
      sqrtPriceStart,
      sqrtPriceLimit,
      liquidity,
      amountIn,
      feePips
    )

    // All results should match
    expect(ourStep.sqrtRatioNextX96.toString()).toBe(uniStep[0].toString())
    expect(ourStep.amountIn.toString()).toBe(uniStep[1].toString())
    expect(ourStep.amountOut.toString()).toBe(uniStep[2].toString())
    expect(ourStep.feeAmount.toString()).toBe(uniStep[3].toString())

    // Verify conservation: amountIn + feeAmount covers the input
    const totalInput = JSBI.add(ourStep.amountIn, ourStep.feeAmount)
    expect(JSBI.lessThanOrEqual(totalInput, amountIn)).toBe(true)
  })
})

describe('Price Utils Verification', () => {
  // Test our price conversion utilities
  const priceTestCases = [
    { tick: 0, expectedPrice: 1.0 },
    { tick: 1, expectedPrice: 1.0001 },
    { tick: -1, expectedPrice: 0.9999000099990001 },
    { tick: 100, expectedPrice: Math.pow(1.0001, 100) },
    { tick: -100, expectedPrice: Math.pow(1.0001, -100) },
    { tick: 10000, expectedPrice: Math.pow(1.0001, 10000) },
  ]

  priceTestCases.forEach(({ tick, expectedPrice }) => {
    it(`tick ${tick} should give price ~${expectedPrice.toFixed(4)}`, () => {
      const sqrtRatioX96 = OurTickMath.getSqrtRatioAtTick(tick)
      // Convert sqrtRatioX96 to price: (sqrtRatioX96 / 2^96)^2
      const Q96 = JSBI.BigInt('79228162514264337593543950336')
      const sqrtPrice = JSBI.toNumber(sqrtRatioX96) / JSBI.toNumber(Q96)
      const price = sqrtPrice * sqrtPrice

      // Allow 0.01% tolerance for floating point
      const tolerance = expectedPrice * 0.0001
      expect(Math.abs(price - expectedPrice)).toBeLessThan(tolerance)
    })
  })
})

describe('Edge Cases', () => {
  it('handles MIN_TICK correctly', () => {
    const minSqrt = OurTickMath.getSqrtRatioAtTick(-887272)
    const uniMinSqrt = UniTickMath.getSqrtRatioAtTick(-887272)
    expect(minSqrt.toString()).toBe(uniMinSqrt.toString())
  })

  it('handles MAX_TICK correctly', () => {
    const maxSqrt = OurTickMath.getSqrtRatioAtTick(887272)
    const uniMaxSqrt = UniTickMath.getSqrtRatioAtTick(887272)
    expect(maxSqrt.toString()).toBe(uniMaxSqrt.toString())
  })

  it('handles zero liquidity correctly in amount calculations', () => {
    const sqrtA = OurTickMath.getSqrtRatioAtTick(0)
    const sqrtB = OurTickMath.getSqrtRatioAtTick(100)
    const zeroLiq = JSBI.BigInt(0)

    const amount0 = OurSqrtPriceMath.getAmount0Delta(sqrtA, sqrtB, zeroLiq, true)
    const amount1 = OurSqrtPriceMath.getAmount1Delta(sqrtA, sqrtB, zeroLiq, true)

    expect(amount0.toString()).toBe('0')
    expect(amount1.toString()).toBe('0')
  })

  it('handles very large amounts', () => {
    const sqrtP = JSBI.BigInt('79228162514264337593543950336')
    const liquidity = JSBI.BigInt('1000000000000000000000000000000') // Very large
    const amountIn = JSBI.BigInt('1000000000000000000000') // 1000 ETH

    // Should not throw
    const result = OurSqrtPriceMath.getNextSqrtPriceFromInput(sqrtP, liquidity, amountIn, true)
    expect(JSBI.greaterThan(result, JSBI.BigInt(0))).toBe(true)
  })
})

describe('Fee Calculation Verification', () => {
  const feeCases = [
    { feePips: 100, description: '0.01% fee' },
    { feePips: 500, description: '0.05% fee' },
    { feePips: 3000, description: '0.3% fee' },
    { feePips: 10000, description: '1% fee' },
  ]

  feeCases.forEach(({ feePips, description }) => {
    it(`${description} should calculate correctly`, () => {
      const sqrtP = JSBI.BigInt('79228162514264337593543950336')
      const sqrtTarget = JSBI.BigInt('79128162514264337593543950336')
      const liquidity = JSBI.BigInt('100000000000000000000000')
      const amountIn = JSBI.BigInt('10000000000000000000') // 10 ETH

      const ourResult = OurSwapMath.computeSwapStep(sqrtP, sqrtTarget, liquidity, amountIn, feePips)
      const uniResult = UniSwapMath.computeSwapStep(sqrtP, sqrtTarget, liquidity, amountIn, feePips)

      // Fee amounts should match exactly
      expect(ourResult.feeAmount.toString()).toBe(uniResult[3].toString())

      // Verify fee is approximately correct percentage
      const totalInput = JSBI.add(ourResult.amountIn, ourResult.feeAmount)
      const feeRatio = JSBI.toNumber(ourResult.feeAmount) / JSBI.toNumber(totalInput)
      const expectedFeeRatio = feePips / 1000000

      // Allow 1% tolerance in fee ratio
      expect(Math.abs(feeRatio - expectedFeeRatio) / expectedFeeRatio).toBeLessThan(0.01)
    })
  })
})
