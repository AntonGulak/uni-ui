import JSBI from 'jsbi'

export interface TokenInfo {
  symbol: string
  decimals: number
  address?: string
}

// Aliases for clarity - tokenA is always the "base" token, tokenB is the "quote" token
export type TokenA = TokenInfo
export type TokenB = TokenInfo

export interface TickData {
  liquidityNet: JSBI
  liquidityGross: JSBI
}

export interface VirtualPosition {
  id: string
  tickLower: number
  tickUpper: number
  liquidity: JSBI
}

export interface SwapResult {
  amountIn: JSBI
  amountOut: JSBI
  sqrtPriceX96After: JSBI
  tickAfter: number
  liquidityAfter: JSBI
}

export interface SwapStep {
  sqrtPriceStartX96: JSBI
  sqrtPriceNextX96: JSBI
  tickNext: number
  amountIn: JSBI
  amountOut: JSBI
  feeAmount: JSBI
  liquidity: JSBI
}

export interface SlippagePoint {
  amountIn: JSBI
  amountOut: JSBI
  effectivePrice: number
  slippagePercent: number
}

export interface SlippageAnalysis {
  points: SlippagePoint[]
  optimalPoint: SlippagePoint | null
}

export interface TickLiquidityData {
  tick: number
  tickLower: number
  tickUpper: number
  liquidity: JSBI
}

export interface AddLiquidityResult {
  amount0: JSBI
  amount1: JSBI
  liquidity: JSBI
  position: VirtualPosition
}
