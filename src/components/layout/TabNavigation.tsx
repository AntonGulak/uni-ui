import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui'
import { usePoolStore } from '../../store/usePoolStore'
import { PoolSetupForm } from '../pool/PoolSetupForm'
import { PositionsTab } from '../positions/PositionsTab'
import { SwapTab } from '../swap/SwapTab'

export function TabNavigation() {
  const { activeTab, setActiveTab, pool } = usePoolStore()

  return (
    <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
      <TabsList className="grid grid-cols-3">
        <TabsTrigger value="setup">Pool Setup</TabsTrigger>
        <TabsTrigger value="liquidity" disabled={!pool.initialized}>
          Positions
        </TabsTrigger>
        <TabsTrigger value="swap" disabled={!pool.initialized}>
          Swap & Analysis
        </TabsTrigger>
      </TabsList>

      <TabsContent value="setup">
        <PoolSetupForm />
      </TabsContent>

      <TabsContent value="liquidity">
        <PositionsTab />
      </TabsContent>

      <TabsContent value="swap">
        <SwapTab />
      </TabsContent>
    </Tabs>
  )
}
