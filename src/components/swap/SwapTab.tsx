import { SwapForm } from './SwapForm'
import { SlippageTable } from './SlippageTable'
import { SwapCurveChart } from './SwapCurveChart'

export function SwapTab() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SwapForm />
        <SlippageTable />
      </div>
      <SwapCurveChart />
    </div>
  )
}
