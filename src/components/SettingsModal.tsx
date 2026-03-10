import { useEffect, type CSSProperties } from 'react'
import { X } from 'lucide-react'
import { useSettingsStore } from '../store/settingsStore'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

const closeBtnStyle: CSSProperties = {
  position: 'absolute',
  top: 16,
  right: 16,
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
}

const ITEM_LABEL_STYLE: CSSProperties = {
  fontSize: 13,
  fontWeight: 500,
  color: 'var(--fg)',
}

const SECTION_TITLE_STYLE: CSSProperties = {
  fontSize: 15,
  fontWeight: 600,
  letterSpacing: '-0.01em',
  color: 'var(--fg)',
  margin: 0,
}

const HOTKEYS: { keys: string; action: string }[] = [
  { keys: 'Space', action: 'Play / Pause' },
  { keys: '←  →', action: 'Предыдущий / следующий визуализатор' },
  { keys: 'F', action: 'Полноэкранный режим' },
  { keys: 'M', action: 'Включить / выключить звук' },
  { keys: 'Esc', action: 'Закрыть плеер или модальное окно' },
]

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const karaokeOnLyricsLoaded = useSettingsStore((s) => s.karaokeOnLyricsLoaded)
  const setKaraokeOnLyricsLoaded = useSettingsStore((s) => s.setKaraokeOnLyricsLoaded)
  const autoSearchLyrics = useSettingsStore((s) => s.autoSearchLyrics)
  const setAutoSearchLyrics = useSettingsStore((s) => s.setAutoSearchLyrics)
  const defaultVolume = useSettingsStore((s) => s.defaultVolume)
  const setDefaultVolume = useSettingsStore((s) => s.setDefaultVolume)

  useEffect(() => {
    if (!isOpen) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const volumePct = Math.round(defaultVolume * 100)

  return (
    <div
      className="overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-modal-title"
    >
      <div
        className="modal-card"
        style={{ maxWidth: 480, position: 'relative' }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          title="Закрыть"
          aria-label="Закрыть"
          style={closeBtnStyle}
        >
          <X size={14} />
        </button>

        <h2
          id="settings-modal-title"
          style={{
            fontSize: 20,
            fontWeight: 600,
            letterSpacing: '-0.02em',
            margin: '0 40px 16px 0',
            color: 'var(--fg)',
          }}
        >
          Настройки
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Section title="Плеер">
            <ToggleRow
              label="Караоке при загрузке текста"
              hint="Включать overlay, когда для трека найден или загружен LRC"
              checked={karaokeOnLyricsLoaded}
              onChange={setKaraokeOnLyricsLoaded}
            />

            <ToggleRow
              label="Автопоиск текста (LRCLIB)"
              hint="Искать синхронный текст при загрузке трека"
              checked={autoSearchLyrics}
              onChange={setAutoSearchLyrics}
            />

            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--fg)', marginBottom: 8 }}>
                Громкость по умолчанию — {volumePct}%
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={volumePct}
                onChange={(e) => setDefaultVolume(Number(e.target.value) / 100)}
                style={{ width: '100%', accentColor: 'var(--premium)' }}
              />
            </div>
          </Section>

          <Section title="Справка">
            <div
              style={{
                borderRadius: 8,
                border: '1px solid var(--border)',
                overflow: 'hidden',
              }}