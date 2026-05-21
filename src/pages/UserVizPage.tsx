import { type ChangeEvent, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, Download, BookOpen, X, FileCode2 } from 'lucide-react'
import { MOOD_LABELS, type MoodId } from '../audio/moodEngine'
import { useUserVizStore } from '../userViz/userVizStore'
import { useUIStore } from '../store/uiStore'
import { useAudioStore } from '../store/audioStore'
import { downloadTemplate } from '../userViz/templates'
import UserVizUploadModal from '../components/userViz/UserVizUploadModal'
import UserVizDocsModal from '../components/userViz/UserVizDocsModal'
import PreviewImage from '../components/gallery/PreviewImage'
import VisualizerHost from '../components/player/VisualizerHost'
import { useDropZone } from '../utils/useDropZone'

function isTsxFile(file: File): boolean {
  return file.name.toLowerCase().endsWith('.tsx') || file.name.toLowerCase().endsWith('.ts')
}

export default function UserVizPage() {
  const visualizers = useUserVizStore((s) => s.visualizers)
  const removeVisualizer = useUserVizStore((s) => s.removeVisualizer)

  const setSelectedVizId = useUIStore((s) => s.setSelectedVizId)
  const openOverlay = useUIStore((s) => s.openOverlay)
  const searchQuery = useUIStore((s) => s.searchQuery)

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return visualizers
    return visualizers.filter((v) => v.name.toLowerCase().includes(q))
  }, [visualizers, searchQuery])

  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [docsOpen, setDocsOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFile(file: File) {
    if (!isTsxFile(file)) {
      alert('Поддерживаются только .tsx файлы')
      return
    }
    setPendingFile(file)
  }

  function onPick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = ''
  }

  const { dragOver, bind: dropBind } = useDropZone((files) => {
    const file = files.find(isTsxFile)
    if (file) handleFile(file)
  })

  function openUserViz(id: string) {
    useAudioStore.getState().clearPlaylistQueue()
    setSelectedVizId(id)
    openOverlay(id)
  }

  function handleDelete(id: string, name: string) {
    const ok = confirm(`Удалить визуализатор "${name}"?`)
    if (!ok) return
    void removeVisualizer(id)
  }

  function handleDownloadTemplate() {
    downloadTemplate()
  }

  return (
    <main className="mx-auto max-w-[1400px] px-8 pt-16 pb-32 relative z-[2]">
      <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--fg-mute)] mb-4">
        — Твои творения
      </div>
      <h1 className="text-5xl sm:text-6xl font-semibold tracking-[-0.035em] leading-[1.02] mb-4">
        Музыка,{' '}
        <span
          className="font-normal italic"
          style={{
            fontFamily: "'Instrument Serif', serif",
            backgroundImage: 'linear-gradient(180deg, var(--fg) 0%, var(--fg-mute) 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          которую представляешь.
        </span>
      </h1>
      <p className="text-base text-[var(--fg-soft)] mb-10 max-w-2xl">
        Загрузи .tsx файл — он появится в галерее и в подборках по настроению.
      </p>

      <div style={{ display: 'flex', gap: 12, marginBottom: 32, flexWrap: 'wrap' }}>
        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click()
          }}
          {...dropBind}
          style={{
            flex: 1,
            minWidth: 320,
            minHeight: 160,
            padding: 24,
            borderRadius: 14,
            border: `2px dashed ${dragOver ? 'var(--border-active)' : 'var(--border-strong)'}`,
            background: dragOver ? 'var(--bg-elev)' : 'var(--bg-soft)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            cursor: 'pointer',
            transition: 'background 0.15s, border-color 0.15s',
            outline: 'none',
          }}
        >
          <Upload size={22} style={{ color: 'var(--fg-mute)' }} />
          <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--fg)' }}>
            Перетащи .tsx сюда
          </div>
          <div style={{ fontSize: 12, color: 'var(--fg-mute)' }}>
            или нажми, чтобы выбрать
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".tsx,.ts"
            onChange={onPick}
            style={{ display: 'none' }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 240 }}>
          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="hov-border t-bg-border"
            style={{
              width: '100%',
              padding: '14px 16px',
              borderRadius: 12,
              border: '1px solid var(--border)',
              background: 'var(--bg-soft)',
              color: 'var(--fg)',
              fontSize: 13,
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            <Download size={14} />
            <span>Скачать шаблон</span>
          </button>

          <button
            type="button"
            onClick={() => setDocsOpen(true)}
            className="hov-icon-btn t-color-border"
            style={{
              width: '100%',
              padding: '14px 16px',
              borderRadius: 12,
              border: '1px solid var(--border)',
              background: 'transparent',
              color: 'var(--fg-soft)',
              fontSize: 13,
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            <BookOpen size={14} />
            <span>Как написать</span>
          </button>
        </div>
      </div>

      {visualizers.length === 0 ? (
        <div
          style={{
            minHeight: 240,
            border: '1px dashed var(--border)',
            borderRadius: 14,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--fg-mute)',
            fontSize: 14,
            textAlign: 'center',
            padding: 24,
          }}
        >
          Пока ничего нет. Начни с шаблона.
        </div>
      ) : filtered.length === 0 ? (
        <div
          style={{
            minHeight: 120,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--fg-mute)',
            fontSize: 14,
          }}
        >
          Ничего не найдено.
        </div>
      ) : (
        <div
          className="grid"
          style={{
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: 16,
          }}
        >
          {filtered.map((v) => (
            <UserVizCard
              key={v.id}
              vizId={v.id}
              name={v.name}
              moods={v.moods}
              error={v.error}
              hasComponent={v.component !== null}
              onOpen={() => openUserViz(v.id)}
              onDelete={() => handleDelete(v.id, v.name)}
            />
          ))}
        </div>
      )}

      {pendingFile ? (
        <UserVizUploadModal
          file={pendingFile}
          onClose={() => setPendingFile(null)}
          onUploaded={() => setPendingFile(null)}
        />
      ) : null}

      {docsOpen ? <UserVizDocsModal onClose={() => setDocsOpen(false)} /> : null}
    </main>
  )
}

