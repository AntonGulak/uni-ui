import JSBI from 'jsbi'
import { Q96, TWO } from './constants'
import { TickMath } from './TickMath'

/**
 * Computes the sqrt of a JSBI value
 * Uses Newton's method
 */
export function sqrt(value: JSBI): JSBI {
  if (JSBI.lessThan(value, JSBI.BigInt(0))) {
    throw new Error('NEGATIVE')
  }

  if (JSBI.lessThan(value, TWO)) {
    return value
  }

  // Newton's method
  let z = value
  let x = JSBI.add(JSBI.divide(value, TWO), JSBI.BigInt(1))

  while (JSBI.lessThan(x, z)) {
    z = x
    x = JSBI.divide(JSBI.add(JSBI.divide(value, x), x), TWO)
  }

  return z
}

/**
 * Encodes a price ratio as sqrtRatioX96
 * sqrt(amount1/amount0) * 2^96
 */
export function encodeSqrtRatioX96(amount1: JSBI | string | number, amount0: JSBI | string | number): JSBI {
  const numerator = JSBI.leftShift(JSBI.BigInt(amount1), JSBI.BigInt(192))
  const denominator = JSBI.BigInt(amount0)
  const ratioX192 = JSBI.divide(numerator, denominator)
  return sqrt(ratioX192)
}

/**
 * Converts a human-readable price to sqrtPriceX96
 * price = token1/token0
 */
export function priceToSqrtPriceX96(price: number): JSBI {
  // Use high precision: multiply price by 10^18, then compute sqrt
  const precision = JSBI.BigInt(10 ** 18)
  const priceScaled = JSBI.BigInt(Math.floor(price * 10 ** 18))

  // sqrtPrice = sqrt(price) * 2^96
  // = sqrt(priceScaled / precision) * 2^96
  // = sqrt(priceScaled) * 2^96 / sqrt(precision)

  const sqrtPriceScaled = sqrt(priceScaled)
  const sqrtPrecision = sqrt(precision) // sqrt(10^18) = 10^9

  // sqrtPriceX96 = sqrtPriceScaled * 2^96 / sqrtPrecision
  return JSBI.divide(JSBI.multiply(sqrtPriceScaled, Q96), sqrtPrecision)
}

/**
 * Converts sqrtPriceX96 to human-readable price
 */
export function sqrtPriceX96ToPrice(sqrtPriceX96: JSBI): number {
  // price = (sqrtPriceX96 / 2^96)^2
  const sqrtPrice = JSBI.toNumber(sqrtPriceX96) / 2 ** 96
  return sqrtPrice * sqrtPrice
}

/**
 * Converts a tick to human-readable price
 * price = 1.0001^tick
 */
export function tickToPrice(tick: number): number {
  return Math.pow(1.0001, tick)
}

/**
 * Converts a human-readable price to the nearest tick
 */
export function priceToTick(price: number): number {
  // tick = log(price) / log(1.0001)
  return Math.floor(Math.log(price) / Math.log(1.0001))
}

/**
 * Gets the price at a specific tick using the SDK math
 */
export function getTickPrice(tick: number): number {
  const sqrtRatioX96 = TickMath.getSqrtRatioAtTick(tick)
  return sqrtPriceX96ToPrice(sqrtRatioX96)
}

/**
 * Formats a JSBI amount with decimals for display
 * Uses compact notation for large numbers (K, M, B, T)
 */
export function formatAmount(amount: JSBI, decimals: number = 18): string {
  const amountStr = amount.toString()

  // Handle numbers smaller than 1
  if (amountStr.length <= decimals) {
    const padded = amountStr.padStart(decimals, '0')
    const decPart = padded.slice(0, 6).replace(/0+$/, '')
    if (!decPart) return '0'
    return `0.${decPart}`
  }

  // Get integer and fractional parts as strings
  const intLen = amountStr.length - decimals
  const intStr = amountStr.slice(0, intLen)
  const fracStr = amountStr.slice(intLen, intLen + 4).replace(/0+$/, '')

  // Compact formatting for large numbers
  const len = intStr.length
  if (len > 12) {
    return `${intStr.slice(0, len - 12)}.${intStr.slice(len - 12, len - 10)}T`
  }
  if (len > 9) {
    return `${intStr.slice(0, len - 9)}.${intStr.slice(len - 9, len - 7)}B`
  }
  if (len > 6) {
    return `${intStr.slice(0, len - 6)}.${intStr.slice(len - 6, len - 4)}M`
  }
  if (len > 4) {
    return `${intStr.slice(0, len - 3)}.${intStr.slice(len - 3, len - 1)}K`
  }

  // Normal formatting with commas
  const formatted = intStr.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return fracStr ? `${formatted}.${fracStr}` : formatted
}

/**
 * Formats a JSBI amount as a plain numeric string (for input fields)
 * No commas, no suffixes - just a parseable number
 */
export function formatAmountRaw(amount: JSBI, decimals: number = 18): string {
  const amountStr = amount.toString()

  // Handle numbers smaller than 1
  if (amountStr.length <= decimals) {
    const padded = amountStr.padStart(decimals, '0')
    const decPart = padded.slice(0, 8).replace(/0+$/, '')
    if (!decPart) return '0'
    return `0.${decPart}`
  }

  // Get integer and fractional parts
  const intLen = amountStr.length - decimals
  const intStr = amountStr.slice(0, intLen)
  const fracStr = amountStr.slice(intLen, intLen + 6).replace(/0+$/, '')

  return fracStr ? `${intStr}.${fracStr}` : intStr
}

/**
 * Parses a human-readable amount to JSBI with decimals
 */
export function parseAmount(amount: string | number, decimals: number = 18): JSBI {
  const [integerPart, fractionalPart = ''] = String(amount).split('.')
  const paddedFractional = fractionalPart.padEnd(decimals, '0').slice(0, decimals)
  return JSBI.BigInt(integerPart + paddedFractional)
}
