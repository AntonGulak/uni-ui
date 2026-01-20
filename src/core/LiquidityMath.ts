import JSBI from 'jsbi'
import { ZERO, NEGATIVE_ONE, Q96 } from './constants'

/**
 * Liquidity math utilities
 * Ported from Uniswap V3 SDK
 */
export abstract class LiquidityMath {
  /**
   * Adds a signed liquidity delta to liquidity
   */
  static addDelta(x: JSBI, y: JSBI): JSBI {
    if (JSBI.lessThan(y, ZERO)) {
      return JSBI.subtract(x, JSBI.multiply(y, NEGATIVE_ONE))
    } else {
      return JSBI.add(x, y)
    }
  }
}

/**
 * Computes maximum liquidity for a given amount of token0
 * More precise version (divides by Q64 in intermediate step)
 */
export function maxLiquidityForAmount0Precise(
  sqrtRatioAX96: JSBI,
  sqrtRatioBX96: JSBI,
  amount0: JSBI
): JSBI {
  if (JSBI.greaterThan(sqrtRatioAX96, sqrtRatioBX96)) {
    ;[sqrtRatioAX96, sqrtRatioBX96] = [sqrtRatioBX96, sqrtRatioAX96]
  }

  const numerator = JSBI.multiply(JSBI.multiply(amount0, sqrtRatioAX96), sqrtRatioBX96)
  const denominator = JSBI.multiply(Q96, JSBI.subtract(sqrtRatioBX96, sqrtRatioAX96))
  return JSBI.divide(numerator, denominator)
}

/**
 * Computes maximum liquidity for a given amount of token0
 * Imprecise version (matches router behavior)
 */
export function maxLiquidityForAmount0Imprecise(
  sqrtRatioAX96: JSBI,
  sqrtRatioBX96: JSBI,
  amount0: JSBI
): JSBI {
  if (JSBI.greaterThan(sqrtRatioAX96, sqrtRatioBX96)) {
    ;[sqrtRatioAX96, sqrtRatioBX96] = [sqrtRatioBX96, sqrtRatioAX96]
  }

  const intermediate = JSBI.divide(JSBI.multiply(sqrtRatioAX96, sqrtRatioBX96), Q96)
  return JSBI.divide(JSBI.multiply(amount0, intermediate), JSBI.subtract(sqrtRatioBX96, sqrtRatioAX96))
}

/**
 * Computes maximum liquidity for a given amount of token1
 */
export function maxLiquidityForAmount1(
  sqrtRatioAX96: JSBI,
  sqrtRatioBX96: JSBI,
  amount1: JSBI
): JSBI {
  if (JSBI.greaterThan(sqrtRatioAX96, sqrtRatioBX96)) {
    ;[sqrtRatioAX96, sqrtRatioBX96] = [sqrtRatioBX96, sqrtRatioAX96]
  }

  return JSBI.divide(
    JSBI.multiply(amount1, Q96),
    JSBI.subtract(sqrtRatioBX96, sqrtRatioAX96)
  )
}

/**
 * Computes maximum liquidity for given amounts of token0 and token1
 *
 * @param sqrtRatioCurrentX96 Current sqrt price
 * @param sqrtRatioAX96 Lower sqrt price bound
 * @param sqrtRatioBX96 Upper sqrt price bound
 * @param amount0 Amount of token0
 * @param amount1 Amount of token1
 * @param useFullPrecision Use precise calculation (true for core, false for router)
 */
export function maxLiquidityForAmounts(
  sqrtRatioCurrentX96: JSBI,
  sqrtRatioAX96: JSBI,
  sqrtRatioBX96: JSBI,
  amount0: JSBI,
  amount1: JSBI,
  useFullPrecision: boolean = true
): JSBI {
  // Ensure sqrtA <= sqrtB
  if (JSBI.greaterThan(sqrtRatioAX96, sqrtRatioBX96)) {
    ;[sqrtRatioAX96, sqrtRatioBX96] = [sqrtRatioBX96, sqrtRatioAX96]
  }

  const maxLiquidityForAmount0 = useFullPrecision
    ? maxLiquidityForAmount0Precise
    : maxLiquidityForAmount0Imprecise

  // Case 1: current price below range - only token0 needed
  if (JSBI.lessThanOrEqual(sqrtRatioCurrentX96, sqrtRatioAX96)) {
    return maxLiquidityForAmount0(sqrtRatioAX96, sqrtRatioBX96, amount0)
  }

  // Case 2: current price in range - both tokens needed, take min
  if (JSBI.lessThan(sqrtRatioCurrentX96, sqrtRatioBX96)) {
    const liquidity0 = maxLiquidityForAmount0(sqrtRatioCurrentX96, sqrtRatioBX96, amount0)
    const liquidity1 = maxLiquidityForAmount1(sqrtRatioAX96, sqrtRatioCurrentX96, amount1)
    return JSBI.lessThan(liquidity0, liquidity1) ? liquidity0 : liquidity1
  }

  // Case 3: current price above range - only token1 needed
  return maxLiquidityForAmount1(sqrtRatioAX96, sqrtRatioBX96, amount1)
}
