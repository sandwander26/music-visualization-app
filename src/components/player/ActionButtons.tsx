import { useState } from 'react'
import { Settings, X } from 'lucide-react'

interface ActionButtonsProps {
  onSettings: () => void
  onClose: () => void
}

export function ActionButtons({ onSettings, onClose }: ActionButtonsProps) {
  return (
    <div className="player-actions">
      <button onClick={onSettings} className="action-btn">
        <Settings size={20} />
      </button>
      <button onClick={onClose} className="action-btn">
        <X size={20} />
      </button>
    </div>
  )
}
