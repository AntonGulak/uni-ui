import { useState } from 'react'
import { usePoolStoreV2 } from '../../store/usePoolStoreV2'
import { Input } from '../ui/Input'
import { Button } from '../ui/Button'
import { TokenConfigModal } from './TokenConfigModal'

function shortenAddress(address: string): string {
  if (!address) return ''
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

export function PoolSetupFormV2() {
  const { initializePool, initialized, resetPool, tokenA, tokenB, reserve0, reserve1, price } = usePoolStoreV2()

  const [tokenASymbol, setTokenASymbol] = useState(tokenA.symbol)
  const [tokenBSymbol, setTokenBSymbol] = useState(tokenB.symbol)
  const [tokenADecimals, setTokenADecimals] = useState(tokenA.decimals)
  const [tokenBDecimals, setTokenBDecimals] = useState(tokenB.decimals)
  const [tokenAAddress, setTokenAAddress] = useState(tokenA.address || '')
  const [tokenBAddress, setTokenBAddress] = useState(tokenB.address || '')
  const [fee, setFee] = useState('0.3')
  const [initialPrice, setInitialPrice] = useState('2000')
  const [initialReserve, setInitialReserve] = useState('100')

  const [tokenAModalOpen, setTokenAModalOpen] = useState(false)
  const [tokenBModalOpen, setTokenBModalOpen] = useState(false)

  const handleInitialize = () => {
    const priceNum = parseFloat(initialPrice)
    const reserveNum = parseFloat(initialReserve)
    const feeNum = parseFloat(fee) * 10000 // Convert % to basis points * 100

    if (isNaN(priceNum) || priceNum <= 0) return
    if (isNaN(reserveNum) || reserveNum <= 0) return

    initializePool({
      tokenA: { symbol: tokenASymbol, decimals: tokenADecimals, address: tokenAAddress || undefined },
      tokenB: { symbol: tokenBSymbol, decimals: tokenBDecimals, address: tokenBAddress || undefined },
      fee: feeNum,
      initialPrice: priceNum,
      initialReserve0: reserveNum,
    })
  }

  if (initialized) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[var(--neon-green)] animate-pulse" />
          <span className="text-sm text-[var(--text-secondary)]">V2 Pool Active</span>
        </div>

        <div className="text-center">
          <div className="text-xl font-bold text-[var(--text-primary)]">
            {tokenA.symbol} / {tokenB.symbol}
          </div>
          <div className="text-xs text-[var(--text-muted)] mt-1">
            x · y = k (constant product)
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-center">
          <div className="p-3 rounded-lg bg-[var(--bg-tertiary)]">
            <div className="text-[10px] text-[var(--text-muted)] uppercase">Reserve {tokenA.symbol}</div>
            <div className="font-mono text-[var(--text-primary)]">
              {reserve0.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </div>
          </div>
          <div className="p-3 rounded-lg bg-[var(--bg-tertiary)]">
            <div className="text-[10px] text-[var(--text-muted)] uppercase">Reserve {tokenB.symbol}</div>
            <div className="font-mono text-[var(--text-primary)]">
              {reserve1.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </div>
          </div>
          <div className="p-3 rounded-lg bg-[var(--bg-tertiary)]">
            <div className="text-[10px] text-[var(--text-muted)] uppercase">Price</div>
            <div className="font-mono text-[var(--text-primary)]">
              {price.toLocaleString(undefined, { maximumFractionDigits: 4 })}
            </div>
          </div>
          <div className="p-3 rounded-lg bg-[var(--bg-tertiary)]">
            <div className="text-[10px] text-[var(--text-muted)] uppercase">k</div>
            <div className="font-mono text-[var(--text-primary)]">
              {(reserve0 * reserve1).toExponential(2)}
            </div>
          </div>
        </div>

        <Button variant="secondary" onClick={resetPool} className="w-full">
          Reset Pool
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-1">
          Create V2 Pool
        </h3>
        <p className="text-sm text-[var(--text-muted)]">
          Classic AMM with constant product formula (x · y = k)
        </p>
      </div>

      {/* Token Selection */}
      <div>
        <div className="text-xs text-[var(--text-secondary)] mb-2">Tokens</div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setTokenAModalOpen(true)}
            className="p-3 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-primary)] hover:border-[var(--neon-blue)]/50 transition-colors text-left"
          >
            <div className="text-[10px] text-[var(--text-muted)] uppercase">Token A</div>
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
            <div className="text-[10px] text-[var(--text-muted)] uppercase">Token B</div>
            <div className="text-lg font-semibold text-[var(--text-primary)]">{tokenBSymbol}</div>
            <div className="text-xs text-[var(--text-secondary)]">
              {tokenBDecimals} dec
              {tokenBAddress && <span className="font-mono ml-1">· {shortenAddress(tokenBAddress)}</span>}
            </div>
          </button>
        </div>
      </div>

      {/* Fee */}
      <div>
        <label className="block text-xs font-medium text-[var(--text-muted)] uppercase mb-2">
          Swap Fee (%)
        </label>
        <div className="flex gap-2">
          {['0.1', '0.3', '1.0'].map((f) => (
            <button
              key={f}
              onClick={() => setFee(f)}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                fee === f
                  ? 'bg-[var(--neon-blue)] text-white'
                  : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              {f}%
            </button>
          ))}
        </div>
      </div>

      {/* Initial Price */}
      <Input
        label={`Initial Price (${tokenBSymbol} per ${tokenASymbol})`}
        type="number"
        value={initialPrice}
        onChange={(e) => setInitialPrice(e.target.value)}
        placeholder="2000"
        step="any"
      />

      {/* Initial Liquidity */}
      <Input
        label={`Initial Reserve (${tokenASymbol})`}
        type="number"
        value={initialReserve}
        onChange={(e) => setInitialReserve(e.target.value)}
        placeholder="100"
        step="any"
      />

      <div className="p-3 rounded-lg bg-[var(--bg-tertiary)] text-xs text-[var(--text-muted)]">
        <div className="font-medium mb-1">Pool will be created with:</div>
        <ul className="space-y-0.5">
          <li>• {initialReserve || '0'} {tokenASymbol}</li>
          <li>• {(parseFloat(initialReserve) * parseFloat(initialPrice) || 0).toLocaleString()} {tokenBSymbol}</li>
          <li>• k = {((parseFloat(initialReserve) || 0) * (parseFloat(initialReserve) * parseFloat(initialPrice) || 0)).toLocaleString()}</li>
        </ul>
      </div>

      <Button onClick={handleInitialize} className="w-full">
        Create V2 Pool
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
    </div>
  )
}
