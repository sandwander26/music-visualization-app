import { Play, Pause, SkipBack, SkipForward } from 'lucide-react'
import { useAudioStore } from '../../store/audioStore'
import { audioEngine } from '../../audio/audioEngine'
import { useLibraryStore, type LibraryTrack } from '../../store/libraryStore'
import { loadTrack } from '../../library/playback'

interface TransportProps {
  hasTrack: boolean
}

export default function Transport({ hasTrack }: TransportProps) {
  const isPlaying = useAudioStore((s) => s.isPlaying)
  const trackCount = useLibraryStore((s) => s.tracks.length)
  const playlistQueue = useAudioStore((s) => s.playlistQueue)
  const canStep = playlistQueue.length >= 2 || trackCount >= 2

  function togglePlay() {
    if (!hasTrack) return
    if (isPlaying) audioEngine.pause()
    else audioEngine.play()
  }

  async function stepTo(direction: 'prev' | 'next') {
    if (!canStep) return
    const audio = useAudioStore.getState()
    const lib = useLibraryStore.getState()

    let target: LibraryTrack | null = null

    if (audio.playlistQueue.length > 0 && lib.currentTrackId) {
      const idx = audio.playlistQueue.indexOf(lib.currentTrackId)
      if (idx >= 0) {
        const targetIdx = direction === 'next' ? idx + 1 : idx - 1
        if (targetIdx >= 0 && targetIdx < audio.playlistQueue.length) {
          const targetId = audio.playlistQueue[targetIdx]
          target = lib.tracks.find((t) => t.id === targetId) ?? null
        } else {
          return
        }
      }
    }

    if (!target) {
      target = direction === 'next' ? lib.getNextTrack() : lib.getPrevTrack()
    }

    if (!target) return
    await loadTrack(target)
    audioEngine.play()
    lib.setCurrentTrack(target.id)
  }

  return (
    <div className="flex items-center justify-center" style={{ gap: 18 }}>
      <SideBtn disabled={!canStep} title="Предыдущий трек" onClick={() => void stepTo('prev')}>
        <SkipBack size={16} />
      </SideBtn>

      <button
        type="button"
        onClick={togglePlay}
        disabled={!hasTrack}
        title={isPlaying ? 'Пауза' : 'Воспроизвести'}
        style={{
          width: 44,
          height: 44,
          borderRadius: '50%',
          background: hasTrack ? 'var(--fg)' : 'var(--bg-elev)',
          color: hasTrack ? 'var(--bg)' : 'var(--fg-mute)',
          border: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: hasTrack ? 'pointer' : 'not-allowed',
          opacity: hasTrack ? 1 : 0.5,
        }}
        className="hov-scale"
      >
        {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
      </button>

      <SideBtn disabled={!canStep} title="Следующий трек" onClick={() => void stepTo('next')}>
        <SkipForward size={16} />
      </SideBtn>
    </div>
  )
}

interface SideBtnProps {
  disabled?: boolean
  title: string
  children: React.ReactNode
  onClick?: () => void
}

function SideBtn({ disabled = false, title, children, onClick }: SideBtnProps) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className="hov-fg t-color-border"
      style={{
        width: 36,
        height: 36,
        borderRadius: 8,
        background: 'transparent',
        border: 'none',
        color: 'var(--fg-soft)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {children}
    </button>
  )
}
