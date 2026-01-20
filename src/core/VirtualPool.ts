import JSBI from 'jsbi'
import { v4 as uuidv4 } from 'uuid'
import type {
  TokenInfo,
  TickData,
  VirtualPosition,
  SwapResult,
  SwapStep,
  AddLiquidityResult,
  TickLiquidityData,
  SlippageAnalysis,
  SlippagePoint,
} from './types'
import {
  ZERO,
  ONE,
  NEGATIVE_ONE,
  MIN_TICK,
  MAX_TICK,
  MIN_SQRT_RATIO,
  MAX_SQRT_RATIO,
  TICK_SPACINGS,
} from './constants'
import { TickMath, nearestUsableTick } from './TickMath'
import { SqrtPriceMath } from './SqrtPriceMath'
import { SwapMath } from './SwapMath'
import { LiquidityMath, maxLiquidityForAmounts } from './LiquidityMath'
import { priceToSqrtPriceX96, sqrtPriceX96ToPrice } from './priceUtils'

/**
 * Virtual Uniswap V3 Pool for simulation
 * Implements the core pool logic without blockchain interaction
 */
export class VirtualPool {
  // Token info
  tokenA: TokenInfo
  tokenB: TokenInfo

  // Pool parameters
  fee: number // in basis points (e.g., 3000 = 0.3%)
  tickSpacing: number

  // Mutable state
  sqrtPriceX96: JSBI
  tick: number
  liquidity: JSBI // Active liquidity at current tick

  // Tick data: tick -> { liquidityNet, liquidityGross }
  ticks: Map<number, TickData>

  // Positions
  positions: VirtualPosition[]

  // Initialization flag
  initialized: boolean

  constructor(params: {
    tokenA?: TokenInfo
    tokenB?: TokenInfo
    fee?: number
    tickSpacing?: number
  } = {}) {
    this.tokenA = params.tokenA || { symbol: 'TOKENA', decimals: 18 }
    this.tokenB = params.tokenB || { symbol: 'TOKENB', decimals: 18 }
    this.fee = params.fee || 3000
    this.tickSpacing = params.tickSpacing || TICK_SPACINGS[this.fee] || 60

    this.sqrtPriceX96 = ZERO
    this.tick = 0
    this.liquidity = ZERO
    this.ticks = new Map()
    this.positions = []
    this.initialized = false
  }

  /**
   * Initialize the pool with a starting price (human-readable, e.g. 2000 USDC per ETH)
   * Internally adjusts for token decimal differences
   */
  initialize(initialPrice: number): void {
    if (this.initialized) {
      throw new Error('Pool already initialized')
    }
    if (initialPrice <= 0) {
      throw new Error('Price must be positive')
    }

    // Convert human price to raw price accounting for decimals
    // rawPrice = humanPrice * 10^(decimalsB - decimalsA)
    const decimalAdjustment = Math.pow(10, this.tokenB.decimals - this.tokenA.decimals)
    const rawPrice = initialPrice * decimalAdjustment

    this.sqrtPriceX96 = priceToSqrtPriceX96(rawPrice)

    // Validate sqrtPrice bounds
    if (JSBI.lessThan(this.sqrtPriceX96, MIN_SQRT_RATIO)) {
      this.sqrtPriceX96 = MIN_SQRT_RATIO
    }
    if (JSBI.greaterThanOrEqual(this.sqrtPriceX96, MAX_SQRT_RATIO)) {
      this.sqrtPriceX96 = JSBI.subtract(MAX_SQRT_RATIO, ONE)
    }

    this.tick = TickMath.getTickAtSqrtRatio(this.sqrtPriceX96)
    this.initialized = true
  }

  /**
   * Get the current price (human-readable, e.g. 2000 USDC per ETH)
   */
  getCurrentPrice(): number {
    const rawPrice = sqrtPriceX96ToPrice(this.sqrtPriceX96)
    // Convert raw price back to human price
    // humanPrice = rawPrice / 10^(decimalsB - decimalsA)
    const decimalAdjustment = Math.pow(10, this.tokenB.decimals - this.tokenA.decimals)
    return rawPrice / decimalAdjustment
  }

