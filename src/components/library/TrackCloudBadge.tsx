import { type CSSProperties } from 'react'
import { Cloud, HardDrive } from 'lucide-react'

interface TrackCloudBadgeProps {
  needsLocalFile?: boolean
  hasCloudAudio?: boolean
  size?: number
}

const badgeWrapStyle = (color: string): CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  color,
})

export default function TrackCloudBadge({
  needsLocalFile = false,
  hasCloudAudio = false,
  size = 12,
}: TrackCloudBadgeProps) {
  if (needsLocalFile) {
    return (
      <span
        title="Нужен локальный файл"
        aria-label="Нужен локальный файл"
        style={badgeWrapStyle('var(--premium)')}
      >
        <HardDrive size={size} strokeWidth={2} />
      </span>
    )
  }
  if (hasCloudAudio) {
    return (
      <span
        title="Аудио в облаке"
        aria-label="Аудио в облаке"
        style={badgeWrapStyle('var(--fg-mute)')}
      >
        <Cloud size={size} strokeWidth={2} />
      </span>
    )
  }
  return null
}
