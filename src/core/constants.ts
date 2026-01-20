import JSBI from 'jsbi'

// Basic constants
export const NEGATIVE_ONE = JSBI.BigInt(-1)
export const ZERO = JSBI.BigInt(0)
export const ONE = JSBI.BigInt(1)
export const TWO = JSBI.BigInt(2)

// Q notation fixed-point constants
export const Q32 = JSBI.exponentiate(TWO, JSBI.BigInt(32))
export const Q96 = JSBI.exponentiate(TWO, JSBI.BigInt(96))
export const Q128 = JSBI.exponentiate(TWO, JSBI.BigInt(128))
export const Q192 = JSBI.exponentiate(Q96, TWO)

// Max values
export const MaxUint128 = JSBI.subtract(JSBI.exponentiate(TWO, JSBI.BigInt(128)), ONE)
export const MaxUint160 = JSBI.subtract(JSBI.exponentiate(TWO, JSBI.BigInt(160)), ONE)
export const MaxUint256 = JSBI.subtract(JSBI.exponentiate(TWO, JSBI.BigInt(256)), ONE)

// Fee constants
export const MAX_FEE = JSBI.exponentiate(JSBI.BigInt(10), JSBI.BigInt(6)) // 1_000_000

// Tick constants
export const MIN_TICK = -887272
export const MAX_TICK = 887272

// Sqrt ratio bounds
export const MIN_SQRT_RATIO = JSBI.BigInt('4295128739')
export const MAX_SQRT_RATIO = JSBI.BigInt('1461446703485210103287273052203988822378723970342')

// Default fee tiers and tick spacings
export const FeeAmount = {
  LOWEST: 100,    // 0.01%
  LOW: 500,       // 0.05%
  MEDIUM: 3000,   // 0.3%
  HIGH: 10000,    // 1%
} as const

export const TICK_SPACINGS: { [fee: number]: number } = {
  [FeeAmount.LOWEST]: 1,
  [FeeAmount.LOW]: 10,
  [FeeAmount.MEDIUM]: 60,
  [FeeAmount.HIGH]: 200,
}
