import { useState } from 'react'
import { Volume2, VolumeX } from 'lucide-react'
import { useAudioStore } from '../../store/audioStore'
import { audioEngine } from '../../audio/audioEngine'

export default function VolumeControl() {
  const volume = useAudioStore((s) => s.volume)
  const [lastNonZero, setLastNonZero] = useState(volume > 0 ? volume : 1)
  const muted = volume === 0
  const pct = Math.round(volume * 100)

  function toggleMute() {
    if (muted) audioEngine.setVolume(lastNonZero || 1)
    else {
      setLastNonZero(volume)
      audioEngine.setVolume(0)
    }
  }

  function onChange(v: number) {
    if (v > 0) setLastNonZero(v)
    audioEngine.setVolume(v)
  }

  return (
    <div className="flex items-center" style={{ gap: 8 }}>
      <button
        type="button"
        onClick={toggleMute}
        title={muted ? 'Включить звук' : 'Выключить звук'}
        className="hov-fg t-color-border"
        style={{
          width: 24,
          height: 24,
          background: 'transparent',
          border: 'none',
          color: 'var(--fg-soft)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
      </button>
      <input
        type="range"
        className="player-range"
        min={0}
        max={1}
        step={0.01}
        value={volume}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ flex: 1, ['--pct' as string]: `${pct}%` }}
      />
    </div>
  )
}
