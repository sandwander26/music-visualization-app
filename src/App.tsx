import { useThemeStore } from './store/themeStore'
import './styles/theme.css'

function App() {
  const theme = useThemeStore((s) => s.theme)

  return (
    <div className="app-root" data-theme={theme}>
      <h1>Loomi</h1>
      <p>Music visualization app</p>
    </div>
  )
}

export default App
