import { type ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Check, X } from 'lucide-react'
import { audioEngine } from '../../audio/audioEngine'
import {
  applyManualMetaAndSearchLyrics,
  autoLyricsResultHint,
  fetchRankedLyricsCandidatesForTrack,
  tryAutoAttachLyricsFromCatalog,
} from '../../audio/autoLyrics'
import { useAudioStore } from '../../store/audioStore'
import { useUIStore } from '../../store/uiStore'
import {
  catalogLabelsFromCandidate,
  type RankedLrclibCandidate,
} from '../../services/lrclibClient'
import { parseArtistTitleFromFilename } from '../../utils/filenameMeta'
import { clearLyricsDiskCache } from '../../services/lyricsDiskCache'

const LYRICS_SUCCESS_MS = 3500
const LYRICS_SUCCESS_TEXT = 'текст успешно загружен'

function LyricsSuccessBanner({ text }: { text: string }) {
  return (
    <div
      role="status"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        marginBottom: 10,
        padding: '7px 10px',
        borderRadius: 8,
        border: '1px solid rgba(74, 222, 128, 0.35)',
        background: 'rgba(74, 222, 128, 0.1)',
        color: '#bbf7d0',
        fontSize: 11,
        lineHeight: 1.35,
      }}
    >
      <Check size={11} style={{ color: '#4ade80', flexShrink: 0 }} aria-hidden />
      <span>{text}</span>
    </div>
  )
}

