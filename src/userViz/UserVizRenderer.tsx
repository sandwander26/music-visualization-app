import { useAudioStore } from '../store/audioStore'
import { UserVizErrorBoundary, UserVizErrorFallback } from './UserVizErrorBoundary'
import type { UserVisualizerRuntime } from './types'

interface UserVizRendererProps {
  runtime: UserVisualizerRuntime
}

export default function UserVizRenderer({ runtime }: UserVizRendererProps) {
  const audioData = useAudioStore((s) => s.audioData)
  const beat = useAudioStore((s) => s.beat)
  const energy = useAudioStore((s) => s.energy)
  const currentTime = useAudioStore((s) => s.currentTime)

  if (!runtime.component) {
    return <UserVizErrorFallback message={runtime.error ?? undefined} />
  }

  const Component = runtime.component

  return (
    <UserVizErrorBoundary resetKey={runtime.id}>
      <Component
        audioData={audioData}
        beat={beat}
        energy={energy}
        currentTime={currentTime}
      />
    </UserVizErrorBoundary>
  )
}