interface UserVizCardProps {
  vizId: string
  name: string
  moods: MoodId[]
  error: string | null
  hasComponent: boolean
  onOpen: () => void
  onDelete: () => void
}

function UserVizCard({ vizId, name, moods, error, hasComponent, onOpen, onDelete }: UserVizCardProps) {
  const [hover, setHover] = useState(false)
  const broken = error !== null
  const canLivePreview = !broken && hasComponent

  return (
    <div
      style={{ position: 'relative' }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <button
        type="button"
        onClick={onOpen}
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '4 / 3',
          minHeight: 180,
          borderRadius: 14,
          border: `1px solid ${hover ? 'var(--border-active)' : 'var(--border)'}`,
          background: broken
            ? 'linear-gradient(135deg, rgba(239,68,68,0.15), rgba(0,0,0,0.4))'
            : 'var(--bg-soft)',
          overflow: 'hidden',
          padding: 0,
          display: 'block',
          textAlign: 'left',
          cursor: 'pointer',
          fontFamily: 'inherit',
          transition: 'border-color 0.15s, transform 0.15s',
          transform: hover ? 'translateY(-2px)' : 'translateY(0)',
        }}
      >
        <motion.div
          className="absolute inset-0"
          animate={{
            scale: hover && canLivePreview ? 1.05 : 1,
            opacity: hover && canLivePreview ? 0 : 1,
          }}
          transition={{
            scale: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
            opacity: { duration: 0.15 },
          }}
        >
          <PreviewImage vizId={vizId} name={name} />
        </motion.div>

        <AnimatePresence>
          {hover && canLivePreview ? (
            <motion.div
              key="live"
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <VisualizerHost vizId={vizId} />
            </motion.div>
          ) : null}
        </AnimatePresence>

        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'var(--card-overlay)' }}
        />

        <div
          style={{
            position: 'absolute',
            top: 12,
            left: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 8px',
            borderRadius: 6,
            background: 'var(--bg-elev)',
            border: '1px solid var(--border-strong)',
            backdropFilter: 'blur(8px)',
          }}
        >
          <FileCode2 size={11} style={{ color: 'var(--fg-mute)', flexShrink: 0 }} />
          <div
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 9,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              fontWeight: 500,
              color: 'var(--fg)',
            }}
          >
            Свой
          </div>
        </div>

        <div
          className="absolute inset-x-0 bottom-0"
          style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}
        >
          <div
            className="truncate"
            style={{
              fontSize: 17,
              fontWeight: 600,
              letterSpacing: '-0.015em',
              color: 'var(--fg)',
            }}
          >
            {name}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {moods.map((m) => (
              <span
                key={m}
                style={{
                  padding: '3px 8px',
                  borderRadius: 999,
                  fontSize: 10,
                  fontFamily: 'inherit',
                  background: 'rgba(0,0,0,0.45)',
                  border: '1px solid var(--border)',
                  color: 'var(--fg-soft)',
                  backdropFilter: 'blur(8px)',
                }}
              >
                {MOOD_LABELS[m]}
              </span>
            ))}
          </div>
          {broken ? (
            <div
              className="truncate"
              style={{
                fontSize: 11,
                color: 'rgb(252,165,165)',
                fontFamily: "'JetBrains Mono', monospace",
              }}
              title={error ?? ''}
            >
              ошибка компиляции
            </div>
          ) : null}
        </div>
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onDelete()
        }}
        aria-label="Удалить"
        className="hov-danger"
        style={{
          position: 'absolute',
          top: 10,
          right: 10,
          width: 26,
          height: 26,
          borderRadius: 8,
          border: '1px solid var(--border)',
          background: 'var(--bg-soft)',
          color: 'var(--fg-mute)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          opacity: hover ? 1 : 0,
          transition: 'opacity 0.15s, color 0.15s',
          zIndex: 2,
        }}
      >
        <X size={13} />
      </button>
    </div>
  )
}
