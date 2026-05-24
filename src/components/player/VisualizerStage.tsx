import { useMemo } from 'react'
import { useAudioStore } from '../../store/audioStore'
import { useUIStore } from '../../store/uiStore'
import VisualizerHost from './VisualizerHost'
import { KaraokeLyricsLayer } from './KaraokeLyricsLayer'
import { getKaraokePalette } from '../../visual/karaokeVizPalette'

interface VisualizerStageProps {
  vizId: string
  isFullscreen: boolean
}

export default function VisualizerStage({ vizId, isFullscreen }: VisualizerStageProps) {
  const trackTitle = useAudioStore((s) => s.trackInfo.title)
  const hasTrack = trackTitle !== ''
  const karaokeOverlay = useUIStore((s) => s.karaokeOverlay)

  const showKaraokeLayer = karaokeOverlay && hasTrack
  const karaokePalette = useMemo(() => getKaraokePalette(vizId), [vizId])

  const emptyHint = !hasTrack ? (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        bottom: 24,
        transform: 'translateX(-50%)',
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 11,
        letterSpacing: '0.16em',
        textTransform: 'uppercase',
        color: 'var(--fg-mute)',
        background: 'rgba(0,0,0,0.5)',
        padding: '6px 12px',
        borderRadius: 6,
        pointerEvents: 'none',
        zIndex: 10,
      }}
    >
      Закинь трек, чтобы начать
    </div>
  ) : null

  if (isFullscreen) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 200,
          background: '#000',
        }}
      >
        <VisualizerHost vizId={vizId} />
        {showKaraokeLayer ? (
          <KaraokeLyricsLayer variant="overlay" palette={karaokePalette} />
        ) : null}
      </div>
    )
  }

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        aspectRatio: '16 / 9',
        borderRadius: 12,
        overflow: 'hidden',
        background: '#000',
        border: '1px solid var(--border)',
      }}
    >
      <VisualizerHost vizId={vizId} />
      {showKaraokeLayer ? (
        <KaraokeLyricsLayer variant="overlay" palette={karaokePalette} />
      ) : null}
      {emptyHint}
    </div>
  )
}
