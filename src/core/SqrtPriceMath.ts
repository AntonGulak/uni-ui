import JSBI from 'jsbi'
import { ZERO, ONE, Q96, MaxUint256, MaxUint160 } from './constants'
import { FullMath } from './FullMath'

/**
 * Multiply with overflow protection (256 bit)
 */
function multiplyIn256(x: JSBI, y: JSBI): JSBI {
  const product = JSBI.multiply(x, y)
  return JSBI.bitwiseAnd(product, MaxUint256)
}

/**
 * Add with overflow protection (256 bit)
 */
function addIn256(x: JSBI, y: JSBI): JSBI {
  const sum = JSBI.add(x, y)
  return JSBI.bitwiseAnd(sum, MaxUint256)
}

/**
 * Sqrt price math utilities
 * Ported directly from Uniswap V3 SDK
 */
export abstract class SqrtPriceMath {
  /**
   * Gets the amount0 delta between two prices
   * Calculates: liquidity * (sqrtB - sqrtA) / (sqrtB * sqrtA)
   */
  static getAmount0Delta(
    sqrtRatioAX96: JSBI,
    sqrtRatioBX96: JSBI,
    liquidity: JSBI,
    roundUp: boolean
  ): JSBI {
    // Ensure sqrtA <= sqrtB
    if (JSBI.greaterThan(sqrtRatioAX96, sqrtRatioBX96)) {
      ;[sqrtRatioAX96, sqrtRatioBX96] = [sqrtRatioBX96, sqrtRatioAX96]
    }

    const numerator1 = JSBI.leftShift(liquidity, JSBI.BigInt(96))
    const numerator2 = JSBI.subtract(sqrtRatioBX96, sqrtRatioAX96)

    return roundUp
      ? FullMath.mulDivRoundingUp(
          FullMath.mulDivRoundingUp(numerator1, numerator2, sqrtRatioBX96),
          ONE,
          sqrtRatioAX96
        )
      : JSBI.divide(
          JSBI.divide(JSBI.multiply(numerator1, numerator2), sqrtRatioBX96),
          sqrtRatioAX96
        )
  }

  /**
   * Gets the amount1 delta between two prices
   * Calculates: liquidity * (sqrtB - sqrtA)
   */
  static getAmount1Delta(
    sqrtRatioAX96: JSBI,
    sqrtRatioBX96: JSBI,
    liquidity: JSBI,
    roundUp: boolean
  ): JSBI {
    // Ensure sqrtA <= sqrtB
    if (JSBI.greaterThan(sqrtRatioAX96, sqrtRatioBX96)) {
      ;[sqrtRatioAX96, sqrtRatioBX96] = [sqrtRatioBX96, sqrtRatioAX96]
    }

    return roundUp
      ? FullMath.mulDivRoundingUp(liquidity, JSBI.subtract(sqrtRatioBX96, sqrtRatioAX96), Q96)
      : JSBI.divide(JSBI.multiply(liquidity, JSBI.subtract(sqrtRatioBX96, sqrtRatioAX96)), Q96)
  }

  /**
   * Gets the next sqrt price from an input amount
   */
  static getNextSqrtPriceFromInput(
    sqrtPX96: JSBI,
    liquidity: JSBI,
    amountIn: JSBI,
    zeroForOne: boolean
  ): JSBI {
    if (JSBI.lessThanOrEqual(sqrtPX96, ZERO)) {
      throw new Error('sqrtPX96 must be > 0')
    }
    if (JSBI.lessThanOrEqual(liquidity, ZERO)) {
      throw new Error('liquidity must be > 0')
    }

    return zeroForOne
      ? this.getNextSqrtPriceFromAmount0RoundingUp(sqrtPX96, liquidity, amountIn, true)
      : this.getNextSqrtPriceFromAmount1RoundingDown(sqrtPX96, liquidity, amountIn, true)
  }

  /**
   * Gets the next sqrt price from an output amount
   */
  static getNextSqrtPriceFromOutput(
    sqrtPX96: JSBI,
    liquidity: JSBI,
    amountOut: JSBI,
    zeroForOne: boolean
  ): JSBI {
    if (JSBI.lessThanOrEqual(sqrtPX96, ZERO)) {
      throw new Error('sqrtPX96 must be > 0')
    }
    if (JSBI.lessThanOrEqual(liquidity, ZERO)) {
      throw new Error('liquidity must be > 0')
    }

    return zeroForOne
      ? this.getNextSqrtPriceFromAmount1RoundingDown(sqrtPX96, liquidity, amountOut, false)
      : this.getNextSqrtPriceFromAmount0RoundingUp(sqrtPX96, liquidity, amountOut, false)
  }

  /**
   * Gets next sqrt price from amount0 (rounding up)
   */
  private static getNextSqrtPriceFromAmount0RoundingUp(
    sqrtPX96: JSBI,
    liquidity: JSBI,
    amount: JSBI,
    add: boolean
  ): JSBI {
    if (JSBI.equal(amount, ZERO)) return sqrtPX96

    const numerator1 = JSBI.leftShift(liquidity, JSBI.BigInt(96))

    if (add) {
      const product = multiplyIn256(amount, sqrtPX96)
      if (JSBI.equal(JSBI.divide(product, amount), sqrtPX96)) {
        const denominator = addIn256(numerator1, product)
        if (JSBI.greaterThanOrEqual(denominator, numerator1)) {
          return FullMath.mulDivRoundingUp(numerator1, sqrtPX96, denominator)
        }
      }
      return FullMath.mulDivRoundingUp(
        numerator1,
        ONE,
        JSBI.add(JSBI.divide(numerator1, sqrtPX96), amount)
      )
    } else {
      const product = multiplyIn256(amount, sqrtPX96)
      if (!JSBI.equal(JSBI.divide(product, amount), sqrtPX96)) {
        throw new Error('overflow')
      }
      if (!JSBI.greaterThan(numerator1, product)) {
        throw new Error('underflow')
      }
      const denominator = JSBI.subtract(numerator1, product)
      return FullMath.mulDivRoundingUp(numerator1, sqrtPX96, denominator)
    }
  }

  /**
   * Gets next sqrt price from amount1 (rounding down)
   */
  private static getNextSqrtPriceFromAmount1RoundingDown(
    sqrtPX96: JSBI,
    liquidity: JSBI,
    amount: JSBI,
    add: boolean
  ): JSBI {
    if (add) {
      const quotient = JSBI.lessThanOrEqual(amount, MaxUint160)
        ? JSBI.divide(JSBI.leftShift(amount, JSBI.BigInt(96)), liquidity)
        : JSBI.divide(JSBI.multiply(amount, Q96), liquidity)
      return JSBI.add(sqrtPX96, quotient)
    } else {
      const quotient = FullMath.mulDivRoundingUp(amount, Q96, liquidity)
      if (!JSBI.greaterThan(sqrtPX96, quotient)) {
        throw new Error('underflow')
      }
      return JSBI.subtract(sqrtPX96, quotient)
    }
  }
}
