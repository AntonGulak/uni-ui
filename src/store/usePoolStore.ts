import { create } from 'zustand'
import JSBI from 'jsbi'
import {
  VirtualPool,
  parseAmount,
  TickMath,
  tickToPrice,
} from '../core'
import type {
  TokenInfo,
  SwapResult,
  SwapStep,
  TickLiquidityData,
  SlippageAnalysis,
  AddLiquidityResult,
} from '../core'

type PriceInputMode = 'price' | 'tick'

interface PoolState {
  // Pool instance
  pool: VirtualPool

  // UI state
  activeTab: 'setup' | 'liquidity' | 'swap'

  // Pool config (before initialization)
  tokenASymbol: string
  tokenBSymbol: string
  tokenADecimals: number
  tokenBDecimals: number
  tokenAAddress: string
  tokenBAddress: string
  fee: string
  tickSpacing: string
  priceInputMode: PriceInputMode
  initialPrice: string
  initialTick: string

  // Liquidity form
  tickLower: string
  tickUpper: string
  amount0: string
  amount1: string

  // Swap form
  swapDirection: 'zeroForOne' | 'oneForZero'
  swapAmount: string
  swapResult: SwapResult | null
  swapSteps: SwapStep[]

  // Analysis
  liquidityDistribution: TickLiquidityData[]
  slippageAnalysis: SlippageAnalysis | null

  // Actions
  setActiveTab: (tab: 'setup' | 'liquidity' | 'swap') => void
  setTokenASymbol: (symbol: string) => void
  setTokenBSymbol: (symbol: string) => void
  setTokenADecimals: (decimals: number) => void
  setTokenBDecimals: (decimals: number) => void
  setTokenAAddress: (address: string) => void
  setTokenBAddress: (address: string) => void
  setFee: (fee: string) => void
  setTickSpacing: (tickSpacing: string) => void
  setPriceInputMode: (mode: PriceInputMode) => void
  setInitialPrice: (price: string) => void
  setInitialTick: (tick: string) => void
  initializePool: (priceOverride?: number) => void
  resetPool: () => void

  setTickLower: (tick: string) => void
  setTickUpper: (tick: string) => void
  setAmount0: (amount: string) => void
  setAmount1: (amount: string) => void
  addLiquidity: () => AddLiquidityResult | null
  removePosition: (id: string) => void

  setSwapDirection: (direction: 'zeroForOne' | 'oneForZero') => void
  setSwapAmount: (amount: string) => void
  executeSwap: () => SwapResult | null
  simulateSwap: () => void
  clearSwapResult: () => void

  updateLiquidityDistribution: () => void
  updateSlippageAnalysis: () => void
}

