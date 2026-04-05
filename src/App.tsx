import { useThemeStore } from './store/themeStore'
import { useUIStore } from './store/uiStore'
import { VisualizersGallery } from './pages/VisualizersGallery'
import { TopNav } from './components/TopNav'
import './styles/theme.css'

function App() {
  const theme = useThemeStore((s) => s.theme)
  const currentTab = useUIStore((s) => s.currentTab)

  return (
    <div className="app-root" data-theme={theme}>
      <TopNav />
      <main className="page">
        {currentTab === 'gallery' && <VisualizersGallery />}
      </main>
    </div>
  )
}

export default App
