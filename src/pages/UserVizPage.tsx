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