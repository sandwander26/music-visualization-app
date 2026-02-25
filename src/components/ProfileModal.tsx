import { useEffect, useState, type CSSProperties } from 'react'
import { ArrowLeft, Cloud, Loader2, X } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { getApiBaseUrl } from '../config/api'
import ProfileAvatar from './profile/ProfileAvatar'
import ProfileAccountEdit from './profile/ProfileAccountEdit'
import ProfileForgotPassword from './profile/ProfileForgotPassword'

interface ProfileModalProps {
  isOpen: boolean
  onClose: () => void
}

type ProfileView = 'hub' | 'login' | 'register' | 'edit-account' | 'forgot-password'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const closeBtnStyle: CSSProperties = {
  position: 'absolute',
  top: 16,
  right: 16,
  width: 32,
  height: 32,
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'var(--bg-soft)',
  color: 'var(--fg-mute)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
}

export default function ProfileModal({ isOpen, onClose }: ProfileModalProps) {
  const [view, setView] = useState<ProfileView>('hub')

  useEffect(() => {
    if (isOpen) setView('hub')
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      className="overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-modal-title"
    >
      <div
        className="modal-card"
        style={{ maxWidth: 400, position: 'relative' }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          title="Закрыть"
          aria-label="Закрыть"
          style={closeBtnStyle}
        >
          <X size={14} />
        </button>

        {view === 'hub' ? (
          <HubView
            onLogin={() => setView('login')}
            onRegister={() => setView('register')}
            onEditAccount={() => setView('edit-account')}
          />
        ) : null}
        {view === 'edit-account' ? <ProfileAccountEdit onBack={() => setView('hub')} /> : null}
        {view === 'login' ? (
          <LoginPanel
            onBack={() => setView('hub')}
            onSwitchRegister={() => setView('register')}
            onForgotPassword={() => setView('forgot-password')}
          />
        ) : null}
        {view === 'forgot-password' ? (
          <ProfileForgotPassword
            onBack={() => setView('login')}
            onDone={() => setView('login')}
          />
        ) : null}
        {view === 'register' ? (
          <RegisterPanel onBack={() => setView('hub')} onSwitchLogin={() => setView('login')} />
        ) : null}
      </div>
    </div>
  )
}

function formatMb(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`
}

function HubView({
  onLogin,
  onRegister,
  onEditAccount,
}: {
  onLogin: () => void
  onRegister: () => void
  onEditAccount: () => void
}) {
  const user = useAuthStore((s) => s.user)
  const storage = useAuthStore((s) => s.storage)
  const syncStatus = useAuthStore((s) => s.syncStatus)
  const syncMessage = useAuthStore((s) => s.syncMessage)
  const logout = useAuthStore((s) => s.logout)
  const syncNow = useAuthStore((s) => s.syncNow)
  const [syncBusy, setSyncBusy] = useState(false)

  if (user) {
    return (
      <>
        <h2 id="profile-modal-title" className="auth-modal__title" style={{ margin: '0 40px 10px 0' }}>
          Профиль
        </h2>
        <ProfileAvatar />
        <p className="auth-modal__lead" style={{ marginTop: 0, textAlign: 'center' }}>
          {user.email}
        </p>

        <div
          style={{
            padding: '10px 12px',
            borderRadius: 8,
            border: '1px solid var(--border)',
            background: 'var(--bg)',
            fontSize: 12,
            lineHeight: 1.45,
            color: 'var(--fg-soft)',
            marginBottom: 14,
          }}
        >
          <p style={{ margin: 0, color: 'var(--fg)' }}>
            Библиотека синхронизируется между твоими устройствами — на другом компьютере нажми
            «Синхронизировать», чтобы увидеть те же треки и продолжить слушать.
          </p>
          {storage ? (
            <div style={{ marginTop: 10 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 11,
                  marginBottom: 4,
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <Cloud size={11} strokeWidth={2} aria-hidden />
                  Облачное аудио
                </span>
                <span>
                  {formatMb(storage.audioBytesUsed)} / {formatMb(storage.audioQuotaBytes)}
                </span>
              </div>
              <div
                style={{
                  height: 4,
                  borderRadius: 2,
                  background: 'var(--bg-soft)',
                  overflow: 'hidden',
                }}
              >
                <div