import { useThemeStore } from './store/themeStore'
import { useUIStore } from './store/uiStore'
import { VisualizersGallery } from './pages/VisualizersGallery'
import { TopNav } from './components/TopNav'
import ProfileModal from './components/ProfileModal'
import SettingsModal from './components/SettingsModal'
import './styles/theme.css'

function App() {
  const theme = useThemeStore((s) => s.theme)
  const currentTab = useUIStore((s) => s.currentTab)
  const profileOpen = useUIStore((s) => s.profileOpen)
  const settingsOpen = useUIStore((s) => s.settingsOpen)
  const setProfileOpen = useUIStore((s) => s.setProfileOpen)
  const setSettingsOpen = useUIStore((s) => s.setSettingsOpen)

  return (
    <div className="app-root" data-theme={theme}>
      <TopNav />
      <main className="page">
        {currentTab === 'gallery' && <VisualizersGallery />}
      </main>
      {profileOpen ? <ProfileModal onClose={() => setProfileOpen(false)} /> : null}
      {settingsOpen ? <SettingsModal onClose={() => setSettingsOpen(false)} /> : null}
    </div>
  )
}

export default App
