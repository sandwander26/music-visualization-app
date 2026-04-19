import { useState } from 'react'
import { Radio, Loader2 } from 'lucide-react'
import { useAudioStore } from '../store/audioStore'

export default function SystemAudioToggle() {
  const audioMode = useAudioStore((s) => s.audioMode)
  const [isConnecting, setIsConnecting] = useState(false)
  const [hovered, setHovered] = useState(false)

  const active = audioMode === 'system'

  async function onClick() {
    if (isConnecting) return

    if (active) {
      try {
        await useAudioStore.getState().setAudioMode('file')
      } catch (err) {
        console.error('[system-toggle] выключение не удалось:', err)
      }
      return
    }

    setIsConnecting(true)
    try {
      await useAudioStore.getState().setAudioMode('system')
    } catch (err) {
      console.error('[system-toggle] не удалось включить системный звук:', err)
    } finally {
      setIsConnecting(false)
    }
  }

  let label = 'Live прослушивание'
  if (isConnecting) label = 'Подключаюсь...'

  let bg = 'var(--bg-soft)'
  let color = 'var(--fg-mute)'
  let border = 'var(--border)'

  if (active) {
    bg = 'var(--fg)'
    color = 'var(--bg)'
    border = 'var(--fg)'
  } else if (hovered) {
    color = 'var(--fg)'
    border = 'var(--border-active)'
  }

  const iconNode = isConnecting ? (
    <Loader2 size={14} className="live-spin-icon" />
  ) : active ? (
    <Radio size={14} className="live-pulse-icon" />
  ) : (
    <Radio size={14} />
  )

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        disabled={isConnecting}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          height: 34,
          padding: '0 14px',
          borderRadius: 10,
          border: `1px solid ${border}`,
          background: bg,
          color,
          fontSize: 13,
          fontWeight: 500,
          fontFamily: 'inherit',
          cursor: isConnecting ? 'wait' : 'pointer',
          transition: 'background 0.15s, color 0.15s, border-color 0.15s',
        }}
      >
        {iconNode}
        <span>{label}</span>
      </button>

    </>
  )
}
