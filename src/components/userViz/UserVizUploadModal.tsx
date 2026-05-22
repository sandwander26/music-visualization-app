import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { X, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { MOOD_ORDER, MOOD_LABELS, type MoodId } from '../../audio/moodEngine'
import { compileUserViz } from '../../userViz/compiler'
import { useUserVizStore, type AddVisualizerStage } from '../../userViz/userVizStore'
import Modal from '../Modal'

interface UserVizUploadModalProps {
  file: File
  onClose: () => void
  onUploaded: (vizId: string) => void
}

type CompileState =
  | { kind: 'pending' }
  | { kind: 'ok' }
  | { kind: 'error'; message: string }

const MONO_LABEL: CSSProperties = {
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: 10,
  letterSpacing: '0.16em',
  textTransform: 'uppercase',
  color: 'var(--fg-mute)',
}

const BANNER_BASE: CSSProperties = {
  padding: '10px 12px',
  borderRadius: 8,
  fontSize: 12,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
}

const ERROR_TINT = {
  background: 'rgba(239, 68, 68, 0.12)',
  border: '1px solid rgba(239, 68, 68, 0.35)',
  color: 'rgb(252, 165, 165)',
}

function fileNameWithoutExt(name: string): string {
  return name.replace(/\.[^/.]+$/, '')
}

export default function UserVizUploadModal({ file, onClose, onUploaded }: UserVizUploadModalProps) {
  const [name, setName] = useState(() => fileNameWithoutExt(file.name))
  const [moods, setMoods] = useState<Set<MoodId>>(new Set())
  const [compile, setCompile] = useState<CompileState>({ kind: 'pending' })
  const [submitting, setSubmitting] = useState(false)
  const [submitStage, setSubmitStage] = useState<AddVisualizerStage | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const addVisualizer = useUserVizStore((s) => s.addVisualizer)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const result = compileUserViz(await file.text())
        if (cancelled) return
        if (result.component) setCompile({ kind: 'ok' })
        else setCompile({ kind: 'error', message: result.error ?? 'Неизвестная ошибка' })
      } catch (err) {
        if (cancelled) return
        setCompile({ kind: 'error', message: err instanceof Error ? err.message : String(err) })
      }
    })()
    return () => { cancelled = true }
  }, [file])

  function toggleMood(mood: MoodId) {
    setMoods((prev) => {
      const next = new Set(prev)
      if (next.has(mood)) next.delete(mood)
      else next.add(mood)
      return next
    })
  }

  const canSubmit = useMemo(
    () => compile.kind === 'ok' && name.trim().length > 0 && moods.size > 0 && !submitting,
    [compile, name, moods, submitting],
  )

  async function handleSubmit() {
    if (!canSubmit) return
    setSubmitting(true)
    setSubmitStage(null)
    setSubmitError(null)
    try {
      const runtime = await addVisualizer(file, name, Array.from(moods), setSubmitStage)
      onUploaded(runtime.id)
      onClose()
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : String(err))
      setSubmitStage(null)
      setSubmitting(false)
    }
  }

  function submitLabel(): string {
    if (!submitting) return 'Загрузить'
    if (submitStage === 'preview') return 'Создаю превью...'
    if (submitStage === 'save') return 'Сохраняю...'
    if (submitStage === 'manifest') return 'Финализирую...'
    return 'Загрузка...'
  }

  return (
    <Modal onClose={onClose} zIndex={80} cardStyle={{ maxWidth: 560, maxHeight: '86vh' }}>
        <div
          style={{
            padding: '20px 24px 16px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ ...MONO_LABEL, marginBottom: 4 }}>Новый визуализатор</div>
            <div
              className="truncate"
              style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--fg)' }}
            >
              {file.name}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--bg-soft)',
              color: 'var(--fg-mute)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <X size={14} />
          </button>
        </div>

        <div
          style={{
            padding: '20px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
            overflowY: 'auto',
          }}
        >
          <CompileStatusBanner state={compile} />

          <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={MONO_LABEL}>Название</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              style={{
                padding: '10px 12px',
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'var(--bg-soft)',
                color: 'var(--fg)',
                fontSize: 14,
                fontFamily: 'inherit',
                outline: 'none',
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--border-active)' }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)' }}
            />
          </label>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span style={MONO_LABEL}>Настроения · хотя бы одно</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {MOOD_ORDER.map((m) => {
                const checked = moods.has(m)
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => toggleMood(m)}
                    className="t-button"
                    style={{
                      padding: '8px 12px',
                      borderRadius: 999,
                      border: `1px solid ${checked ? 'var(--border-active)' : 'var(--border)'}`,
                      background: checked ? 'var(--bg-elev)' : 'var(--bg-soft)',
                      color: checked ? 'var(--fg)' : 'var(--fg-soft)',
                      fontSize: 12,
                      fontWeight: 500,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    {MOOD_LABELS[m]}
                  </button>
                )
              })}
            </div>
          </div>

          {submitError ? (
            <div style={{ ...BANNER_BASE, ...ERROR_TINT }}>{submitError}</div>
          ) : null}
        </div>

        <div
          style={{
            padding: '14px 24px 18px',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '9px 16px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'transparent',
              color: 'var(--fg-soft)',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={!canSubmit}
            className="t-bg-color"
            style={{
              padding: '9px 18px',
              borderRadius: 8,
              border: 'none',
              background: canSubmit ? 'var(--fg)' : 'var(--bg-elev)',
              color: canSubmit ? 'var(--bg)' : 'var(--fg-mute)',
              fontSize: 13,
              fontWeight: 600,
              cursor: canSubmit ? 'pointer' : 'not-allowed',
              fontFamily: 'inherit',
            }}
          >
            {submitLabel()}
          </button>
        </div>

    </Modal>
  )
}

function Banner({ tint, icon, children, alignTop = false }: { tint: CSSProperties; icon: ReactNode; children: ReactNode; alignTop?: boolean }) {
  return (
    <div style={{ ...BANNER_BASE, ...tint, alignItems: alignTop ? 'flex-start' : 'center' }}>
      {icon}
      {children}
    </div>
  )
}

function CompileStatusBanner({ state }: { state: CompileState }) {
  if (state.kind === 'pending') {
    return (
      <Banner
        tint={{ background: 'var(--bg-soft)', border: '1px solid var(--border)', color: 'var(--fg-mute)' }}
        icon={<Loader2 size={14} style={{ animation: 'uvSpin 0.9s linear infinite' }} />}
      >
        Компилирую...
        <style>{`@keyframes uvSpin { to { transform: rotate(360deg) } }`}</style>
      </Banner>
    )
  }
  if (state.kind === 'ok') {
    return (
      <Banner
        tint={{ background: 'rgba(34, 197, 94, 0.12)', border: '1px solid rgba(34, 197, 94, 0.35)', color: 'rgb(134, 239, 172)' }}
        icon={<CheckCircle2 size={14} />}
      >
        Код скомпилирован
      </Banner>
    )
  }
  return (
    <Banner
      tint={ERROR_TINT}
      icon={<AlertCircle size={14} style={{ marginTop: 1, flexShrink: 0 }} />}
      alignTop
    >
      <div style={{ wordBreak: 'break-word', fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>
        {state.message}
      </div>
    </Banner>
  )
}
