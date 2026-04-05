import { useEffect, useRef } from 'react'
import { Search, Sun, Moon, Monitor, Settings, User } from 'lucide-react'
import { useUIStore, type Tab } from '../store/uiStore'
import { useThemeStore } from '../store/themeStore'
import { useAudioStore } from '../store/audioStore'

const TABS: { id: Tab; label: string }[] = [
  { id: 'visualizers', label: 'Визуализаторы' },
  { id: 'library', label: 'Мои треки' },
  { id: 'wave', label: 'Мое настроение' },
  { id: 'user-viz', label: 'Мои визуализаторы' },
]

const SEARCH_PLACEHOLDERS: Partial<Record<Tab, string>> = {
  visualizers: 'Поиск визуализаторов',
  library: 'Поиск треков',
  'user-viz': 'Поиск моих визуализаторов',
}

export default function TopNav() {
  const currentTab = useUIStore((s) => s.currentTab)
  const setTab = useUIStore((s) => s.setTab)
  const searchQuery = useUIStore((s) => s.searchQuery)
  const setSearchQuery = useUIStore((s) => s.setSearchQuery)
  const mode = useThemeStore((s) => s.mode)
  const cycleMode = useThemeStore((s) => s.cycleMode)
  const audioMode = useAudioStore((s) => s.audioMode)
  const setProfileOpen = useUIStore((s) => s.setProfileOpen)
  const setSettingsOpen = useUIStore((s) => s.setSettingsOpen)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isCmdK = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k'
      if (!isCmdK) return
      if (!searchRef.current) return
      e.preventDefault()
      searchRef.current.focus()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const ThemeIcon = mode === 'dark' ? Sun : mode === 'light' ? Moon : Monitor

  return (
    <header
      className="fixed inset-x-0 top-0 z-50 backdrop-blur-md"
      style={{
        height: 60,
        background: 'color-mix(in srgb, var(--bg) 70%, transparent)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <div
        className="mx-auto flex h-full items-center gap-8"
        style={{ maxWidth: 1400, padding: '0 32px' }}
      >
        <span
          style={{
            fontWeight: 600,
            fontSize: 14,
            letterSpacing: '-0.01em',
            color: 'var(--fg)',
          }}
        >
          Loomi
        </span>

        <nav className="flex items-center gap-1">
          {TABS.map((tab) => {
            const active = tab.id === currentTab
            const disabled = audioMode === 'system' && tab.id === 'wave'
            const title = disabled ? 'Доступно только для файлов' : undefined
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  if (disabled) return
                  if (tab.id !== currentTab) setSearchQuery('')
                  setTab(tab.id)
                }}
                title={title}
                disabled={disabled}
                className={`t-bg-color ${active ? '' : 'hov-fg'}`}
                style={{
                  padding: '6px 12px',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 500,
                  background: active ? 'var(--bg-elev)' : 'transparent',
                  color: active ? 'var(--fg)' : 'var(--fg-mute)',
                  border: 'none',
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  opacity: disabled ? 0.4 : 1,
                }}
              >
                {tab.label}
              </button>
            )
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {SEARCH_PLACEHOLDERS[currentTab] ? (
            <div
              className="flex items-center"
              style={{
                width: 240,
                height: 32,
                background: 'var(--bg-soft)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: '0 12px 0 10px',
                gap: 8,
                transition: 'background 0.15s, border-color 0.15s',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-active)'
                e.currentTarget.style.background = 'var(--bg-elev)'
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'var(--border)'
                e.currentTarget.style.background = 'var(--bg-soft)'
              }}
            >
              <Search size={14} style={{ color: 'var(--fg-mute)', flexShrink: 0 }} />
              <input
                ref={searchRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={SEARCH_PLACEHOLDERS[currentTab]}
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: 'var(--fg)',
                  fontSize: 13,
                  fontFamily: 'inherit',
                }}
              />
              <kbd
                style={{
                  marginLeft: 'auto',
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 10,
                  color: 'var(--fg-mute)',
                  padding: '2px 5px',
                  border: '1px solid var(--border)',
                  borderRadius: 4,
                  lineHeight: 1,
                }}
              >
                ⌘K
              </kbd>
            </div>
          ) : null}

          <IconButton onClick={cycleMode} title={`Тема: ${mode}`}>
            <ThemeIcon size={14} />
          </IconButton>
          <IconButton onClick={() => setProfileOpen(true)} title="Профиль и синхронизация">
            <User size={14} />
          </IconButton>
          <IconButton onClick={() => setSettingsOpen(true)} title="Настройки">
            <Settings size={14} />
          </IconButton>
        </div>
      </div>
    </header>
  )
}

interface IconButtonProps {
  onClick: () => void
  title: string
  children: React.ReactNode
}

function IconButton({ onClick, title, children }: IconButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="hov-icon-btn t-color-border"
      style={{
        width: 32,
        height: 32,
        borderRadius: 8,
        border: '1px solid var(--border)',
        background: 'var(--bg-soft)',
        color: 'var(--fg-mute)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  )
}
