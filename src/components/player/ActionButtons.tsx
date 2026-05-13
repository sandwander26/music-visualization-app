import { Mic2, Settings, X } from 'lucide-react'
import { useUIStore } from '../../store/uiStore'

interface ActionButtonsProps {
  onSettings: () => void
  onClose: () => void
}

export function ActionButtons({ onSettings, onClose }: ActionButtonsProps) {
  const karaokeOverlay = useUIStore((s) => s.karaokeOverlay)
  const setKaraokeOverlay = useUIStore((s) => s.setKaraokeOverlay)

  return (
    <div className="player-actions">
      <button
        onClick={() => setKaraokeOverlay(!karaokeOverlay)}
        className={`action-btn ${karaokeOverlay ? 'active' : ''}`}
        aria-label="Toggle karaoke"
      >
        <Mic2 size={20} />
      </button>
      <button onClick={onSettings} className="action-btn" aria-label="Settings">
        <Settings size={20} />
      </button>
      <button onClick={onClose} className="action-btn" aria-label="Close">
        <X size={20} />
      </button>
    </div>
  )
}
