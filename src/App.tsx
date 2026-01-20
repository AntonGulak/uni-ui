import { AppShell } from './components/layout/AppShell'
import { TabNavigation } from './components/layout/TabNavigation'
import { SEO } from './components/seo'

function App() {
  return (
    <>
      <SEO />
      <AppShell>
        <TabNavigation />
      </AppShell>
    </>
  )
}

export default App
