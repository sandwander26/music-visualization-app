import { useAudioStore } from '../../store/audioStore'

export function TrackInfo() {
  const isPlaying = useAudioStore((s) => s.isPlaying)

  return (
    <div className="track-info">
      <div className="track-title">Now playing</div>
      <div className="track-state">{isPlaying ? 'playing' : 'paused'}</div>
    </div>
  )
}
