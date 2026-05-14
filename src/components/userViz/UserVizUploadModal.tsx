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