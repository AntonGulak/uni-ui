import { useState } from 'react'
import { usePoolStore } from '../../store/usePoolStore'
import { Input } from '../ui/Input'
import { Button } from '../ui/Button'
import { Slider } from '../ui/Slider'
import { TokenConfigModal } from './TokenConfigModal'
import { tickToPrice, priceToTick, TickMath } from '../../core'

function formatPriceDisplay(price: number): string {
  if (!isFinite(price) || isNaN(price)) return '—'
  if (price === 0) return '0'
  if (price < 1e-12) return price.toExponential(2)
  if (price < 0.0001) return price.toExponential(2)
  if (price >= 1e15) return price.toExponential(2)
  if (price >= 1e9) return (price / 1e9).toFixed(2) + 'B'
  if (price >= 1e6) return (price / 1e6).toFixed(2) + 'M'
  if (price < 0.01) return price.toFixed(6)
  if (price < 1) return price.toFixed(4)
  if (price < 1000) return price.toFixed(2)
  return price.toLocaleString(undefined, { maximumFractionDigits: 0 })
}

function shortenAddress(address: string): string {
  if (!address) return ''
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

export function PoolSetupForm() {
  const {
    pool,
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
    setTokenASymbol,
    setTokenBSymbol,
    setTokenADecimals,
    setTokenBDecimals,
    setTokenAAddress,
    setTokenBAddress,
    setFee,
    setTickSpacing,
    setPriceInputMode,
    setInitialPrice,
    setInitialTick,
    initializePool,
    resetPool,
  } = usePoolStore()

  const [priceReversed, setPriceReversed] = useState(false)
  const [priceInputReversed, setPriceInputReversed] = useState(false)
  const [tokenAModalOpen, setTokenAModalOpen] = useState(false)
  const [tokenBModalOpen, setTokenBModalOpen] = useState(false)

  const tickMinNum = TickMath.MIN_TICK
  const tickMaxNum = TickMath.MAX_TICK

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (priceInputMode === 'price' && inputPrice > 0) {
      initializePool(roundedPrice)
    } else {
      initializePool()
    }
  }

  const tickNum = parseInt(initialTick) || 0
  const tickSpacingNum = parseInt(tickSpacing) || 60
  const tickValid = tickNum >= TickMath.MIN_TICK && tickNum <= TickMath.MAX_TICK
  const rawTickPrice = tickValid ? tickToPrice(tickNum) : 0
  const adjustedTickPrice = rawTickPrice * Math.pow(10, tokenADecimals - tokenBDecimals)

  const decimalAdjustment = Math.pow(10, tokenADecimals - tokenBDecimals)
  const reasonableMinPriceAdjusted = 1e-6 / decimalAdjustment
  const reasonableMaxPriceAdjusted = 1e9 / decimalAdjustment
  const reasonableMinTick = Math.max(tickMinNum, Math.round(priceToTick(Math.max(1e-30, reasonableMinPriceAdjusted)) / tickSpacingNum) * tickSpacingNum)
  const reasonableMaxTick = Math.min(tickMaxNum, Math.round(priceToTick(Math.min(1e30, reasonableMaxPriceAdjusted)) / tickSpacingNum) * tickSpacingNum)

  const sliderRange = tickMaxNum - tickMinNum
  const reasonableMinPercent = sliderRange > 0 ? ((reasonableMinTick - tickMinNum) / sliderRange) * 100 : 0
  const reasonableMaxPercent = sliderRange > 0 ? ((reasonableMaxTick - tickMinNum) / sliderRange) * 100 : 100

  const inputPrice = parseFloat(initialPrice) || 0
  const effectivePrice = priceInputReversed && inputPrice > 0 ? 1 / inputPrice : inputPrice
  const rawPriceForTick = effectivePrice * decimalAdjustment
  const priceToTickValue = rawPriceForTick > 0 ? priceToTick(rawPriceForTick) : 0
  const roundedTick = Math.round(priceToTickValue / tickSpacingNum) * tickSpacingNum
  const roundedTickClamped = Math.max(TickMath.MIN_TICK, Math.min(TickMath.MAX_TICK, roundedTick))
  const roundedRawPrice = tickToPrice(roundedTickClamped)
  const roundedPrice = roundedRawPrice / decimalAdjustment
  const displayRoundedPrice = priceInputReversed ? 1 / roundedPrice : roundedPrice

  // Initialized pool view
  if (pool.initialized) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[var(--neon-green)] animate-pulse" />
          <span className="text-sm text-[var(--text-secondary)]">Pool Active</span>
        </div>

        <div className="text-center">
          <div className="text-xl font-bold text-[var(--text-primary)]">
            {pool.tokenA.symbol} / {pool.tokenB.symbol}
          </div>
          <div className="text-xs text-[var(--text-muted)] mt-1">
            {(pool.fee / 10000).toFixed(2)}% fee · tick spacing {pool.tickSpacing}
          </div>
          {(pool.tokenA.address || pool.tokenB.address) && (
            <div className="text-[10px] text-[var(--text-muted)] mt-2 font-mono">
              {pool.tokenA.address && <div>{pool.tokenA.symbol}: {shortenAddress(pool.tokenA.address)}</div>}
              {pool.tokenB.address && <div>{pool.tokenB.symbol}: {shortenAddress(pool.tokenB.address)}</div>}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 text-center">
          <div className="p-3 rounded-lg bg-[var(--bg-tertiary)]">
            <div className="text-[10px] text-[var(--text-muted)] uppercase">Price</div>
            <div className="font-mono text-[var(--text-primary)]">
              {formatPriceDisplay(pool.getCurrentPrice())}
            </div>
          </div>
          <div className="p-3 rounded-lg bg-[var(--bg-tertiary)]">
            <div className="text-[10px] text-[var(--text-muted)] uppercase">Tick</div>
            <div className="font-mono text-[var(--text-primary)]">
              {pool.tick.toLocaleString()}
            </div>
          </div>
        </div>

        <Button variant="secondary" onClick={resetPool} className="w-full">
          Reset Pool
        </Button>
      </div>
    )
  }

  // Setup form
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Token Selection */}
      <div>
        <div className="text-xs text-[var(--text-secondary)] mb-2">Tokens</div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setTokenAModalOpen(true)}
            className="p-3 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-primary)] hover:border-[var(--neon-blue)]/50 transition-colors text-left"
          >
            <div className="text-[10px] text-[var(--text-muted)] uppercase">Token A (base)</div>
            <div className="text-lg font-semibold text-[var(--text-primary)]">{tokenASymbol}</div>
            <div className="text-xs text-[var(--text-secondary)]">
              {tokenADecimals} dec
              {tokenAAddress && <span className="font-mono ml-1">· {shortenAddress(tokenAAddress)}</span>}
            </div>
          </button>
          <button
            type="button"
            onClick={() => setTokenBModalOpen(true)}
            className="p-3 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-primary)] hover:border-[var(--neon-blue)]/50 transition-colors text-left"
          >
            <div className="text-[10px] text-[var(--text-muted)] uppercase">Token B (quote)</div>
            <div className="text-lg font-semibold text-[var(--text-primary)]">{tokenBSymbol}</div>
            <div className="text-xs text-[var(--text-secondary)]">
              {tokenBDecimals} dec
              {tokenBAddress && <span className="font-mono ml-1">· {shortenAddress(tokenBAddress)}</span>}
            </div>
          </button>
        </div>
        {/* Token Order Check */}
        {tokenAAddress && tokenBAddress && (
          <div className="mt-2 p-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-primary)]">
            <div className="text-[10px] text-[var(--text-muted)] uppercase mb-1">Pool Token Order</div>
            {(() => {
              const aLower = tokenAAddress.toLowerCase()
              const bLower = tokenBAddress.toLowerCase()
              const aIsToken0 = aLower < bLower
              return (
                <div className="text-xs">
                  <div className="flex items-center gap-2">
                    <span className={`font-mono px-1.5 py-0.5 rounded ${aIsToken0 ? 'bg-[var(--neon-blue)]/20 text-[var(--neon-blue)]' : 'bg-[var(--neon-purple)]/20 text-[var(--neon-purple)]'}`}>
                      token{aIsToken0 ? '0' : '1'}
                    </span>
                    <span className="text-[var(--text-primary)]">{tokenASymbol}</span>
                    <span className="text-[var(--text-muted)] font-mono text-[10px]">{shortenAddress(tokenAAddress)}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`font-mono px-1.5 py-0.5 rounded ${!aIsToken0 ? 'bg-[var(--neon-blue)]/20 text-[var(--neon-blue)]' : 'bg-[var(--neon-purple)]/20 text-[var(--neon-purple)]'}`}>
                      token{!aIsToken0 ? '0' : '1'}
                    </span>
                    <span className="text-[var(--text-primary)]">{tokenBSymbol}</span>
                    <span className="text-[var(--text-muted)] font-mono text-[10px]">{shortenAddress(tokenBAddress)}</span>
                  </div>
                  {!aIsToken0 && (
                    <div className="mt-2 text-[10px] text-[var(--neon-red)]">
                      ⚠ Token B has smaller address — will be token0 in pool
                    </div>
                  )}
                </div>
              )
            })()}
          </div>
        )}
      </div>

      {/* Fee & Tick Spacing */}
      <div className="grid grid-cols-2 gap-2">
        <Input
          label="Fee (bps)"
          type="number"
          value={fee}
          onChange={(e) => setFee(e.target.value)}
          placeholder="3000"
        />
        <Input
          label="Tick Spacing"
          type="number"
          value={tickSpacing}
          onChange={(e) => setTickSpacing(e.target.value)}
          placeholder="60"
        />
      </div>

      {/* Initial Price */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-[var(--text-secondary)]">Initial Price</span>
          <div className="flex text-[10px]">
            <button
              type="button"
              onClick={() => setPriceInputMode('price')}
              className={`px-2 py-0.5 rounded-l border border-[var(--border-primary)] ${
                priceInputMode === 'price'
                  ? 'bg-[var(--bg-accent)] text-[var(--text-primary)]'
                  : 'text-[var(--text-muted)]'
              }`}
            >
              Price
            </button>
            <button
              type="button"
              onClick={() => setPriceInputMode('tick')}
              className={`px-2 py-0.5 rounded-r border border-l-0 border-[var(--border-primary)] ${
                priceInputMode === 'tick'
                  ? 'bg-[var(--bg-accent)] text-[var(--text-primary)]'
                  : 'text-[var(--text-muted)]'
              }`}
            >
              Tick
            </button>
          </div>
        </div>

        {priceInputMode === 'price' ? (
          <div className="space-y-1">
            <div className="flex gap-2">
              <Input
                type="number"
                value={initialPrice}
                onChange={(e) => setInitialPrice(e.target.value)}
                placeholder={priceInputReversed ? '0.0005' : '2000'}
                step="any"
              />
              <button
                type="button"
                onClick={() => {
                  const p = parseFloat(initialPrice)
                  if (p > 0) setInitialPrice(String(1 / p))
                  setPriceInputReversed(!priceInputReversed)
                }}
                className="px-2 rounded border border-[var(--border-primary)] text-[var(--text-muted)] hover:text-[var(--text-secondary)] text-[10px] whitespace-nowrap"
              >
                {priceInputReversed ? `${tokenASymbol}/${tokenBSymbol}` : `${tokenBSymbol}/${tokenASymbol}`}
              </button>
            </div>
            {inputPrice > 0 && (
              <div className="text-[10px] text-[var(--text-muted)] px-1">
                tick {roundedTickClamped} = {formatPriceDisplay(displayRoundedPrice)}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <div className="relative">
              <div
                className="absolute top-1/2 -translate-y-1/2 h-2 rounded-full pointer-events-none"
                style={{
                  left: `${reasonableMinPercent}%`,
                  width: `${reasonableMaxPercent - reasonableMinPercent}%`,
                  background: `linear-gradient(90deg, transparent 0%, rgba(76, 130, 251, 0.25) 20%, rgba(76, 130, 251, 0.25) 80%, transparent 100%)`,
                }}
              />
              <Slider
                min={tickMinNum}
                max={tickMaxNum}
                step={tickSpacingNum}
                value={tickNum}
                onChange={(e) => setInitialTick(e.target.value)}
                showValue={false}
              />
            </div>
            <div className="flex items-center justify-center gap-1">
              <button
                type="button"
                onClick={() => setInitialTick(String(Math.max(tickMinNum, tickNum - tickSpacingNum)))}
                className="w-6 h-6 rounded border border-[var(--border-primary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] text-xs"
              >
                −
              </button>
              <input
                type="number"
                value={initialTick}
                onChange={(e) => setInitialTick(e.target.value)}
                className="w-20 px-2 py-1 rounded border border-[var(--border-primary)] bg-[var(--bg-tertiary)] text-[var(--text-primary)] font-mono text-xs text-center focus:outline-none"
                step={tickSpacingNum}
              />
              <button
                type="button"
                onClick={() => setInitialTick(String(Math.min(tickMaxNum, tickNum + tickSpacingNum)))}
                className="w-6 h-6 rounded border border-[var(--border-primary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] text-xs"
              >
                +
              </button>
            </div>
            <button
              type="button"
              onClick={() => setPriceReversed(!priceReversed)}
              className="w-full text-[10px] text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            >
              {priceReversed ? `${tokenASymbol}/${tokenBSymbol}` : `${tokenBSymbol}/${tokenASymbol}`} = {tickValid ? formatPriceDisplay(priceReversed ? 1 / adjustedTickPrice : adjustedTickPrice) : '—'}
            </button>
          </div>
        )}
      </div>

      <Button type="submit" className="w-full">
        Initialize Pool
      </Button>

      {/* Token Config Modals */}
      <TokenConfigModal
        isOpen={tokenAModalOpen}
        onClose={() => setTokenAModalOpen(false)}
        title="Configure Token A"
        initialConfig={{
          symbol: tokenASymbol,
          decimals: tokenADecimals,
          address: tokenAAddress,
        }}
        onSave={(config) => {
          setTokenASymbol(config.symbol)
          setTokenADecimals(config.decimals)
          setTokenAAddress(config.address)
        }}
      />
      <TokenConfigModal
        isOpen={tokenBModalOpen}
        onClose={() => setTokenBModalOpen(false)}
        title="Configure Token B"
        initialConfig={{
          symbol: tokenBSymbol,
          decimals: tokenBDecimals,
          address: tokenBAddress,
        }}
        onSave={(config) => {
          setTokenBSymbol(config.symbol)
          setTokenBDecimals(config.decimals)
          setTokenBAddress(config.address)
        }}
      />
    </form>
  )
}
