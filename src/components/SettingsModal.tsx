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
            >
              {HOTKEYS.map((row, i) => (
                <div
                  key={row.keys}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    padding: '8px 12px',
                    borderTop: i > 0 ? '1px solid var(--border)' : undefined,
                    background: i % 2 === 0 ? 'var(--bg-soft)' : 'transparent',
                  }}
                >
                  <kbd
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 11,
                      padding: '2px 8px',
                      borderRadius: 4,
                      border: '1px solid var(--border)',
                      background: 'var(--bg)',
                      color: 'var(--fg)',
                      flexShrink: 0,
                    }}
                  >
                    {row.keys}
                  </kbd>
                  <span style={{ ...ITEM_LABEL_STYLE, textAlign: 'right' }}>{row.action}</span>
                </div>
              ))}
            </div>
            <p style={{ margin: '8px 0 0', fontSize: 11, color: 'var(--fg-mute)', lineHeight: 1.4 }}>
              Горячие клавиши работают в открытом плеере визуализатора.
            </p>
          </Section>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section
      style={{
        padding: '14px 16px',
        borderRadius: 12,
        border: '1px solid var(--border-strong)',
        background: 'var(--bg-soft)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 14,
          paddingBottom: 10,
          borderBottom: '1px solid var(--border)',
        }}
      >
        <span
          aria-hidden
          style={{
            width: 4,
            height: 18,
            borderRadius: 2,
            background: 'var(--premium)',
            flexShrink: 0,
          }}
        />
        <h3 style={SECTION_TITLE_STYLE}>{title}</h3>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>{children}</div>
    </section>
  )
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
  disabled = false,
}: {
  label: string
  hint?: string
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 12,
        opacity: disabled ? 0.55 : 1,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--fg)' }}>{label}</div>
        {hint ? (
          <div style={{ marginTop: 4, fontSize: 11, lineHeight: 1.4, color: 'var(--fg-mute)' }}>
            {hint}
          </div>
        ) : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        style={{
          flexShrink: 0,
          width: 40,
          height: 22,
          borderRadius: 11,
          border: '1px solid var(--border)',
          background: checked ? 'var(--premium-bg)' : 'var(--bg-soft)',
          position: 'relative',
          cursor: disabled ? 'not-allowed' : 'pointer',
          transition: 'background 0.15s',
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: 2,
            left: checked ? 20 : 2,
            width: 16,
            height: 16,
            borderRadius: '50%',
            background: checked ? 'var(--premium)' : 'var(--fg-mute)',
            transition: 'left 0.15s',
          }}
        />
      </button>
    </div>
  )
}

