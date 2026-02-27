import { useRef, useState, type CSSProperties } from 'react'
import { Camera, Loader2, User, X } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'

const AVATAR_SIZE = 72

const wrapStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 10,
  marginBottom: 16,
}

const circleStyle: CSSProperties = {
  width: AVATAR_SIZE,
  height: AVATAR_SIZE,
  borderRadius: '50%',
  overflow: 'hidden',
  border: '1px solid var(--border)',
  background: 'var(--bg-soft)',
  position: 'relative',
  flexShrink: 0,
}

interface ProfileAvatarProps {
  compact?: boolean
}

export default function ProfileAvatar({ compact = false }: ProfileAvatarProps) {
  const user = useAuthStore((s) => s.user)
  const avatarUrl = useAuthStore((s) => s.avatarObjectUrl)
  const uploadAvatar = useAuthStore((s) => s.uploadAvatar)
  const removeAvatar = useAuthStore((s) => s.removeAvatar)

  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!user) return null

  const size = compact ? 36 : AVATAR_SIZE

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError(null)
    setBusy(true)
    try {
      await uploadAvatar(file)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function onRemove() {
    if (!user?.hasAvatar && !avatarUrl) return
    setError(null)
    setBusy(true)
    try {
      await removeAvatar()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ ...wrapStyle, marginBottom: compact ? 0 : 16 }}>
      <button
        type="button"
        title="Загрузить фото"
        aria-label="Загрузить фото профиля"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        style={{
          ...circleStyle,
          width: size,
          height: size,
          padding: 0,
          cursor: busy ? 'wait' : 'pointer',
          border: '1px solid var(--border)',
        }}
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <span
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--fg-mute)',
            }}
          >
            <User size={compact ? 18 : 28} strokeWidth={1.5} />
          </span>
        )}
        {!compact ? (