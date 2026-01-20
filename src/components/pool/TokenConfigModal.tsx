import { useState, useEffect } from 'react'
import { Modal } from '../ui/Modal'
import { Input } from '../ui/Input'
import { Button } from '../ui/Button'

interface TokenConfig {
  symbol: string
  decimals: number
  address: string
}

interface TokenConfigModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  initialConfig: TokenConfig
  onSave: (config: TokenConfig) => void
}

export function TokenConfigModal({
  isOpen,
  onClose,
  title,
  initialConfig,
  onSave,
}: TokenConfigModalProps) {
  const [symbol, setSymbol] = useState(initialConfig.symbol)
  const [decimals, setDecimals] = useState(initialConfig.decimals)
  const [address, setAddress] = useState(initialConfig.address)

  useEffect(() => {
    if (isOpen) {
      setSymbol(initialConfig.symbol)
      setDecimals(initialConfig.decimals)
      setAddress(initialConfig.address)
    }
  }, [isOpen, initialConfig])

  const handleSave = () => {
    onSave({ symbol, decimals, address })
    onClose()
  }

  const isValidAddress = !address || /^0x[a-fA-F0-9]{40}$/.test(address)

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="space-y-4">
        <Input
          label="Symbol"
          value={symbol}
          onChange={(e) => setSymbol(e.target.value.toUpperCase())}
          placeholder="ETH"
        />

        <Input
          label="Decimals"
          type="number"
          value={decimals}
          onChange={(e) => setDecimals(Number(e.target.value) || 18)}
          min={0}
          max={24}
        />

        <div>
          <Input
            label="Address (optional)"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="0x..."
          />
          {address && !isValidAddress && (
            <p className="text-xs text-[var(--neon-red)] mt-1">Invalid address format</p>
          )}
        </div>

        <div className="flex gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button onClick={handleSave} className="flex-1" disabled={!symbol}>
            Save
          </Button>
        </div>
      </div>
    </Modal>
  )
}
