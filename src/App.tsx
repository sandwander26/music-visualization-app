import { useThemeStore } from './store/themeStore'
import { CircularVisualizer } from './visual/CircularVisualizer'
import './styles/theme.css'

function App() {
  const theme = useThemeStore((s) => s.theme)

  return (
    <div className="app-root" data-theme={theme}>
      <div className="viz-stage">
        <CircularVisualizer />
      </div>
    </div>
  )
}

export default App
