import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface TokenInfo {
  symbol: string
  decimals: number
  address?: string
}

interface PositionV2 {
  id: string
  lpTokens: number
  amount0: number
  amount1: number
  sharePercent: number
}

interface PoolStateV2 {
  // Pool state
  initialized: boolean
  tokenA: TokenInfo
  tokenB: TokenInfo
  fee: number // 0.3% = 3000 (basis points)

  // Reserves
  reserve0: number
  reserve1: number
  totalSupply: number // LP tokens

  // Current price
  price: number // tokenB per tokenA

  // Positions
  positions: PositionV2[]

  // UI state
  activeTab: 'setup' | 'liquidity' | 'swap'

  // Form state
  amount0Input: string
  amount1Input: string
  swapAmount: string
  swapDirection: 'aToB' | 'bToA'

  // Actions
  setActiveTab: (tab: 'setup' | 'liquidity' | 'swap') => void
  initializePool: (params: {
    tokenA: TokenInfo
    tokenB: TokenInfo
    fee: number
    initialPrice: number
    initialReserve0?: number
  }) => void
  resetPool: () => void

  setAmount0Input: (val: string) => void
  setAmount1Input: (val: string) => void
  calculateAmount1FromAmount0: (amount0: string) => void
  calculateAmount0FromAmount1: (amount1: string) => void

  addLiquidity: () => PositionV2 | null
  removeLiquidity: (positionId: string) => void

  setSwapAmount: (val: string) => void
  setSwapDirection: (dir: 'aToB' | 'bToA') => void
  executeSwap: () => { amountIn: number; amountOut: number; priceImpact: number } | null
  simulateSwap: () => { amountOut: number; priceImpact: number; newPrice: number } | null
}

let positionIdCounter = 0

