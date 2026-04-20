import { VisualizerHost } from './VisualizerHost'

interface VisualizerStageProps {
  vizId: string
}

export function VisualizerStage({ vizId }: VisualizerStageProps) {
  return (
    <div className="visualizer-stage">
      <VisualizerHost vizId={vizId} />
    </div>
  )
}
