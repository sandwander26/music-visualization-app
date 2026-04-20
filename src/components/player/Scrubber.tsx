import { useAudioStore } from '../../store/audioStore'
import { audioEngine } from '../../audio/audioEngine'

function fmt(s: number): string {
  if (!Number.isFinite(s) || s < 0) return '0:00'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${String(sec).padStart(2, '0')}`
}

interface ScrubberProps {
  hasTrack: boolean
}

export default function Scrubber({ hasTrack }: ScrubberProps) {
  const currentTime = useAudioStore((s) => s.currentTime)
  const duration = audioEngine.getDuration()
  const max = duration > 0 ? duration : 1
  const value = Math.min(currentTime, max)
  const pct = (value / max) * 100

  return (
    <div className="flex items-center" style={{ gap: 12 }}>
      <span
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 11,
          color: 'var(--fg-mute)',
          width: 36,
          textAlign: 'right',
        }}
      >
        {fmt(value)}
      </span>
      <input
        type="range"
        className="player-range"
        min={0}
        max={max}
        step={0.05}
        value={value}
        disabled={!hasTrack}
        onChange={(e) => audioEngine.seek(parseFloat(e.target.value))}
        style={{ flex: 1, opacity: hasTrack ? 1 : 0.4, ['--pct' as string]: `${pct}%` }}
      />
      <span
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 11,
          color: 'var(--fg-mute)',
          width: 36,
        }}
      >
        {fmt(duration)}
      </span>
    </div>
  )
}