  /**
   * Add liquidity to the pool
   */
  addLiquidity(params: {
    tickLower: number
    tickUpper: number
    amount0Desired: JSBI
    amount1Desired: JSBI
  }): AddLiquidityResult {
    if (!this.initialized) {
      throw new Error('Pool not initialized')
    }

    let { tickLower, tickUpper, amount0Desired, amount1Desired } = params

    // Snap to tick spacing
    tickLower = nearestUsableTick(tickLower, this.tickSpacing)
    tickUpper = nearestUsableTick(tickUpper, this.tickSpacing)

    if (tickLower >= tickUpper) {
      throw new Error('tickLower must be less than tickUpper')
    }
    if (tickLower < MIN_TICK || tickUpper > MAX_TICK) {
      throw new Error('Tick out of bounds')
    }

    const sqrtRatioAX96 = TickMath.getSqrtRatioAtTick(tickLower)
    const sqrtRatioBX96 = TickMath.getSqrtRatioAtTick(tickUpper)

    // Calculate liquidity from amounts
    const liquidity = maxLiquidityForAmounts(
      this.sqrtPriceX96,
      sqrtRatioAX96,
      sqrtRatioBX96,
      amount0Desired,
      amount1Desired,
      true
    )

    if (JSBI.lessThanOrEqual(liquidity, ZERO)) {
      throw new Error('Insufficient amounts for liquidity')
    }

    // Calculate actual amounts used
    let amount0: JSBI
    let amount1: JSBI

    if (JSBI.lessThan(this.sqrtPriceX96, sqrtRatioAX96)) {
      // Current price below range: only token0
      amount0 = SqrtPriceMath.getAmount0Delta(sqrtRatioAX96, sqrtRatioBX96, liquidity, true)
      amount1 = ZERO
    } else if (JSBI.lessThan(this.sqrtPriceX96, sqrtRatioBX96)) {
      // Current price in range: both tokens
      amount0 = SqrtPriceMath.getAmount0Delta(this.sqrtPriceX96, sqrtRatioBX96, liquidity, true)
      amount1 = SqrtPriceMath.getAmount1Delta(sqrtRatioAX96, this.sqrtPriceX96, liquidity, true)
    } else {
      // Current price above range: only token1
      amount0 = ZERO
      amount1 = SqrtPriceMath.getAmount1Delta(sqrtRatioAX96, sqrtRatioBX96, liquidity, true)
    }

    // Update ticks
    this.updateTick(tickLower, liquidity, false)
    this.updateTick(tickUpper, liquidity, true)

    // Update active liquidity if in range
    if (this.tick >= tickLower && this.tick < tickUpper) {
      this.liquidity = JSBI.add(this.liquidity, liquidity)
    }

    // Create position
    const position: VirtualPosition = {
      id: uuidv4(),
      tickLower,
      tickUpper,
      liquidity,
    }
    this.positions.push(position)

    return { amount0, amount1, liquidity, position }
  }

  /**
   * Update tick data when adding/removing liquidity
   */
  private updateTick(tick: number, liquidityDelta: JSBI, upper: boolean): void {
    let tickData = this.ticks.get(tick)

    if (!tickData) {
      tickData = {
        liquidityNet: ZERO,
        liquidityGross: ZERO,
      }
    }

    tickData.liquidityGross = JSBI.add(tickData.liquidityGross, liquidityDelta)

    if (upper) {
      tickData.liquidityNet = JSBI.subtract(tickData.liquidityNet, liquidityDelta)
    } else {
      tickData.liquidityNet = JSBI.add(tickData.liquidityNet, liquidityDelta)
    }

    // Remove tick if empty
    if (JSBI.equal(tickData.liquidityGross, ZERO)) {
      this.ticks.delete(tick)
    } else {
      this.ticks.set(tick, tickData)
    }
  }

  /**
   * Execute a swap
   */
  swap(params: {
    zeroForOne: boolean
    amountSpecified: JSBI // positive = exactIn, negative = exactOut
  }): SwapResult {
    if (!this.initialized) {
      throw new Error('Pool not initialized')
    }

    const { result } = this.swapWithSteps(params)
    return result
  }

