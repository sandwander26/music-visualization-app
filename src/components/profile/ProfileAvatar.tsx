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
          <span
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(0,0,0,0.45)',
              color: '#fff',
              opacity: busy ? 1 : 0,
              transition: 'opacity 0.15s',
            }}
            className="profile-avatar-hover"
          />
        ) : null}
        {busy ? (
          <span
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(0,0,0,0.5)',
            }}
          >
            <Loader2 size={compact ? 14 : 22} className="animate-spin" color="#fff" />
          </span>
        ) : null}
        {!compact && !busy ? (
          <span
            className="profile-avatar-icon"
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              opacity: 0,
              transition: 'opacity 0.15s',
              pointerEvents: 'none',
            }}
          >
            <Camera size={22} />
          </span>
        ) : null}
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,image/*"
        style={{ display: 'none' }}
        onChange={(e) => void onFileChange(e)}
      />

      {!compact ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--fg-soft)', textAlign: 'center' }}>
            {user.displayName || user.email}
          </p>
          <p style={{ margin: 0, fontSize: 11, color: 'var(--fg-mute)', textAlign: 'center' }}>
            JPG, PNG, WebP или GIF · до 2 МБ
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              type="button"
              className="btn btn--ghost"
              style={{ fontSize: 11, padding: '4px 10px' }}
              disabled={busy}
              onClick={() => inputRef.current?.click()}
            >
              {avatarUrl || user.hasAvatar ? 'Сменить фото' : 'Загрузить фото'}
            </button>
            {avatarUrl || user.hasAvatar ? (
              <button
                type="button"
                className="btn btn--ghost"
                style={{ fontSize: 11, padding: '4px 10px', color: 'var(--fg-mute)' }}
                disabled={busy}
                onClick={() => void onRemove()}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <X size={12} />
                  Убрать
                </span>
              </button>
            ) : null}
          </div>
          {error ? (
            <p style={{ margin: 0, fontSize: 11, color: 'var(--fg-mute)' }}>{error}</p>
          ) : null}
        </div>
      ) : null}

      <style>{`
        button:hover .profile-avatar-icon,
        button:focus-visible .profile-avatar-icon {
          opacity: 1;
        }
        button:hover .profile-avatar-hover {
          opacity: 1;
        }
      `}</style>
    </div>
  )
}