function formatDurationSec(sec: number | undefined): string {
  if (sec == null || !Number.isFinite(sec)) return '—'
  const m = Math.floor(sec / 60)
  const s = Math.round(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

function formatDeltaSec(delta: number | null): string {
  if (delta == null) return 'длительность неизвестна'
  if (delta === 0) return 'совпадает с треком'
  return `расхождение ${delta} с`
}

export default function LyricsSearchModal() {
  const isOpen = useUIStore((s) => s.lyricsSearchOpen)
  const setLyricsSearchOpen = useUIStore((s) => s.setLyricsSearchOpen)
  const setLyricsNotice = useUIStore((s) => s.setLyricsNotice)

  const trackTitle = useAudioStore((s) => s.trackInfo.title)
  const trackArtist = useAudioStore((s) => s.trackInfo.artist)
  const trackAlbum = useAudioStore((s) => s.trackInfo.album)
  const sourceFileName = useAudioStore((s) => s.sourceFileName)
  const lrcLines = useAudioStore((s) => s.lrcLines)
  const preparing = useAudioStore((s) => s.trackPrepareBusy)

  const [lyricsHint, setLyricsHint] = useState('')
  const [successBanner, setSuccessBanner] = useState('')
  const [lrclibBusy, setLrclibBusy] = useState(false)
  const [lrPickerOpen, setLrPickerOpen] = useState(false)
  const [lrCandidates, setLrCandidates] = useState<RankedLrclibCandidate[]>([])
  const [editArtist, setEditArtist] = useState('')
  const [editTitle, setEditTitle] = useState('')
  const [editAlbum, setEditAlbum] = useState('')
  const [manualMetaDirty, setManualMetaDirty] = useState(false)
  const lrclibBusyRef = useRef(false)
  const lrcPickRef = useRef<HTMLInputElement>(null)
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const trackDurationSec = audioEngine.getDuration()
  const hasTrackMeta = trackTitle.trim().length > 0
  const canSearch = Boolean(sourceFileName) && hasTrackMeta && !preparing && !lrclibBusy

  const parsedFromFile = useMemo(
    () => (sourceFileName ? parseArtistTitleFromFilename(sourceFileName) : null),
    [sourceFileName],
  )

  useEffect(() => {
    if (!isOpen) return
    setEditArtist(trackArtist.trim())
    setEditTitle(trackTitle.trim())
    setEditAlbum(trackAlbum.trim())
    setManualMetaDirty(false)
    setLyricsHint('')
    setSuccessBanner('')
    setLrPickerOpen(false)
    setLrCandidates([])
  }, [isOpen, sourceFileName, trackArtist, trackTitle, trackAlbum])

  useEffect(() => {
    return () => {
      if (successTimerRef.current != null) {
        clearTimeout(successTimerRef.current)
        successTimerRef.current = null
      }
    }
  }, [])

  const showLyricsSuccess = useCallback(
    (closeModal = false) => {
      setSuccessBanner(LYRICS_SUCCESS_TEXT)
      setLyricsHint('')
      setLyricsNotice({ kind: 'success', text: LYRICS_SUCCESS_TEXT })

      if (successTimerRef.current != null) {
        clearTimeout(successTimerRef.current)
      }
      successTimerRef.current = window.setTimeout(() => {
        setSuccessBanner('')
        successTimerRef.current = null
      }, LYRICS_SUCCESS_MS)

      if (closeModal) {
        window.setTimeout(() => setLyricsSearchOpen(false), 700)
      }
    },
    [setLyricsNotice, setLyricsSearchOpen],
  )

  useEffect(() => {
    if (!isOpen) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        if (lrPickerOpen) {
          setLrPickerOpen(false)
          setLrCandidates([])
        } else {
          setLyricsSearchOpen(false)
        }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isOpen, lrPickerOpen, setLyricsSearchOpen])

  const clearCurrentLyrics = useCallback(() => {
    useAudioStore.getState().setLrcLines([])
    if (sourceFileName != null) {
      const size = useAudioStore.getState().sourceFileSize
      if (size != null) clearLyricsDiskCache(sourceFileName, size)
    }
    setLyricsHint('текущий текст сброшен — можно искать заново')
    setLrPickerOpen(false)
    setLrCandidates([])
  }, [sourceFileName])

  const applyLyricsCandidate = useCallback(
    (c: RankedLrclibCandidate) => {
      if (audioEngine.loadLrcFromText(c.syncedText)) {
        const labels = catalogLabelsFromCandidate(c)
        useAudioStore.getState().applyCatalogTrackLabels(
          manualMetaDirty ? editArtist.trim() || labels.artist : labels.artist,
          manualMetaDirty ? editTitle.trim() || labels.title : labels.title,
          editAlbum.trim() || undefined,
        )
        setLrPickerOpen(false)
        setLrCandidates([])
        showLyricsSuccess(true)
      } else {
        setSuccessBanner('')
        setLyricsHint('вариант не разобрался как lrc — выбери другой')
      }
    },
    [editAlbum, editArtist, editTitle, manualMetaDirty, showLyricsSuccess],
  )

  const runAlternativesPicker = useCallback(
    async (tagsOnly = false) => {
      if (!hasTrackMeta || lrclibBusyRef.current) return

      const snapKey = `${trackArtist}\0${trackTitle}\0${sourceFileName ?? ''}\0${tagsOnly ? 'tags' : 'auto'}`

      lrclibBusyRef.current = true
      setLrclibBusy(true)
      setLyricsHint('запрос к lrclib…')
      setLrPickerOpen(false)
      setLrCandidates([])

      try {
        const dur = audioEngine.getDuration()
        const res = await fetchRankedLyricsCandidatesForTrack(dur > 0 ? dur : undefined, {
          tagsOnly: tagsOnly || manualMetaDirty,
        })

        if (res.status === 'network') {
          setLyricsHint('не удалось связаться с lrclib — проверь интернет или файрвол')
          return
        }
        if (res.status === 'none' || res.items.length === 0) {
          setLyricsHint('нет вариантов с синхронным текстом — поправь метаданные или загрузи .lrc')
          return
        }

        const st = useAudioStore.getState()
        const keyNow = `${st.trackInfo.artist}\0${st.trackInfo.title}\0${st.sourceFileName ?? ''}\0${tagsOnly ? 'tags' : 'auto'}`
        if (keyNow !== snapKey) return

        setLrCandidates(res.items)
        setLrPickerOpen(true)
        setLyricsHint('выбери запись в списке — рекомендуемая помечена')
      } finally {
        lrclibBusyRef.current = false
        setLrclibBusy(false)
      }
    },
    [hasTrackMeta, manualMetaDirty, sourceFileName, trackArtist, trackTitle],
  )

  const runManualMetaSearch = useCallback(async () => {
    if (lrclibBusyRef.current) return
    const title = editTitle.trim()
    if (!title) {
      setLyricsHint('укажи название композиции')
      return
    }

    setManualMetaDirty(true)
    lrclibBusyRef.current = true
    setLrclibBusy(true)
    setSuccessBanner('')
    setLyricsHint('поиск по уточнённым метаданным…')
    setLrPickerOpen(false)
    setLrCandidates([])

    const artist = editArtist.trim()
    const album = editAlbum.trim()

    try {
      const dur = audioEngine.getDuration()
      const r = await applyManualMetaAndSearchLyrics(artist, title, album, dur > 0 ? dur : undefined)
      if (r === 'applied') {
        showLyricsSuccess()
        return
      }
      const hint = autoLyricsResultHint(r)
      if (hint) setLyricsHint(hint)
      else setLyricsHint('')
      if (r === 'ambiguous') {
        await runAlternativesPicker(true)
      }
    } finally {
      lrclibBusyRef.current = false
      setLrclibBusy(false)
    }
  }, [editAlbum, editArtist, editTitle, runAlternativesPicker, showLyricsSuccess])

  const runCatalogRetry = useCallback(async () => {
    if (!hasTrackMeta || lrclibBusyRef.current) return
    lrclibBusyRef.current = true
    setLrclibBusy(true)
    setSuccessBanner('')
    setLyricsHint('подбор текста из каталога…')
    try {
      const dur = audioEngine.getDuration()
      const r = await tryAutoAttachLyricsFromCatalog(dur > 0 ? dur : undefined, {
        forceRetry: true,
        forceReplace: true,
      })
      if (r === 'applied') {
        showLyricsSuccess()
        return
      }
      const hint = autoLyricsResultHint(r)
      if (hint) setLyricsHint(hint)
      else setLyricsHint('')
      if (r === 'ambiguous') {
        await runAlternativesPicker(false)
      }
    } finally {
      lrclibBusyRef.current = false
      setLrclibBusy(false)
    }
  }, [hasTrackMeta, runAlternativesPicker, showLyricsSuccess])

  const onPickLrc = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    void audioEngine.loadLrcFile(file).then((ok) => {
      if (ok) {
        showLyricsSuccess(true)
      } else {
        setSuccessBanner('')
        setLyricsHint('не удалось разобрать .lrc')
      }
    })
  }, [showLyricsSuccess])

  if (!isOpen) return null

  return (
    <div
      className="overlay"
      onClick={() => setLyricsSearchOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-labelledby="lyrics-search-title"
    >
      <div
        className="modal-card"
        style={{ maxWidth: 460, position: 'relative' }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => setLyricsSearchOpen(false)}
          title="Закрыть"
          aria-label="Закрыть"
          style={{
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
          }}
        >
          <X size={14} />
        </button>

        <h2
          id="lyrics-search-title"
          style={{
            fontSize: 20,
            fontWeight: 600,
            letterSpacing: '-0.02em',
            margin: '0 40px 8px 0',
            color: 'var(--fg)',
          }}
        >
          Поиск текста
        </h2>
        <p style={{ margin: '0 0 16px', fontSize: 14, lineHeight: 1.5, color: 'var(--fg-soft)' }}>
          Уточни метаданные и найди синхронизированный текст в каталоге LRCLIB или загрузи файл .lrc.
        </p>

        {!sourceFileName ? (
          <p style={{ margin: 0, fontSize: 13, color: 'var(--fg-mute)' }}>
            Сначала загрузите трек — поиск текста доступен для текущего файла.
          </p>
        ) : (
          <>
            <div
              style={{
                marginBottom: 14,
                padding: '10px 12px',
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'var(--bg-soft)',
                fontSize: 12,
                lineHeight: 1.45,
                color: 'var(--fg-mute)',
              }}
            >
              <div>файл: {sourceFileName}</div>
              <div style={{ marginTop: 4 }}>
                сейчас: {trackArtist.trim() || '—'} — {trackTitle.trim()}
              </div>
              {parsedFromFile ? (
                <div style={{ marginTop: 4 }}>
                  из имени: {parsedFromFile.artist || '—'} — {parsedFromFile.title}
                </div>
              ) : null}
            </div>

            {lrcLines.length > 0 ? (
              <div
                style={{
                  marginBottom: 14,
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: '1px solid var(--premium-border)',
                  background: 'var(--premium-bg)',
                  fontSize: 12,
                  lineHeight: 1.45,
                  color: 'var(--fg-soft)',
                }}
              >
                <div style={{ marginBottom: 8 }}>
                  Сейчас загружен синхронный текст ({lrcLines.length} строк). Если он не совпадает с
                  треком — сбросьте и найдите заново.
                </div>
                <button
                  type="button"
                  className="btn btn--ghost"
                  style={{ width: '100%' }}
                  disabled={lrclibBusy}
                  onClick={clearCurrentLyrics}
                >
                  Сбросить текущий текст
                </button>
              </div>
            ) : null}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
              <label className="auth-modal__label" htmlFor="lyrics-search-artist">
                Исполнитель
              </label>
              <div className="auth-modal__input-shell">
                <input
                  id="lyrics-search-artist"
                  className="auth-modal__input"
                  value={editArtist}
                  onChange={(e) => {
                    setEditArtist(e.target.value)
                    setManualMetaDirty(true)
                  }}
                  placeholder="Например: Travis Scott"
                />
              </div>

              <label className="auth-modal__label" htmlFor="lyrics-search-title-input">
                Название
              </label>
              <div className="auth-modal__input-shell">
                <input
                  id="lyrics-search-title-input"
                  className="auth-modal__input"
                  value={editTitle}
                  onChange={(e) => {
                    setEditTitle(e.target.value)
                    setManualMetaDirty(true)
                  }}
                  placeholder="Название композиции"
                />
              </div>

              <label className="auth-modal__label" htmlFor="lyrics-search-album">
                Альбом <span style={{ opacity: 0.65 }}>(необязательно)</span>
              </label>
              <div className="auth-modal__input-shell">
                <input
                  id="lyrics-search-album"
                  className="auth-modal__input"
                  value={editAlbum}
                  onChange={(e) => {
                    setEditAlbum(e.target.value)
                    setManualMetaDirty(true)
                  }}
                  placeholder="Уточняет поиск в каталоге"
                />
              </div>
            </div>

            {successBanner ? <LyricsSuccessBanner text={successBanner} /> : null}

            <div className="auth-modal__stack">
              <button
                type="button"
                className="btn btn--primary"
                style={{ width: '100%' }}
                disabled={!canSearch}
                onClick={() => void runManualMetaSearch()}
              >
                Применить и найти текст
              </button>
              <button
                type="button"
                className="btn btn--ghost"
                style={{ width: '100%' }}
                disabled={!canSearch}
                onClick={() => void runCatalogRetry()}
              >
                Повторить автоподбор
              </button>
              <button
                type="button"
                className="btn btn--ghost"
                style={{ width: '100%' }}
                disabled={!canSearch}
                onClick={() => void runAlternativesPicker(false)}
              >
                Альтернативные источники
              </button>
              <button
                type="button"
                className="btn btn--ghost"
                style={{ width: '100%' }}
                disabled={!sourceFileName || lrclibBusy}
                onClick={() => lrcPickRef.current?.click()}
              >
                Загрузить файл .lrc
              </button>
            </div>

            <input
              ref={lrcPickRef}
              type="file"
              accept=".lrc"
              style={{ display: 'none' }}
              onChange={onPickLrc}
            />

            {lyricsHint && !successBanner ? (
              <p style={{ margin: '14px 0 0', fontSize: 13, color: 'var(--fg-soft)' }}>{lyricsHint}</p>
            ) : null}
          </>
        )}

        {lrPickerOpen ? (
          <div
            style={{
              marginTop: 16,
              borderTop: '1px solid var(--border)',
              paddingTop: 12,
            }}
          >
            <div
              style={{
                fontSize: 14,
                fontWeight: 600,
                marginBottom: 6,
                color: 'var(--fg)',
              }}
            >
              Варианты из LRCLIB
            </div>
            <p style={{ margin: '0 0 10px', fontSize: 12, lineHeight: 1.45, color: 'var(--fg-mute)' }}>
              Длительность трека: {formatDurationSec(trackDurationSec > 0 ? trackDurationSec : undefined)}.
            </p>
            <div style={{ maxHeight: 240, overflowY: 'auto' }}>
              {lrCandidates.map((c, i) => {
                const artist = c.artistName?.trim() || '—'
                const title = c.trackName?.trim() || c.label
                return (
                  <button
                    key={`${i}-${c.label.slice(0, 48)}`}
                    type="button"
                    onClick={() => applyLyricsCandidate(c)}
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      padding: '10px 12px',
                      marginBottom: 6,
                      borderRadius: 8,
                      border: c.isRecommended
                        ? '1px solid var(--premium-border)'
                        : '1px solid var(--border)',
                      background: c.isRecommended ? 'var(--premium-bg)' : 'var(--bg-soft)',
                      color: 'var(--fg)',
                      cursor: 'pointer',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                        gap: 8,
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.35 }}>
                          {artist} — {title}
                        </div>
                        <div style={{ marginTop: 4, fontSize: 11, color: 'var(--fg-mute)' }}>
                          {c.durationSec != null
                            ? `${formatDurationSec(c.durationSec)} · ${formatDeltaSec(c.durationDeltaSec)}`
                            : formatDeltaSec(c.durationDeltaSec)}
                        </div>
                      </div>
                      <div style={{ flexShrink: 0, textAlign: 'right' }}>
                        <div
                          style={{
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: 10,
                            color: 'var(--fg-soft)',
                          }}
                        >
                          {c.matchScore}%
                        </div>
                        {c.isRecommended ? (
                          <div
                            style={{
                              marginTop: 4,
                              fontSize: 9,
                              fontWeight: 700,
                              letterSpacing: '0.06em',
                              textTransform: 'uppercase',
                              color: 'var(--premium)',
                            }}
                          >
                            рекомендуется
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
