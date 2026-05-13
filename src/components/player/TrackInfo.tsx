import { FileSearch } from 'lucide-react'
import { useAudioStore } from '../../store/audioStore'
import { useUIStore } from '../../store/uiStore'

export function TrackInfo() {
  const isPlaying = useAudioStore((s) => s.isPlaying)
  const setLyricsSearchOpen = useUIStore((s) => s.setLyricsSearchOpen)

  return (
    <div className="track-info">
      <div className="track-title">Now playing</div>
      <div className="track-state">{isPlaying ? 'playing' : 'paused'}</div>
      <button
        onClick={() => setLyricsSearchOpen(true)}
        className="find-lyrics-btn"
        aria-label="Find lyrics"
      >
        <FileSearch size={16} />
        <span>Find lyrics</span>
      </button>
    </div>
  )
}