export const usePoolStore = create<PoolState>((set, get) => ({
  // Initial state
  pool: new VirtualPool(),
  activeTab: 'setup',

  tokenASymbol: 'ETH',
  tokenBSymbol: 'USDC',
  tokenADecimals: 18,
  tokenBDecimals: 6,
  tokenAAddress: '',
  tokenBAddress: '',
  fee: '3000',
  tickSpacing: '60',
  priceInputMode: 'price',
  initialPrice: '2000',
  initialTick: '0',

  tickLower: '-60',
  tickUpper: '60',
  amount0: '1',
  amount1: '2000',

  swapDirection: 'zeroForOne',
  swapAmount: '0.1',
  swapResult: null,
  swapSteps: [],

  liquidityDistribution: [],
  slippageAnalysis: null,

  // Actions
  setActiveTab: (tab) => set({ activeTab: tab }),

  setTokenASymbol: (symbol) => set({ tokenASymbol: symbol }),
  setTokenBSymbol: (symbol) => set({ tokenBSymbol: symbol }),
  setTokenADecimals: (decimals) => set({ tokenADecimals: decimals }),
  setTokenBDecimals: (decimals) => set({ tokenBDecimals: decimals }),
  setTokenAAddress: (address) => set({ tokenAAddress: address }),
  setTokenBAddress: (address) => set({ tokenBAddress: address }),
  setFee: (fee) => set({ fee }),
  setTickSpacing: (tickSpacing) => set({ tickSpacing }),
  setPriceInputMode: (mode) => set({ priceInputMode: mode }),
  setInitialPrice: (price) => set({ initialPrice: price }),
  setInitialTick: (tick) => set({ initialTick: tick }),

  initializePool: (priceOverride) => {
    const {
      tokenASymbol,
      tokenBSymbol,
      tokenADecimals,
      tokenBDecimals,
      tokenAAddress,
      tokenBAddress,
      fee,
      tickSpacing,
      priceInputMode,
      initialPrice,
      initialTick,
    } = get()

    const feeNum = parseInt(fee) || 3000
    const tickSpacingNum = parseInt(tickSpacing) || 60

    const tokenA: TokenInfo = { symbol: tokenASymbol, decimals: tokenADecimals, address: tokenAAddress || undefined }
    const tokenB: TokenInfo = { symbol: tokenBSymbol, decimals: tokenBDecimals, address: tokenBAddress || undefined }

    const pool = new VirtualPool({ tokenA, tokenB, fee: feeNum, tickSpacing: tickSpacingNum })

    if (priceInputMode === 'tick') {
      // Initialize from tick
      const tickNum = parseInt(initialTick)
      if (isNaN(tickNum) || tickNum < TickMath.MIN_TICK || tickNum > TickMath.MAX_TICK) {
        console.error('Invalid tick')
        return
      }
      // Convert tick to price, adjusting for decimals
      // price (token1/token0) = 1.0001^tick * 10^(decimals0 - decimals1)
      const rawPrice = tickToPrice(tickNum)
      const adjustedPrice = rawPrice * Math.pow(10, tokenADecimals - tokenBDecimals)
      pool.initialize(adjustedPrice)
    } else {
      // Initialize from price (use override if provided)
      const priceNum = priceOverride ?? parseFloat(initialPrice)
      if (isNaN(priceNum) || priceNum <= 0) {
        console.error('Invalid price')
        return
      }
      pool.initialize(priceNum)
    }

    // Set tick range around current tick (±5% in tick terms)
    const currentTick = pool.tick
    const rangeTicks = Math.round(500 / tickSpacingNum) * tickSpacingNum || tickSpacingNum * 5
    const newTickLower = Math.round((currentTick - rangeTicks) / tickSpacingNum) * tickSpacingNum
    const newTickUpper = Math.round((currentTick + rangeTicks) / tickSpacingNum) * tickSpacingNum

    set({
      pool,
      activeTab: 'liquidity',
      tickLower: String(newTickLower),
      tickUpper: String(newTickUpper),
      liquidityDistribution: [],
      slippageAnalysis: null,
    })
  },

  resetPool: () => {
    set({
      pool: new VirtualPool(),
      activeTab: 'setup',
      liquidityDistribution: [],
      slippageAnalysis: null,
      swapResult: null,
      swapSteps: [],
    })
  },

  setTickLower: (tick) => set({ tickLower: tick }),
  setTickUpper: (tick) => set({ tickUpper: tick }),
  setAmount0: (amount) => set({ amount0: amount }),
  setAmount1: (amount) => set({ amount1: amount }),

  addLiquidity: () => {
    const { pool, tickLower, tickUpper, amount0, amount1 } = get()

    if (!pool.initialized) {
      console.error('Pool not initialized')
      return null
    }

    const tickLowerNum = parseInt(tickLower)
    const tickUpperNum = parseInt(tickUpper)
    const amount0Num = parseFloat(amount0)
    const amount1Num = parseFloat(amount1)

    if (isNaN(tickLowerNum) || isNaN(tickUpperNum)) {
      console.error('Invalid tick values')
      return null
    }

    if (isNaN(amount0Num) || isNaN(amount1Num)) {
      console.error('Invalid amount values')
      return null
    }

    try {
      const result = pool.addLiquidity({
        tickLower: tickLowerNum,
        tickUpper: tickUpperNum,
        amount0Desired: parseAmount(amount0Num, 18),
        amount1Desired: parseAmount(amount1Num, 18),
      })

      // Update state
      set({ pool })
      get().updateLiquidityDistribution()
      get().updateSlippageAnalysis()

      return result
    } catch (error) {
      console.error('Failed to add liquidity:', error)
      return null
    }
  },

  removePosition: (id) => {
    const { pool } = get()
    try {
      pool.removePosition(id)
      set({ pool })
      get().updateLiquidityDistribution()
      get().updateSlippageAnalysis()
    } catch (error) {
      console.error('Failed to remove position:', error)
    }
  },

  setSwapDirection: (direction) => {
    set({ swapDirection: direction, swapResult: null, swapSteps: [] })
    get().simulateSwap()
  },

  setSwapAmount: (amount) => {
    set({ swapAmount: amount })
    get().simulateSwap()
  },

  executeSwap: () => {
    const { pool, swapDirection, swapAmount } = get()

    if (!pool.initialized) {
      console.error('Pool not initialized')
      return null
    }

    const amountNum = parseFloat(swapAmount)
    if (isNaN(amountNum) || amountNum <= 0) {
      console.error('Invalid swap amount')
      return null
    }

    try {
      const { result, steps } = pool.swapWithSteps({
        zeroForOne: swapDirection === 'zeroForOne',
        amountSpecified: parseAmount(amountNum, 18),
      })

      set({ pool, swapResult: result, swapSteps: steps })
      get().updateLiquidityDistribution()
      get().updateSlippageAnalysis()

      return result
    } catch (error) {
      console.error('Swap failed:', error)
      return null
    }
  },

  simulateSwap: () => {
    const { pool, swapDirection, swapAmount } = get()

    if (!pool.initialized) {
      set({ swapResult: null, swapSteps: [] })
      return
    }

    const amountNum = parseFloat(swapAmount)
    if (isNaN(amountNum) || amountNum <= 0) {
      set({ swapResult: null, swapSteps: [] })
      return
    }

    try {
      // Save state
      const savedState = {
        sqrtPriceX96: pool.sqrtPriceX96,
        tick: pool.tick,
        liquidity: pool.liquidity,
      }

      const { result, steps } = pool.swapWithSteps({
        zeroForOne: swapDirection === 'zeroForOne',
        amountSpecified: parseAmount(amountNum, 18),
      })

      // Restore state
      pool.sqrtPriceX96 = savedState.sqrtPriceX96
      pool.tick = savedState.tick
      pool.liquidity = savedState.liquidity

      set({ swapResult: result, swapSteps: steps })
    } catch {
      set({ swapResult: null, swapSteps: [] })
    }
  },

  clearSwapResult: () => set({ swapResult: null, swapSteps: [] }),

  updateLiquidityDistribution: () => {
    const { pool } = get()
    if (pool.initialized) {
      const distribution = pool.getLiquidityDistribution()
      set({ liquidityDistribution: distribution })
    }
  },

  updateSlippageAnalysis: () => {
    const { pool, swapDirection } = get()
    if (pool.initialized && JSBI.greaterThan(pool.liquidity, JSBI.BigInt(0))) {
      try {
        const analysis = pool.analyzeSlippage(swapDirection === 'zeroForOne')
        set({ slippageAnalysis: analysis })
      } catch {
        set({ slippageAnalysis: null })
      }
    }
  },
}))
