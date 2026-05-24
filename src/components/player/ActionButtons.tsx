import { useState, type ReactNode } from 'react'
import { SlidersHorizontal, Mic2 } from 'lucide-react'
import { useUIStore } from '../../store/uiStore'

interface ActionButtonsProps {
  hasTrack: boolean
  onOpenParams: () => void
}

export default function ActionButtons({ hasTrack, onOpenParams }: ActionButtonsProps) {
  const karaokeOverlay = useUIStore((s) => s.karaokeOverlay)
  const toggleKaraokeOverlay = useUIStore((s) => s.toggleKaraokeOverlay)

  return (
    <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 8 }}>
      <ActionBtn icon={<SlidersHorizontal size={14} />} label="Параметры" onClick={onOpenParams} />
      <ActionBtn
        icon={<Mic2 size={14} />}
        label="Караоке"
        title="Текст поверх текущего визуализатора"
        active={karaokeOverlay}
        disabled={!hasTrack}
        onClick={() => toggleKaraokeOverlay()}
      />
    </div>
  )
}

interface ActionBtnProps {
  icon: ReactNode
  label: string
  title?: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
}

function ActionBtn({
  icon,
  label,
  title,
  active = false,
  disabled = false,
  onClick,
}: ActionBtnProps) {
  const [hover, setHover] = useState(false)
  let bg = 'var(--bg-soft)'
  let color = 'var(--fg-soft)'
  let border = 'var(--border)'
  if (active) {
    bg = 'var(--bg-elev)'
    color = 'var(--fg)'
    border = 'var(--border-active)'
  } else if (hover && !disabled) {
    color = 'var(--fg)'
    border = 'var(--border-active)'
  }

  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        padding: '10px 12px',
        borderRadius: 8,
        border: `1px solid ${border}`,
        background: bg,
        color,
        fontSize: 12,
        fontWeight: 500,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        transition: 'color 0.15s, border-color 0.15s, background 0.15s',
        fontFamily: 'inherit',
      }}
    >
      {icon}
      <span>{label}</span>
    </button>
  )
}
