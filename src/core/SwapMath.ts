import JSBI from 'jsbi'
import { ZERO, NEGATIVE_ONE, MAX_FEE } from './constants'
import { SqrtPriceMath } from './SqrtPriceMath'
import { FullMath } from './FullMath'

export interface SwapStepResult {
  sqrtRatioNextX96: JSBI
  amountIn: JSBI
  amountOut: JSBI
  feeAmount: JSBI
}

/**
 * Swap math utilities
 * Ported directly from Uniswap V3 SDK
 */
export abstract class SwapMath {
  /**
   * Computes the result of a single swap step
   *
   * @param sqrtRatioCurrentX96 The current sqrt price
   * @param sqrtRatioTargetX96 The target sqrt price (next tick boundary or price limit)
   * @param liquidity The current liquidity
   * @param amountRemaining The remaining amount to swap (positive for exactIn, negative for exactOut)
   * @param feePips The fee in hundredths of a bip (e.g., 3000 = 0.3%)
   */
  static computeSwapStep(
    sqrtRatioCurrentX96: JSBI,
    sqrtRatioTargetX96: JSBI,
    liquidity: JSBI,
    amountRemaining: JSBI,
    feePips: number
  ): SwapStepResult {
    const feePipsBI = JSBI.BigInt(feePips)
    const zeroForOne = JSBI.greaterThanOrEqual(sqrtRatioCurrentX96, sqrtRatioTargetX96)
    const exactIn = JSBI.greaterThanOrEqual(amountRemaining, ZERO)

    let sqrtRatioNextX96: JSBI
    let amountIn: JSBI
    let amountOut: JSBI
    let feeAmount: JSBI

    if (exactIn) {
      // Remove fee from input amount
      const amountRemainingLessFee = JSBI.divide(
        JSBI.multiply(amountRemaining, JSBI.subtract(MAX_FEE, feePipsBI)),
        MAX_FEE
      )

      // Calculate max amount we can use to reach target
      amountIn = zeroForOne
        ? SqrtPriceMath.getAmount0Delta(sqrtRatioTargetX96, sqrtRatioCurrentX96, liquidity, true)
        : SqrtPriceMath.getAmount1Delta(sqrtRatioCurrentX96, sqrtRatioTargetX96, liquidity, true)

      // Check if we can reach the target
      if (JSBI.greaterThanOrEqual(amountRemainingLessFee, amountIn)) {
        sqrtRatioNextX96 = sqrtRatioTargetX96
      } else {
        sqrtRatioNextX96 = SqrtPriceMath.getNextSqrtPriceFromInput(
          sqrtRatioCurrentX96,
          liquidity,
          amountRemainingLessFee,
          zeroForOne
        )
      }
    } else {
      // Exact output
      amountOut = zeroForOne
        ? SqrtPriceMath.getAmount1Delta(sqrtRatioTargetX96, sqrtRatioCurrentX96, liquidity, false)
        : SqrtPriceMath.getAmount0Delta(sqrtRatioCurrentX96, sqrtRatioTargetX96, liquidity, false)

      if (JSBI.greaterThanOrEqual(JSBI.multiply(amountRemaining, NEGATIVE_ONE), amountOut)) {
        sqrtRatioNextX96 = sqrtRatioTargetX96
      } else {
        sqrtRatioNextX96 = SqrtPriceMath.getNextSqrtPriceFromOutput(
          sqrtRatioCurrentX96,
          liquidity,
          JSBI.multiply(amountRemaining, NEGATIVE_ONE),
          zeroForOne
        )
      }
    }

    const max = JSBI.equal(sqrtRatioTargetX96, sqrtRatioNextX96)

    // Recalculate amounts based on actual price movement
    if (zeroForOne) {
      amountIn =
        max && exactIn
          ? amountIn!
          : SqrtPriceMath.getAmount0Delta(sqrtRatioNextX96, sqrtRatioCurrentX96, liquidity, true)
      amountOut =
        max && !exactIn
          ? amountOut!
          : SqrtPriceMath.getAmount1Delta(sqrtRatioNextX96, sqrtRatioCurrentX96, liquidity, false)
    } else {
      amountIn =
        max && exactIn
          ? amountIn!
          : SqrtPriceMath.getAmount1Delta(sqrtRatioCurrentX96, sqrtRatioNextX96, liquidity, true)
      amountOut =
        max && !exactIn
          ? amountOut!
          : SqrtPriceMath.getAmount0Delta(sqrtRatioCurrentX96, sqrtRatioNextX96, liquidity, false)
    }

    // Cap output at remaining (for exact output)
    if (!exactIn && JSBI.greaterThan(amountOut!, JSBI.multiply(amountRemaining, NEGATIVE_ONE))) {
      amountOut = JSBI.multiply(amountRemaining, NEGATIVE_ONE)
    }

    // Calculate fee
    if (exactIn && JSBI.notEqual(sqrtRatioNextX96, sqrtRatioTargetX96)) {
      // Didn't reach target, take remainder as fee
      feeAmount = JSBI.subtract(amountRemaining, amountIn!)
    } else {
      feeAmount = FullMath.mulDivRoundingUp(amountIn!, feePipsBI, JSBI.subtract(MAX_FEE, feePipsBI))
    }

    return {
      sqrtRatioNextX96,
      amountIn: amountIn!,
      amountOut: amountOut!,
      feeAmount,
    }
  }
}
