import { useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface ProfileAccountEditProps {
  onBack: () => void
}

export default function ProfileAccountEdit({ onBack }: ProfileAccountEditProps) {
  const user = useAuthStore((s) => s.user)
  const updateEmail = useAuthStore((s) => s.updateEmail)
  const updatePassword = useAuthStore((s) => s.updatePassword)

  const [newEmail, setNewEmail] = useState('')
  const [emailPassword, setEmailPassword] = useState('')
  const [emailBusy, setEmailBusy] = useState(false)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [emailOk, setEmailOk] = useState<string | null>(null)

  const [newPassword, setNewPassword] = useState('')
  const [newPassword2, setNewPassword2] = useState('')
  const [passPassword, setPassPassword] = useState('')
  const [passBusy, setPassBusy] = useState(false)
  const [passError, setPassError] = useState<string | null>(null)
  const [passOk, setPassOk] = useState<string | null>(null)

  async function submitEmail(e: React.FormEvent) {
    e.preventDefault()
    setEmailError(null)
    setEmailOk(null)
    const em = newEmail.trim().toLowerCase()
    if (!em) {
      setEmailError('Введите новый email')
      return
    }
    if (!EMAIL_RE.test(em)) {
      setEmailError('Некорректный email')
      return
    }
    if (em === user?.email.toLowerCase()) {
      setEmailError('Это уже ваш текущий email')
      return
    }
    if (!emailPassword) {
      setEmailError('Введите текущий пароль')
      return
    }
    setEmailBusy(true)
    try {
      await updateEmail(emailPassword, em)
      setEmailOk('Email обновлён')
      setNewEmail('')
      setEmailPassword('')
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : String(err))
    } finally {
      setEmailBusy(false)
    }
  }

  async function submitPassword(e: React.FormEvent) {
    e.preventDefault()
    setPassError(null)
    setPassOk(null)
    if (!passPassword) {
      setPassError('Введите текущий пароль')
      return
    }
    if (!newPassword) {
      setPassError('Введите новый пароль')
      return
    }
    if (newPassword.length < 8) {
      setPassError('Новый пароль — минимум 8 символов')
      return
    }
    if (newPassword !== newPassword2) {
      setPassError('Пароли не совпадают')
      return
    }
    if (passPassword === newPassword) {
      setPassError('Новый пароль должен отличаться от текущего')
      return
    }
    setPassBusy(true)
    try {
      await updatePassword(passPassword, newPassword)
      setPassOk('Пароль изменён')
      setNewPassword('')
      setNewPassword2('')
      setPassPassword('')
    } catch (err) {
      setPassError(err instanceof Error ? err.message : String(err))
    } finally {
      setPassBusy(false)
    }
  }

  return (
    <>
      <div className="auth-modal__header-row">
        <button type="button" className="auth-modal__back" onClick={onBack} aria-label="Назад">
          <ArrowLeft size={16} strokeWidth={2} />
        </button>
        <h2 id="profile-modal-title" className="auth-modal__title">
          Аккаунт
        </h2>
      </div>
      <p className="auth-modal__lead" style={{ marginTop: 0 }}>
        Текущий email: <strong style={{ color: 'var(--fg)' }}>{user?.email}</strong>
      </p>

      <form onSubmit={submitEmail} noValidate style={{ marginBottom: 20 }}>
        <p className="auth-modal__label" style={{ marginBottom: 8 }}>
          Сменить email
        </p>
        <div className="auth-modal__field">
          <label className="auth-modal__label" htmlFor="profile-edit-email">
            Новый email
          </label>
          <div className="auth-modal__input-shell">
            <input
              id="profile-edit-email"
              className="auth-modal__input"
              type="email"
              autoComplete="email"
              value={newEmail}
              onChange={(e) => {
                setNewEmail(e.target.value)
                setEmailError(null)
                setEmailOk(null)
              }}
              placeholder="new@example.com"
            />
          </div>
        </div>
        <div className="auth-modal__field">
          <label className="auth-modal__label" htmlFor="profile-edit-email-pass">
            Текущий пароль
          </label>
          <div className="auth-modal__input-shell">
            <input
              id="profile-edit-email-pass"
              className="auth-modal__input"
              type="password"
              autoComplete="current-password"
              value={emailPassword}
              onChange={(e) => {
                setEmailPassword(e.target.value)
                setEmailError(null)
                setEmailOk(null)
              }}
              placeholder="••••••••"
            />
          </div>
        </div>
        <button
          type="submit"
          className="btn btn--ghost"
          style={{ width: '100%' }}
          disabled={emailBusy}
        >
          {emailBusy ? 'Сохранение…' : 'Сохранить email'}
        </button>
        {emailOk ? (
          <div className="auth-modal__hint" style={{ marginTop: 8, color: 'var(--premium)' }}>
            {emailOk}
          </div>
        ) : null}
        {emailError ? (
          <div className="auth-modal__hint auth-modal__hint--error" style={{ marginTop: 8 }}>
            {emailError}
          </div>
        ) : null}
      </form>

      <form onSubmit={submitPassword} noValidate>
        <p className="auth-modal__label" style={{ marginBottom: 8 }}>
          Сменить пароль
        </p>
        <div className="auth-modal__field">
          <label className="auth-modal__label" htmlFor="profile-edit-pass-new">
            Новый пароль
          </label>
          <div className="auth-modal__input-shell">
            <input
              id="profile-edit-pass-new"
              className="auth-modal__input"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => {
                setNewPassword(e.target.value)
                setPassError(null)
                setPassOk(null)
              }}
              placeholder="Минимум 8 символов"
            />
          </div>
        </div>
        <div className="auth-modal__field">
          <label className="auth-modal__label" htmlFor="profile-edit-pass-new2">
            Повторите пароль
          </label>
          <div className="auth-modal__input-shell">
            <input
              id="profile-edit-pass-new2"
              className="auth-modal__input"
              type="password"
              autoComplete="new-password"
              value={newPassword2}
              onChange={(e) => {
                setNewPassword2(e.target.value)
                setPassError(null)
                setPassOk(null)
              }}
              placeholder="Повторите пароль"
            />
          </div>
        </div>
        <div className="auth-modal__field">
          <label className="auth-modal__label" htmlFor="profile-edit-pass-current">
            Текущий пароль
          </label>
          <div className="auth-modal__input-shell">
            <input
              id="profile-edit-pass-current"
              className="auth-modal__input"
              type="password"
              autoComplete="current-password"
              value={passPassword}
              onChange={(e) => {
                setPassPassword(e.target.value)
                setPassError(null)
                setPassOk(null)
              }}
              placeholder="••••••••"
            />
          </div>
        </div>
        <button
          type="submit"
          className="btn btn--ghost"
          style={{ width: '100%' }}
          disabled={passBusy}
        >
          {passBusy ? 'Сохранение…' : 'Сменить пароль'}
        </button>
        {passOk ? (
          <div className="auth-modal__hint" style={{ marginTop: 8, color: 'var(--premium)' }}>
            {passOk}
          </div>
        ) : null}
        {passError ? (
          <div className="auth-modal__hint auth-modal__hint--error" style={{ marginTop: 8 }}>
            {passError}
          </div>
        ) : null}
      </form>
    </>
  )
}
