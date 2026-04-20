import { type ChangeEvent, useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { LayoutGrid, Rows3, Plus, Trash2, CheckSquare, X, Check } from 'lucide-react'
import { useUIStore } from '../store/uiStore'
import { useLibraryStore, type LibraryTrack } from '../store/libraryStore'
import { useAudioStore } from '../store/audioStore'
import { audioEngine } from '../audio/audioEngine'
import { loadTrack } from '../library/playback'
import TrackListItem from '../components/library/TrackListItem'
import TrackGridCard from '../components/library/TrackGridCard'
import EmptyLibrary from '../components/library/EmptyLibrary'
import { pluralTrack } from '../utils/plural'
import { useDropZone } from '../utils/useDropZone'
import { useAuthStore } from '../store/authStore'
import { trackNeedsLocalFile } from '../utils/trackCloud'
import {
  downloadCloudAudioToDevice,
  uploadLocalAudioToCloud,
} from '../services/cloudTrackAudio'

const ACCEPTED_EXT = ['.mp3', '.flac', '.wav']

function isAudioFile(file: File): boolean {
  if (file.type.startsWith('audio/')) return true
  const name = file.name.toLowerCase()
  return ACCEPTED_EXT.some((ext) => name.endsWith(ext))
}

export default function Library() {
  const tracks = useLibraryStore((s) => s.tracks)
  const currentTrackId = useLibraryStore((s) => s.currentTrackId)
  const addTrack = useLibraryStore((s) => s.addTrack)
  const removeTrack = useLibraryStore((s) => s.removeTrack)
  const setCurrentTrack = useLibraryStore((s) => s.setCurrentTrack)
  const clearAll = useLibraryStore((s) => s.clearAll)

  const isPlaying = useAudioStore((s) => s.isPlaying)
  const loggedIn = useAuthStore((s) => Boolean(s.token))
  const cloudAudioTrackIds = useAuthStore((s) => s.cloudAudioTrackIds)

  const view = useUIStore((s) => s.libraryView)
  const setView = useUIStore((s) => s.setLibraryView)
  const searchQuery = useUIStore((s) => s.searchQuery)

  const inputRef = useRef<HTMLInputElement>(null)
  const [uploadHint, setUploadHint] = useState<string | null>(null)
  const [cloudBusyId, setCloudBusyId] = useState<string | null>(null)
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function exitSelectMode() {
    setSelectMode(false)
    setSelectedIds(new Set())
  }

  function selectAllVisible() {
    setSelectedIds(new Set(filtered.map((t) => t.id)))
  }

  async function removeSelected() {
    if (selectedIds.size === 0) return
    const ok = confirm(`Удалить выбранные треки (${selectedIds.size})?`)
    if (!ok) return
    for (const id of selectedIds) {
      try {
        await removeTrack(id)
      } catch (err) {
        console.error('[library] не удалось удалить:', id, err)
      }
    }
    exitSelectMode()
  }

  async function clearLibrary() {
    const ok = confirm(`Очистить всю библиотеку? Удалится ${tracks.length} ${pluralTrack(tracks.length)}.`)
    if (!ok) return
    try {
      await clearAll()
      exitSelectMode()
      setUploadHint('Библиотека очищена')
    } catch (err) {
      console.error('[library] clearAll упал:', err)
      setUploadHint('Не удалось очистить библиотеку')
    }
  }

  useEffect(() => {
    if (!uploadHint) return
    const t = window.setTimeout(() => setUploadHint(null), 4500)
    return () => clearTimeout(t)
  }, [uploadHint])

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return tracks
    return tracks.filter(
      (t) => t.name.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q),
    )
  }, [tracks, searchQuery])

  async function ingest(files: File[]) {
    const audio = files.filter(isAudioFile)
    if (audio.length === 0) return
    for (const f of audio) {
      try {
        await addTrack(f)
      } catch (err) {
        console.error('[library] не удалось добавить:', f.name, err)
      }
    }
  }

  const { dragOver, bind: dropBind } = useDropZone((files) => void ingest(files))

  function onPick(e: ChangeEvent<HTMLInputElement>) {
    const list = Array.from(e.target.files ?? [])
    void ingest(list)
    e.target.value = ''
  }

  async function playTrack(track: LibraryTrack) {
    if (track.id === currentTrackId) {
      if (useAudioStore.getState().isPlaying) audioEngine.pause()
      else audioEngine.play()
      return
    }
    useAudioStore.getState().clearPlaylistQueue()
    await loadTrack(track)
    audioEngine.play()
    setCurrentTrack(track.id)
  }

  async function cloudDownload(trackId: string) {
    setCloudBusyId(trackId)
    try {
      await downloadCloudAudioToDevice(trackId)
      setUploadHint('Аудио скачано из облака')
    } catch (err) {
      setUploadHint(err instanceof Error ? err.message : String(err))
    } finally {
      setCloudBusyId(null)
    }
  }

  async function cloudUpload(trackId: string) {
    setCloudBusyId(trackId)
    try {
      await uploadLocalAudioToCloud(trackId)
      setUploadHint('Аудио прикреплено к облаку')
    } catch (err) {
      setUploadHint(err instanceof Error ? err.message : String(err))
    } finally {
      setCloudBusyId(null)
    }
  }

  const subtitle = tracks.length === 0
    ? 'Пока пусто'
    : `${tracks.length} ${pluralTrack(tracks.length)} загружено`

  return (
    <main
      className="mx-auto max-w-[1400px] px-8 pt-16 pb-32 relative z-[2]"
      {...dropBind}
    >
      <div className="flex items-start justify-between gap-8 mb-10">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--fg-mute)] mb-4">
            — Твои треки
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
              которую слушаешь.
            </span>
          </h1>
          <p className="text-base text-[var(--fg-soft)]">{subtitle}</p>
          {uploadHint ? (
            <p className="mt-3 text-sm max-w-xl" role="status" style={{ color: 'var(--fg-mute)' }}>
              {uploadHint}
            </p>
          ) : null}
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-end">
          {!selectMode ? (
            <>
              <ActionButton onClick={() => inputRef.current?.click()} icon={<Plus size={14} />}>
                Добавить
              </ActionButton>
              {tracks.length > 0 ? (
                <ActionButton onClick={() => setSelectMode(true)} icon={<CheckSquare size={14} />}>
                  Выбрать
                </ActionButton>
              ) : null}
              <ViewToggle view={view} onChange={setView} />
            </>
          ) : (
            <>
              <ActionButton onClick={selectAllVisible} icon={<Check size={14} />}>
                Выбрать все
              </ActionButton>
              <ActionButton
                onClick={() => void removeSelected()}
                icon={<Trash2 size={14} />}
                variant="danger"
                disabled={selectedIds.size === 0}
              >
                Удалить ({selectedIds.size})
              </ActionButton>
              <ActionButton onClick={() => void clearLibrary()} icon={<Trash2 size={14} />} variant="danger">
                Очистить
              </ActionButton>
              <ActionButton onClick={exitSelectMode} icon={<X size={14} />}>
                Отмена
              </ActionButton>
            </>
          )}
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="audio/*"
        multiple
        onChange={onPick}
        style={{ display: 'none' }}
      />

      {tracks.length === 0 ? (
        <EmptyLibrary onPick={() => inputRef.current?.click()} />
      ) : filtered.length === 0 ? (
        <div
          className="flex items-center justify-center"
          style={{ minHeight: 240, color: 'var(--fg-mute)', fontSize: 14 }}
        >
          Ничего не нашлось
        </div>
      ) : view === 'list' ? (
        <motion.div layout className="flex flex-col" style={{ gap: 4 }}>
          <AnimatePresence initial={false}>
            {filtered.map((t) => (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.2 }}
                style={{ position: 'relative' }}
              >
                {selectMode ? (
                  <SelectCheckbox
                    checked={selectedIds.has(t.id)}
                    onChange={() => toggleSelected(t.id)}
                    variant="list"
                  />
                ) : null}
                <TrackListItem
                  track={t}
                  isActive={t.id === currentTrackId}
                  isPlaying={isPlaying && t.id === currentTrackId}
                  onPlay={() => (selectMode ? toggleSelected(t.id) : void playTrack(t))}
                  onRemove={() => removeTrack(t.id)}
                  needsLocalFile={trackNeedsLocalFile(t)}
                  hasCloudAudio={cloudAudioTrackIds.includes(t.id)}
                  cloudBusy={cloudBusyId === t.id}
                  onCloudDownload={
                    loggedIn && trackNeedsLocalFile(t) && cloudAudioTrackIds.includes(t.id)
                      ? () => void cloudDownload(t.id)
                      : undefined
                  }
                  onCloudUpload={
                    loggedIn && !trackNeedsLocalFile(t) && !cloudAudioTrackIds.includes(t.id)
                      ? () => void cloudUpload(t.id)
                      : undefined
                  }
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      ) : (
        <motion.div
          layout
          className="grid gap-4"
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}
        >
          <AnimatePresence initial={false} mode="popLayout">
            {filtered.map((t) => (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.92 }}
                transition={{ duration: 0.25 }}
                style={{ position: 'relative' }}
              >
                {selectMode ? (
                  <SelectCheckbox
                    checked={selectedIds.has(t.id)}
                    onChange={() => toggleSelected(t.id)}
                    variant="grid"
                  />
                ) : null}
                <TrackGridCard
                  track={t}
                  isActive={t.id === currentTrackId}
                  isPlaying={isPlaying && t.id === currentTrackId}
                  onPlay={() => (selectMode ? toggleSelected(t.id) : void playTrack(t))}
                  onRemove={() => removeTrack(t.id)}
                  needsLocalFile={trackNeedsLocalFile(t)}
                  hasCloudAudio={cloudAudioTrackIds.includes(t.id)}
                  cloudBusy={cloudBusyId === t.id}
                  onCloudDownload={
                    loggedIn && trackNeedsLocalFile(t) && cloudAudioTrackIds.includes(t.id)
                      ? () => void cloudDownload(t.id)
                      : undefined
                  }
                  onCloudUpload={
                    loggedIn && !trackNeedsLocalFile(t) && !cloudAudioTrackIds.includes(t.id)
                      ? () => void cloudUpload(t.id)
                      : undefined
                  }
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      <AnimatePresence>
        {dragOver ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[40] flex items-center justify-center pointer-events-none"
            style={{
              background: 'color-mix(in srgb, var(--bg) 85%, transparent)',
              backdropFilter: 'blur(4px)',
            }}
          >
            <div
              style={{
                padding: '40px 64px',
                borderRadius: 20,
                border: '2px dashed var(--border-active)',
                color: 'var(--fg)',
                fontSize: 18,
                fontWeight: 600,
                letterSpacing: '-0.01em',
                background: 'var(--bg-soft)',
              }}
            >
              Перетащи MP3 сюда
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </main>
  )
}

interface ViewToggleProps {
  view: 'list' | 'grid'
  onChange: (v: 'list' | 'grid') => void
}

function ViewToggle({ view, onChange }: ViewToggleProps) {
  return (
    <div
      className="inline-flex items-center"
      style={{
        background: 'var(--bg-soft)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        padding: 3,
        gap: 2,
      }}
    >
      <Btn active={view === 'list'} onClick={() => onChange('list')} title="Список">
        <Rows3 size={14} />
      </Btn>
      <Btn active={view === 'grid'} onClick={() => onChange('grid')} title="Сетка">
        <LayoutGrid size={14} />
      </Btn>
    </div>
  )
}

function Btn({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean
  onClick: () => void
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      style={{
        width: 30,
        height: 28,
        borderRadius: 7,
        border: 'none',
        background: active ? 'var(--bg-elev)' : 'transparent',
        color: active ? 'var(--fg)' : 'var(--fg-mute)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        transition: 'background 0.15s, color 0.15s',
      }}
    >
      {children}
    </button>
  )
}

interface ActionButtonProps {
  onClick: () => void
  icon: React.ReactNode
  children: React.ReactNode
  variant?: 'default' | 'danger'
  disabled?: boolean
}

function ActionButton({ onClick, icon, children, variant = 'default', disabled }: ActionButtonProps) {
  const danger = variant === 'danger'
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '8px 14px',
        borderRadius: 8,
        border: `1px solid ${danger ? 'rgba(239, 68, 68, 0.35)' : 'var(--border)'}`,
        background: danger ? 'rgba(239, 68, 68, 0.08)' : 'var(--bg-soft)',
        color: danger ? 'rgb(239, 68, 68)' : 'var(--fg)',
        fontSize: 13,
        fontWeight: 500,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        fontFamily: 'inherit',
        transition: 'background 0.15s, border-color 0.15s, opacity 0.15s',
      }}
    >
      {icon}
      {children}
    </button>
  )
}

interface SelectCheckboxProps {
  checked: boolean
  onChange: () => void
  variant: 'list' | 'grid'
}

function SelectCheckbox({ checked, onChange, variant }: SelectCheckboxProps) {
  const isGrid = variant === 'grid'
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onChange()
      }}
      aria-label={checked ? 'Снять выбор' : 'Выбрать'}
      style={{
        position: 'absolute',
        top: isGrid ? 8 : '50%',
        left: isGrid ? 8 : 8,
        transform: isGrid ? 'none' : 'translateY(-50%)',
        width: 24,
        height: 24,
        borderRadius: 6,
        border: `2px solid ${checked ? 'var(--fg)' : 'var(--border-strong)'}`,
        background: checked ? 'var(--fg)' : 'rgba(0, 0, 0, 0.4)',
        color: checked ? 'var(--bg)' : 'transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        zIndex: 5,
        backdropFilter: 'blur(4px)',
        transition: 'background 0.15s, border-color 0.15s',
      }}
    >
      {checked ? <Check size={14} strokeWidth={3} /> : null}
    </button>
  )
}
