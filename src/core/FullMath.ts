import JSBI from 'jsbi'
import { ZERO, ONE } from './constants'

/**
 * Full precision math utilities
 * Ported from Uniswap V3 SDK
 */
export abstract class FullMath {
  /**
   * Calculates floor(a * b / denominator) with full precision rounding up
   */
  static mulDivRoundingUp(a: JSBI, b: JSBI, denominator: JSBI): JSBI {
    const product = JSBI.multiply(a, b)
    let result = JSBI.divide(product, denominator)
    if (JSBI.notEqual(JSBI.remainder(product, denominator), ZERO)) {
      result = JSBI.add(result, ONE)
    }
    return result
  }

  /**
   * Calculates floor(a * b / denominator) with full precision
   */
  static mulDiv(a: JSBI, b: JSBI, denominator: JSBI): JSBI {
    return JSBI.divide(JSBI.multiply(a, b), denominator)
  }
}
