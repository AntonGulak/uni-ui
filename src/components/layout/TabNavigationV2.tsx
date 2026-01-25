import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui'
import { usePoolStoreV2 } from '../../store/usePoolStoreV2'
import { PoolSetupFormV2 } from '../pool/PoolSetupFormV2'
import { LiquidityTabV2 } from '../liquidity/LiquidityTabV2'
import { SwapTabV2 } from '../swap/SwapTabV2'

export function TabNavigationV2() {
  const { activeTab, setActiveTab, initialized } = usePoolStoreV2()

  return (
    <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
      <TabsList className="grid grid-cols-3">
        <TabsTrigger value="setup">Pool Setup</TabsTrigger>
        <TabsTrigger value="liquidity" disabled={!initialized}>
          Liquidity
        </TabsTrigger>
        <TabsTrigger value="swap" disabled={!initialized}>
          Swap
        </TabsTrigger>
      </TabsList>

      <TabsContent value="setup">
        <PoolSetupFormV2 />
      </TabsContent>

      <TabsContent value="liquidity">
        <LiquidityTabV2 />
      </TabsContent>

      <TabsContent value="swap">
        <SwapTabV2 />
      </TabsContent>
    </Tabs>
  )
}
