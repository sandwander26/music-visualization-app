import { useUserVizStore } from './userVizStore'
import UserVizRenderer from './UserVizRenderer'
import { UserVizErrorFallback } from './UserVizErrorBoundary'

interface UserVizDispatchProps {
  vizId: string
}

export default function UserVizDispatch({ vizId }: UserVizDispatchProps) {
  const runtime = useUserVizStore((s) => s.visualizers.find((v) => v.id === vizId))
  if (!runtime) {
    return <UserVizErrorFallback message="Визуализатор не найден" />
  }
  return <UserVizRenderer runtime={runtime} key={runtime.id} />
}
