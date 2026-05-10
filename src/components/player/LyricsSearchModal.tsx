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