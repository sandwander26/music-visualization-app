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
                  style={{
                    height: '100%',
                    width: `${Math.min(100, (storage.audioBytesUsed / storage.audioQuotaBytes) * 100)}%`,
                    background: 'var(--premium)',
                  }}
                />
              </div>
            </div>
          ) : null}
        </div>

        {syncMessage ? (
          <div
            className="auth-modal__hint"
            style={{
              marginBottom: 10,
              color: syncStatus === 'error' ? 'var(--fg-mute)' : 'var(--premium)',
            }}
          >
            {syncStatus === 'syncing' ? 'Синхронизация…' : syncMessage}
          </div>
        ) : null}

        <div className="auth-modal__stack">
          <button
            type="button"
            className="btn btn--primary"
            style={{ width: '100%' }}
            disabled={syncBusy}
            onClick={() => {
              setSyncBusy(true)
              void syncNow()
                .catch(() => {})
                .finally(() => setSyncBusy(false))
            }}
          >
            {syncBusy ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <Loader2 size={14} className="animate-spin" />
                Синхронизация…
              </span>
            ) : (
              'Синхронизировать сейчас'
            )}
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            style={{ width: '100%' }}
            onClick={onEditAccount}
          >
            Email и пароль
          </button>
          <button type="button" className="btn btn--ghost" style={{ width: '100%' }} onClick={logout}>
            Выйти
          </button>
        </div>
        <p className="auth-modal__muted" style={{ marginTop: 12 }}>
          API: {getApiBaseUrl()}
        </p>
      </>
    )
  }

  return (
    <>
      <h2 id="profile-modal-title" className="auth-modal__title" style={{ margin: '0 40px 10px 0' }}>
        Профиль
      </h2>
      <p className="auth-modal__lead" style={{ marginTop: 0 }}>
        Войдите в аккаунт, чтобы синхронизировать библиотеку и тексты между устройствами.
      </p>

      <div className="auth-modal__stack">
        <button type="button" className="btn btn--primary" style={{ width: '100%' }} onClick={onLogin}>
          Войти
        </button>
        <button
          type="button"
          className="btn btn--ghost"
          style={{ width: '100%' }}
          onClick={onRegister}
        >
          Регистрация
        </button>
      </div>
    </>
  )
}

function LoginPanel({
  onBack,
  onSwitchRegister,
  onForgotPassword,
}: {
  onBack: () => void
  onSwitchRegister: () => void
  onForgotPassword: () => void
}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({})
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const login = useAuthStore((s) => s.login)

  function validate(): boolean {
    const next: typeof errors = {}
    const em = email.trim()
    if (!em) next.email = 'Введите email'
    else if (!EMAIL_RE.test(em)) next.email = 'Некорректный email'
    if (!password) next.password = 'Введите пароль'
    else if (password.length < 6) next.password = 'Минимум 6 символов'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (!validate()) return
    setBusy(true)
    try {
      await login(email.trim(), password)
      onBack()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="auth-modal__header-row">
        <button type="button" className="auth-modal__back" onClick={onBack} aria-label="Назад">
          <ArrowLeft size={16} strokeWidth={2} />
        </button>
        <h2 id="profile-modal-title" className="auth-modal__title">
          Вход
        </h2>
      </div>
      <p className="auth-modal__lead">Войди в аккаунт Loomi.</p>

      <form onSubmit={submit} noValidate>
        <div className="auth-modal__field">
          <label className="auth-modal__label" htmlFor="profile-login-email">
            Email
          </label>
          <div
            className={`auth-modal__input-shell${errors.email ? ' auth-modal__input-shell--error' : ''}`}
          >
            <input
              id="profile-login-email"
              className="auth-modal__input"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                setFormError(null)
                if (errors.email) setErrors((x) => ({ ...x, email: undefined }))
              }}
              placeholder="you@example.com"
            />
          </div>
          {errors.email ? (
            <div className="auth-modal__hint auth-modal__hint--error">{errors.email}</div>
          ) : null}
        </div>

        <div className="auth-modal__field">
          <label className="auth-modal__label" htmlFor="profile-login-password">
            Пароль
          </label>
          <div
            className={`auth-modal__input-shell${errors.password ? ' auth-modal__input-shell--error' : ''}`}
          >
            <input
              id="profile-login-password"
              className="auth-modal__input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                setFormError(null)
                if (errors.password) setErrors((x) => ({ ...x, password: undefined }))
              }}
              placeholder="••••••••"
            />
          </div>
          {errors.password ? (
            <div className="auth-modal__hint auth-modal__hint--error">{errors.password}</div>
          ) : null}
        </div>

        <div style={{ marginTop: 8 }}>
          <button type="button" className="auth-modal__link" onClick={onForgotPassword}>
            Забыли пароль?
          </button>
        </div>

        <div className="auth-modal__stack auth-modal__stack--tight" style={{ marginTop: 18 }}>
          <button type="submit" className="btn btn--primary" style={{ width: '100%' }} disabled={busy}>
            {busy ? 'Вход…' : 'Войти'}
          </button>
        </div>

        {formError ? (
          <div className="auth-modal__hint auth-modal__hint--error" style={{ marginTop: 12 }}>
            {formError}
          </div>
        ) : null}
      </form>

      <p className="auth-modal__muted">
        Нет аккаунта?{' '}
        <button type="button" className="auth-modal__link" onClick={onSwitchRegister}>
          Регистрация
        </button>
      </p>
    </>
  )
}