export const usePoolStoreV2 = create<PoolStateV2>()(
  persist(
    (set, get) => ({
      // Initial state
      initialized: false,
      tokenA: { symbol: 'ETH', decimals: 18 },
      tokenB: { symbol: 'USDC', decimals: 6 },
      fee: 3000, // 0.3%

      reserve0: 0,
      reserve1: 0,
      totalSupply: 0,
      price: 0,

      positions: [],

      activeTab: 'setup',

      amount0Input: '',
      amount1Input: '',
      swapAmount: '',
      swapDirection: 'aToB',

      // Actions
      setActiveTab: (tab) => set({ activeTab: tab }),

      initializePool: ({ tokenA, tokenB, fee, initialPrice, initialReserve0 = 1000 }) => {
        const reserve0 = initialReserve0
        const reserve1 = initialReserve0 * initialPrice

        set({
          initialized: true,
          tokenA,
          tokenB,
          fee,
          reserve0,
          reserve1,
          totalSupply: Math.sqrt(reserve0 * reserve1), // Initial LP = sqrt(x*y)
          price: initialPrice,
          activeTab: 'liquidity',
          positions: [],
        })
      },

      resetPool: () => {
        set({
          initialized: false,
          reserve0: 0,
          reserve1: 0,
          totalSupply: 0,
          price: 0,
          positions: [],
          activeTab: 'setup',
          amount0Input: '',
          amount1Input: '',
          swapAmount: '',
        })
      },

      setAmount0Input: (val) => set({ amount0Input: val }),
      setAmount1Input: (val) => set({ amount1Input: val }),

      calculateAmount1FromAmount0: (amount0Str) => {
        const { reserve0, reserve1 } = get()
        const amount0 = parseFloat(amount0Str)
        if (isNaN(amount0) || amount0 <= 0 || reserve0 === 0) {
          set({ amount0Input: amount0Str })
          return
        }
        // V2: must add in same ratio
        const ratio = reserve1 / reserve0
        const amount1 = amount0 * ratio
        set({
          amount0Input: amount0Str,
          amount1Input: amount1.toFixed(6)
        })
      },

      calculateAmount0FromAmount1: (amount1Str) => {
        const { reserve0, reserve1 } = get()
        const amount1 = parseFloat(amount1Str)
        if (isNaN(amount1) || amount1 <= 0 || reserve1 === 0) {
          set({ amount1Input: amount1Str })
          return
        }
        const ratio = reserve0 / reserve1
        const amount0 = amount1 * ratio
        set({
          amount1Input: amount1Str,
          amount0Input: amount0.toFixed(6)
        })
      },

      addLiquidity: () => {
        const { reserve0, reserve1, totalSupply, amount0Input, amount1Input, positions } = get()
        const amount0 = parseFloat(amount0Input)
        const amount1 = parseFloat(amount1Input)

        if (isNaN(amount0) || isNaN(amount1) || amount0 <= 0 || amount1 <= 0) {
          return null
        }

        // Calculate LP tokens: min(amount0/reserve0, amount1/reserve1) * totalSupply
        let lpTokens: number
        if (totalSupply === 0) {
          lpTokens = Math.sqrt(amount0 * amount1)
        } else {
          const ratio0 = amount0 / reserve0
          const ratio1 = amount1 / reserve1
          lpTokens = Math.min(ratio0, ratio1) * totalSupply
        }

        const newReserve0 = reserve0 + amount0
        const newReserve1 = reserve1 + amount1
        const newTotalSupply = totalSupply + lpTokens
        const sharePercent = (lpTokens / newTotalSupply) * 100

        const position: PositionV2 = {
          id: `v2-pos-${++positionIdCounter}`,
          lpTokens,
          amount0,
          amount1,
          sharePercent,
        }

        set({
          reserve0: newReserve0,
          reserve1: newReserve1,
          totalSupply: newTotalSupply,
          positions: [...positions, position],
          amount0Input: '',
          amount1Input: '',
        })

        return position
      },

      removeLiquidity: (positionId) => {
        const { positions, reserve0, reserve1, totalSupply } = get()
        const position = positions.find(p => p.id === positionId)
        if (!position) return

        // Calculate amounts to return based on current reserves and share
        const share = position.lpTokens / totalSupply
        const amount0Return = reserve0 * share
        const amount1Return = reserve1 * share

        set({
          reserve0: reserve0 - amount0Return,
          reserve1: reserve1 - amount1Return,
          totalSupply: totalSupply - position.lpTokens,
          positions: positions.filter(p => p.id !== positionId),
        })
      },

      setSwapAmount: (val) => set({ swapAmount: val }),
      setSwapDirection: (dir) => set({ swapDirection: dir }),

      simulateSwap: () => {
        const { reserve0, reserve1, swapAmount, swapDirection, fee } = get()
        const amountIn = parseFloat(swapAmount)

        if (isNaN(amountIn) || amountIn <= 0) return null

        const feeMultiplier = 1 - fee / 1000000 // fee is in basis points * 100
        const amountInWithFee = amountIn * feeMultiplier

        let amountOut: number
        let newReserve0: number
        let newReserve1: number

        if (swapDirection === 'aToB') {
          // x * y = k, solve for dy given dx
          // (x + dx) * (y - dy) = k
          // dy = y - k / (x + dx) = y * dx / (x + dx)
          amountOut = (reserve1 * amountInWithFee) / (reserve0 + amountInWithFee)
          newReserve0 = reserve0 + amountIn
          newReserve1 = reserve1 - amountOut
        } else {
          amountOut = (reserve0 * amountInWithFee) / (reserve1 + amountInWithFee)
          newReserve0 = reserve0 - amountOut
          newReserve1 = reserve1 + amountIn
        }

        const oldPrice = reserve1 / reserve0
        const newPrice = newReserve1 / newReserve0
        const priceImpact = Math.abs((newPrice - oldPrice) / oldPrice) * 100

        return { amountOut, priceImpact, newPrice }
      },

      executeSwap: () => {
        const { reserve0, reserve1, swapAmount, swapDirection, fee } = get()
        const amountIn = parseFloat(swapAmount)

        if (isNaN(amountIn) || amountIn <= 0) return null

        const feeMultiplier = 1 - fee / 1000000
        const amountInWithFee = amountIn * feeMultiplier

        let amountOut: number
        let newReserve0: number
        let newReserve1: number

        if (swapDirection === 'aToB') {
          amountOut = (reserve1 * amountInWithFee) / (reserve0 + amountInWithFee)
          newReserve0 = reserve0 + amountIn
          newReserve1 = reserve1 - amountOut
        } else {
          amountOut = (reserve0 * amountInWithFee) / (reserve1 + amountInWithFee)
          newReserve0 = reserve0 - amountOut
          newReserve1 = reserve1 + amountIn
        }

        const oldPrice = reserve1 / reserve0
        const newPrice = newReserve1 / newReserve0
        const priceImpact = Math.abs((newPrice - oldPrice) / oldPrice) * 100

        set({
          reserve0: newReserve0,
          reserve1: newReserve1,
          price: newPrice,
          swapAmount: '',
        })

        return { amountIn, amountOut, priceImpact }
      },
    }),
    {
      name: 'uni-calc-v2-storage',
      partialize: (state) => ({
        initialized: state.initialized,
        tokenA: state.tokenA,
        tokenB: state.tokenB,
        fee: state.fee,
        reserve0: state.reserve0,
        reserve1: state.reserve1,
        totalSupply: state.totalSupply,
        price: state.price,
        positions: state.positions,
        activeTab: state.activeTab,
      }),
    }
  )
)