  /**
   * Execute a swap and return step-by-step details for visualization
   */
  swapWithSteps(params: {
    zeroForOne: boolean
    amountSpecified: JSBI
    sqrtPriceLimitX96?: JSBI
  }): { result: SwapResult; steps: SwapStep[] } {
    if (!this.initialized) {
      throw new Error('Pool not initialized')
    }

    const { zeroForOne, amountSpecified } = params
    let sqrtPriceLimitX96 = params.sqrtPriceLimitX96

    // Set default price limit
    if (!sqrtPriceLimitX96) {
      sqrtPriceLimitX96 = zeroForOne
        ? JSBI.add(MIN_SQRT_RATIO, ONE)
        : JSBI.subtract(MAX_SQRT_RATIO, ONE)
    }

    // Validate price limit
    if (zeroForOne) {
      if (JSBI.lessThanOrEqual(sqrtPriceLimitX96, MIN_SQRT_RATIO)) {
        throw new Error('RATIO_MIN')
      }
      if (JSBI.greaterThanOrEqual(sqrtPriceLimitX96, this.sqrtPriceX96)) {
        throw new Error('RATIO_CURRENT')
      }
    } else {
      if (JSBI.greaterThanOrEqual(sqrtPriceLimitX96, MAX_SQRT_RATIO)) {
        throw new Error('RATIO_MAX')
      }
      if (JSBI.lessThanOrEqual(sqrtPriceLimitX96, this.sqrtPriceX96)) {
        throw new Error('RATIO_CURRENT')
      }
    }

    const exactInput = JSBI.greaterThanOrEqual(amountSpecified, ZERO)
    const steps: SwapStep[] = []

    // Clone state for simulation
    let sqrtPriceX96 = this.sqrtPriceX96
    let tick = this.tick
    let liquidity = this.liquidity
    let amountSpecifiedRemaining = amountSpecified
    let amountCalculated = ZERO

    // Swap loop
    while (
      JSBI.notEqual(amountSpecifiedRemaining, ZERO) &&
      !JSBI.equal(sqrtPriceX96, sqrtPriceLimitX96)
    ) {
      const sqrtPriceStartX96 = sqrtPriceX96

      // Find next initialized tick
      const { tickNext, initialized: tickNextInitialized } = this.findNextInitializedTick(
        tick,
        zeroForOne
      )

      // Clamp to valid range
      const tickNextClamped = Math.max(MIN_TICK, Math.min(MAX_TICK, tickNext))
      const sqrtPriceNextX96 = TickMath.getSqrtRatioAtTick(tickNextClamped)

      // Determine target price (limit by sqrtPriceLimitX96)
      const sqrtRatioTargetX96 =
        (zeroForOne
          ? JSBI.lessThan(sqrtPriceNextX96, sqrtPriceLimitX96)
          : JSBI.greaterThan(sqrtPriceNextX96, sqrtPriceLimitX96))
          ? sqrtPriceLimitX96
          : sqrtPriceNextX96

      // Compute swap step
      const stepResult = SwapMath.computeSwapStep(
        sqrtPriceX96,
        sqrtRatioTargetX96,
        liquidity,
        amountSpecifiedRemaining,
        this.fee
      )

      sqrtPriceX96 = stepResult.sqrtRatioNextX96

      // Track amounts
      if (exactInput) {
        amountSpecifiedRemaining = JSBI.subtract(
          amountSpecifiedRemaining,
          JSBI.add(stepResult.amountIn, stepResult.feeAmount)
        )
        amountCalculated = JSBI.subtract(amountCalculated, stepResult.amountOut)
      } else {
        amountSpecifiedRemaining = JSBI.add(amountSpecifiedRemaining, stepResult.amountOut)
        amountCalculated = JSBI.add(
          amountCalculated,
          JSBI.add(stepResult.amountIn, stepResult.feeAmount)
        )
      }

      // Record step
      steps.push({
        sqrtPriceStartX96: sqrtPriceStartX96,
        sqrtPriceNextX96: sqrtPriceX96,
        tickNext: tickNextClamped,
        amountIn: stepResult.amountIn,
        amountOut: stepResult.amountOut,
        feeAmount: stepResult.feeAmount,
        liquidity,
      })

      // Cross tick if reached
      if (JSBI.equal(sqrtPriceX96, sqrtPriceNextX96)) {
        if (tickNextInitialized) {
          const tickData = this.ticks.get(tickNextClamped)
          if (tickData) {
            let liquidityNet = tickData.liquidityNet
            if (zeroForOne) {
              liquidityNet = JSBI.multiply(liquidityNet, NEGATIVE_ONE)
            }
            liquidity = LiquidityMath.addDelta(liquidity, liquidityNet)
          }
        }
        tick = zeroForOne ? tickNextClamped - 1 : tickNextClamped
      } else if (JSBI.notEqual(sqrtPriceX96, sqrtPriceStartX96)) {
        tick = TickMath.getTickAtSqrtRatio(sqrtPriceX96)
      }
    }

    // Update pool state
    this.sqrtPriceX96 = sqrtPriceX96
    this.tick = tick
    this.liquidity = liquidity

    // Calculate final amounts
    let amountIn: JSBI
    let amountOut: JSBI

    if (exactInput) {
      amountIn = JSBI.subtract(amountSpecified, amountSpecifiedRemaining)
      amountOut = JSBI.multiply(amountCalculated, NEGATIVE_ONE)
    } else {
      amountIn = amountCalculated
      amountOut = JSBI.subtract(
        JSBI.multiply(amountSpecified, NEGATIVE_ONE),
        amountSpecifiedRemaining
      )
    }

    return {
      result: {
        amountIn,
        amountOut,
        sqrtPriceX96After: sqrtPriceX96,
        tickAfter: tick,
        liquidityAfter: liquidity,
      },
      steps,
    }
  }

