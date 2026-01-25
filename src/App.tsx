import { AppShell } from './components/layout/AppShell'
import { VersionSwitcher } from './components/layout/VersionSwitcher'
import { SEO } from './components/seo'

function App() {
  return (
    <>
      <SEO />
      <AppShell>
        <VersionSwitcher />
      </AppShell>
    </>
  )
}

export default App