function RegisterPanel({
  onBack,
  onSwitchLogin,
}: {
  onBack: () => void
  onSwitchLogin: () => void
}) {
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [errors, setErrors] = useState<{
    displayName?: string
    email?: string
    password?: string
    password2?: string
  }>({})
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const register = useAuthStore((s) => s.register)

  function validate(): boolean {
    const next: typeof errors = {}
    const name = displayName.trim()
    if (name.length > 48) next.displayName = 'Не длиннее 48 символов'

    const em = email.trim()
    if (!em) next.email = 'Введите email'
    else if (!EMAIL_RE.test(em)) next.email = 'Некорректный email'

    if (!password) next.password = 'Придумай пароль'
    else if (password.length < 8) next.password = 'Минимум 8 символов'

    if (!password2) next.password2 = 'Повтори пароль'
    else if (password !== password2) next.password2 = 'Пароли не совпадают'

    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (!validate()) return
    setBusy(true)
    try {
      await register(email.trim(), password, displayName.trim() || undefined)
      onBack()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="auth-modal__header-row">
        <button type="button" className="auth-modal__back" onClick={onBack} aria-label="Назад">
          <ArrowLeft size={16} strokeWidth={2} />
        </button>
        <h2 id="profile-modal-title" className="auth-modal__title">
          Регистрация
        </h2>
      </div>
      <p className="auth-modal__lead">Создай аккаунт для синхронизации библиотеки, текстов и настроек.</p>

      <form onSubmit={submit} noValidate>
        <div className="auth-modal__field">
          <label className="auth-modal__label" htmlFor="profile-reg-name">
            Имя <span style={{ opacity: 0.65 }}>(необязательно)</span>
          </label>
          <div
            className={`auth-modal__input-shell${errors.displayName ? ' auth-modal__input-shell--error' : ''}`}
          >
            <input
              id="profile-reg-name"
              className="auth-modal__input"
              type="text"
              autoComplete="nickname"
              value={displayName}
              onChange={(e) => {
                setDisplayName(e.target.value)
                setFormError(null)
                if (errors.displayName) setErrors((x) => ({ ...x, displayName: undefined }))
              }}
              placeholder="Как к тебе обращаться"
            />
          </div>
          {errors.displayName ? (
            <div className="auth-modal__hint auth-modal__hint--error">{errors.displayName}</div>
          ) : null}
        </div>

        <div className="auth-modal__field">
          <label className="auth-modal__label" htmlFor="profile-reg-email">
            Email
          </label>
          <div
            className={`auth-modal__input-shell${errors.email ? ' auth-modal__input-shell--error' : ''}`}
          >
            <input
              id="profile-reg-email"
              className="auth-modal__input"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                setFormError(null)
                if (errors.email) setErrors((x) => ({ ...x, email: undefined }))
              }}
              placeholder="you@example.com"
            />
          </div>
          {errors.email ? (
            <div className="auth-modal__hint auth-modal__hint--error">{errors.email}</div>
          ) : null}
        </div>

        <div className="auth-modal__field">
          <label className="auth-modal__label" htmlFor="profile-reg-password">
            Пароль
          </label>
          <div
            className={`auth-modal__input-shell${errors.password ? ' auth-modal__input-shell--error' : ''}`}
          >
            <input
              id="profile-reg-password"
              className="auth-modal__input"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                setFormError(null)
                if (errors.password) setErrors((x) => ({ ...x, password: undefined }))
              }}
              placeholder="Минимум 8 символов"
            />
          </div>
          {errors.password ? (
            <div className="auth-modal__hint auth-modal__hint--error">{errors.password}</div>
          ) : (
            <div className="auth-modal__hint">Не используй пароль от почты или соцсетей.</div>
          )}
        </div>

        <div className="auth-modal__field">
          <label className="auth-modal__label" htmlFor="profile-reg-password2">
            Пароль ещё раз
          </label>
          <div
            className={`auth-modal__input-shell${errors.password2 ? ' auth-modal__input-shell--error' : ''}`}
          >
            <input
              id="profile-reg-password2"
              className="auth-modal__input"
              type="password"
              autoComplete="new-password"
              value={password2}
              onChange={(e) => {
                setPassword2(e.target.value)
                setFormError(null)
                if (errors.password2) setErrors((x) => ({ ...x, password2: undefined }))
              }}
              placeholder="Повтори пароль"
            />
          </div>
          {errors.password2 ? (
            <div className="auth-modal__hint auth-modal__hint--error">{errors.password2}</div>
          ) : null}
        </div>

        <div className="auth-modal__stack auth-modal__stack--tight" style={{ marginTop: 18 }}>
          <button type="submit" className="btn btn--primary" style={{ width: '100%' }} disabled={busy}>
            {busy ? 'Создание…' : 'Создать аккаунт'}
          </button>
        </div>

        {formError ? (
          <div className="auth-modal__hint auth-modal__hint--error" style={{ marginTop: 12 }}>
            {formError}
          </div>
        ) : null}
      </form>

      <p className="auth-modal__muted">
        Уже есть аккаунт?{' '}
        <button type="button" className="auth-modal__link" onClick={onSwitchLogin}>
          Войти
        </button>
      </p>
    </>
  )
}