  /**
   * Find the next initialized tick
   */
  private findNextInitializedTick(
    tick: number,
    lte: boolean
  ): { tickNext: number; initialized: boolean } {
    const sortedTicks = Array.from(this.ticks.keys()).sort((a, b) => a - b)

    if (lte) {
      // Find largest tick <= current tick
      for (let i = sortedTicks.length - 1; i >= 0; i--) {
        if (sortedTicks[i] <= tick) {
          return { tickNext: sortedTicks[i], initialized: true }
        }
      }
      // No initialized tick found, return min tick
      return { tickNext: MIN_TICK, initialized: false }
    } else {
      // Find smallest tick > current tick
      for (let i = 0; i < sortedTicks.length; i++) {
        if (sortedTicks[i] > tick) {
          return { tickNext: sortedTicks[i], initialized: true }
        }
      }
      // No initialized tick found, return max tick
      return { tickNext: MAX_TICK, initialized: false }
    }
  }

  /**
   * Get liquidity distribution for charting
   */
  getLiquidityDistribution(): TickLiquidityData[] {
    const distribution: TickLiquidityData[] = []
    const sortedTicks = Array.from(this.ticks.keys()).sort((a, b) => a - b)

    let currentLiquidity = ZERO

    for (let i = 0; i < sortedTicks.length; i++) {
      const tick = sortedTicks[i]
      const tickData = this.ticks.get(tick)!

      // Add liquidity as we cross lower bounds
      currentLiquidity = JSBI.add(currentLiquidity, tickData.liquidityNet)

      // Find the next tick (upper bound of this range)
      const nextTick = i < sortedTicks.length - 1 ? sortedTicks[i + 1] : MAX_TICK

      if (JSBI.greaterThan(currentLiquidity, ZERO)) {
        distribution.push({
          tick,
          tickLower: tick,
          tickUpper: nextTick,
          liquidity: currentLiquidity,
        })
      }
    }

    return distribution
  }

