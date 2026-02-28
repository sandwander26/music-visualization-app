import { useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import * as cloudApi from '../../services/cloudApi'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type Step = 'request' | 'reset'

interface ProfileForgotPasswordProps {
  onBack: () => void
  onDone: () => void
}

export default function ProfileForgotPassword({ onBack, onDone }: ProfileForgotPasswordProps) {
  const [step, setStep] = useState<Step>('request')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newPassword2, setNewPassword2] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [devCode, setDevCode] = useState<string | null>(null)

  async function submitRequest(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setDevCode(null)
    const em = email.trim().toLowerCase()
    if (!em) {
      setError('Введите email')
      return
    }
    if (!EMAIL_RE.test(em)) {
      setError('Некорректный email')
      return
    }
    setBusy(true)
    try {
      const res = await cloudApi.requestPasswordReset(em)
      setInfo(res.message)
      if (res.devResetCode) {
        setDevCode(res.devResetCode)
      }
      setStep('reset')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function submitReset(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const em = email.trim().toLowerCase()
    const tok = code.trim()
    if (!tok) {
      setError('Введите код из письма')
      return
    }
    if (!newPassword) {
      setError('Введите новый пароль')
      return
    }
    if (newPassword.length < 8) {
      setError('Пароль — минимум 8 символов')
      return
    }
    if (newPassword !== newPassword2) {
      setError('Пароли не совпадают')
      return
    }
    setBusy(true)
    try {
      const res = await cloudApi.resetPasswordWithToken(em, tok, newPassword)
      setInfo(res.message)
      setTimeout(() => onDone(), 1200)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  if (step === 'request') {
    return (
      <>
        <div className="auth-modal__header-row">
          <button type="button" className="auth-modal__back" onClick={onBack} aria-label="Назад">
            <ArrowLeft size={16} strokeWidth={2} />
          </button>
          <h2 id="profile-modal-title" className="auth-modal__title">
            Сброс пароля
          </h2>
        </div>
        <p className="auth-modal__lead">
          Укажи email аккаунта — пришлём код для нового пароля (действует 1 час).
        </p>

        <form onSubmit={submitRequest} noValidate>
          <div className="auth-modal__field">
            <label className="auth-modal__label" htmlFor="profile-forgot-email">
              Email
            </label>
            <div className="auth-modal__input-shell">
              <input
                id="profile-forgot-email"
                className="auth-modal__input"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  setError(null)
                }}
                placeholder="you@example.com"
              />
            </div>
          </div>

          <div className="auth-modal__stack auth-modal__stack--tight" style={{ marginTop: 18 }}>
            <button type="submit" className="btn btn--primary" style={{ width: '100%' }} disabled={busy}>
              {busy ? 'Отправка…' : 'Отправить код'}
            </button>
          </div>

          {error ? (
            <div className="auth-modal__hint auth-modal__hint--error" style={{ marginTop: 12 }}>
              {error}
            </div>
          ) : null}
        </form>
      </>
    )
  }

  return (
    <>
      <div className="auth-modal__header-row">
        <button
          type="button"
          className="auth-modal__back"
          onClick={() => {
            setStep('request')
            setError(null)
          }}
          aria-label="Назад"
        >
          <ArrowLeft size={16} strokeWidth={2} />
        </button>
        <h2 id="profile-modal-title" className="auth-modal__title">
          Новый пароль
        </h2>
      </div>
      <p className="auth-modal__lead" style={{ marginTop: 0 }}>
        {info ?? 'Введите код из письма и новый пароль.'}
      </p>