import { useThemeStore } from './store/themeStore'
import { useUIStore } from './store/uiStore'
import { VisualizersGallery } from './pages/VisualizersGallery'
import { Library } from './pages/Library'
import { Wave } from './pages/Wave'
import UserVizPage from './pages/UserVizPage'
import { TopNav } from './components/TopNav'
import { MiniPlayer } from './components/MiniPlayer'
import ProfileModal from './components/ProfileModal'
import SettingsModal from './components/SettingsModal'
import { LyricsSearchModal } from './components/player/LyricsSearchModal'
import './styles/theme.css'

function App() {
  const theme = useThemeStore((s) => s.theme)
  const currentTab = useUIStore((s) => s.currentTab)
  const profileOpen = useUIStore((s) => s.profileOpen)
  const settingsOpen = useUIStore((s) => s.settingsOpen)
  const lyricsSearchOpen = useUIStore((s) => s.lyricsSearchOpen)
  const setProfileOpen = useUIStore((s) => s.setProfileOpen)
  const setSettingsOpen = useUIStore((s) => s.setSettingsOpen)
  const setLyricsSearchOpen = useUIStore((s) => s.setLyricsSearchOpen)

  return (
    <div className="app-root" data-theme={theme}>
      <TopNav />
      <main className="page">
        {currentTab === 'gallery' && <VisualizersGallery />}
        {currentTab === 'library' && <Library />}
        {currentTab === 'wave' && <Wave />}
        {currentTab === 'userViz' && <UserVizPage />}
      </main>
      <MiniPlayer />
      {profileOpen ? <ProfileModal onClose={() => setProfileOpen(false)} /> : null}
      {settingsOpen ? <SettingsModal onClose={() => setSettingsOpen(false)} /> : null}
      {lyricsSearchOpen ? <LyricsSearchModal onClose={() => setLyricsSearchOpen(false)} /> : null}
    </div>
  )
}

export default App