  /**
   * Analyze slippage for different swap sizes
   */
  analyzeSlippage(zeroForOne: boolean, maxAmount?: JSBI): SlippageAnalysis {
    if (!this.initialized) {
      throw new Error('Pool not initialized')
    }

    // Save current state
    const savedState = {
      sqrtPriceX96: this.sqrtPriceX96,
      tick: this.tick,
      liquidity: this.liquidity,
    }

    const initialPrice = this.getCurrentPrice()
    const points: SlippagePoint[] = []

    // Default max amount based on liquidity
    if (!maxAmount) {
      maxAmount = JSBI.multiply(this.liquidity, JSBI.BigInt(1000))
    }

    // Sample points (logarithmic scale for better coverage)
    const numPoints = 50
    for (let i = 1; i <= numPoints; i++) {
      // Logarithmic scale: 0.01%, 0.1%, 1%, 10%, 100% of max
      const fraction = Math.pow(10, (i / numPoints) * 4 - 2) / 100
      const amountIn = JSBI.BigInt(
        Math.floor(JSBI.toNumber(maxAmount) * Math.min(fraction, 1))
      )

      if (JSBI.lessThanOrEqual(amountIn, ZERO)) continue

      try {
        // Restore state before each simulation
        this.sqrtPriceX96 = savedState.sqrtPriceX96
        this.tick = savedState.tick
        this.liquidity = savedState.liquidity

        const result = this.swap({ zeroForOne, amountSpecified: amountIn })

        if (JSBI.greaterThan(result.amountOut, ZERO)) {
          // Normalize amounts by decimals for correct price calculation
          const decimalsIn = zeroForOne ? this.tokenA.decimals : this.tokenB.decimals
          const decimalsOut = zeroForOne ? this.tokenB.decimals : this.tokenA.decimals

          const amountInNorm = JSBI.toNumber(result.amountIn) / Math.pow(10, decimalsIn)
          const amountOutNorm = JSBI.toNumber(result.amountOut) / Math.pow(10, decimalsOut)

          // effectivePrice = how much tokenOut per 1 tokenIn
          const effectivePrice = amountOutNorm / amountInNorm

          const spotPrice = zeroForOne ? initialPrice : 1 / initialPrice
          const slippagePercent = Math.abs((effectivePrice - spotPrice) / spotPrice) * 100

          points.push({
            amountIn: result.amountIn,
            amountOut: result.amountOut,
            effectivePrice,
            slippagePercent,
          })
        }
      } catch {
        // Skip points that cause errors (e.g., insufficient liquidity)
      }
    }

    // Restore state
    this.sqrtPriceX96 = savedState.sqrtPriceX96
    this.tick = savedState.tick
    this.liquidity = savedState.liquidity

    // Find optimal point (best ratio of amount vs slippage)
    let optimalPoint: SlippagePoint | null = null
    let bestRatio = 0

    for (const point of points) {
      if (point.slippagePercent > 0) {
        const ratio = JSBI.toNumber(point.amountIn) / point.slippagePercent
        if (ratio > bestRatio) {
          bestRatio = ratio
          optimalPoint = point
        }
      }
    }

    return { points, optimalPoint }
  }

  /**
   * Get amounts for specific slippage targets
   */
  getAmountsAtSlippageTargets(
    zeroForOne: boolean,
    targets: number[] = [1, 5, 10, 25, 50, 75]
  ): Map<number, SlippagePoint | null> {
    const analysis = this.analyzeSlippage(zeroForOne)
    const result = new Map<number, SlippagePoint | null>()

    for (const target of targets) {
      // Find the point closest to target slippage
      let closest: SlippagePoint | null = null
      let minDiff = Infinity

      for (const point of analysis.points) {
        const diff = Math.abs(point.slippagePercent - target)
        if (diff < minDiff && point.slippagePercent <= target * 1.1) {
          minDiff = diff
          closest = point
        }
      }

      result.set(target, closest)
    }

    return result
  }

  /**
   * Simulate swap without modifying state (for preview)
   */
  simulateSwap(params: {
    zeroForOne: boolean
    amountSpecified: JSBI
  }): SwapResult {
    // Save state
    const savedState = {
      sqrtPriceX96: this.sqrtPriceX96,
      tick: this.tick,
      liquidity: this.liquidity,
    }

    try {
      return this.swap(params)
    } finally {
      // Restore state
      this.sqrtPriceX96 = savedState.sqrtPriceX96
      this.tick = savedState.tick
      this.liquidity = savedState.liquidity
    }
  }

  /**
   * Remove a position
   */
  removePosition(positionId: string): void {
    const index = this.positions.findIndex((p) => p.id === positionId)
    if (index === -1) {
      throw new Error('Position not found')
    }

    const position = this.positions[index]
    const negativeLiquidity = JSBI.multiply(position.liquidity, NEGATIVE_ONE)

    // Update ticks (reverse of add)
    this.updateTick(position.tickLower, negativeLiquidity, false)
    this.updateTick(position.tickUpper, negativeLiquidity, true)

    // Update active liquidity if in range
    if (this.tick >= position.tickLower && this.tick < position.tickUpper) {
      this.liquidity = JSBI.subtract(this.liquidity, position.liquidity)
    }

    // Remove position
    this.positions.splice(index, 1)
  }

  /**
   * Reset the pool to uninitialized state
   */
  reset(): void {
    this.sqrtPriceX96 = ZERO
    this.tick = 0
    this.liquidity = ZERO
    this.ticks.clear()
    this.positions = []
    this.initialized = false
  }
}
