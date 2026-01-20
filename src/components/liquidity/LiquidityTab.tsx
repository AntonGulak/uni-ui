import { LiquidityForm } from './LiquidityForm'
import { PositionsList } from './PositionsList'

export function LiquidityTab() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <LiquidityForm />
      <PositionsList />
    </div>
  )
}
