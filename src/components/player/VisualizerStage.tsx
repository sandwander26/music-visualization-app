import { VisualizerHost } from './VisualizerHost'
import { KaraokeLyricsLayer } from './KaraokeLyricsLayer'
import { useUIStore } from '../../store/uiStore'

interface VisualizerStageProps {
  vizId: string
}

export function VisualizerStage({ vizId }: VisualizerStageProps) {
  const karaokeOverlay = useUIStore((s) => s.karaokeOverlay)

  return (
    <div className="visualizer-stage">
      <VisualizerHost vizId={vizId} />
      {karaokeOverlay && <KaraokeLyricsLayer variant="overlay" />}
    </div>
  )
}
