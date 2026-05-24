import { useRef, useEffect, type CSSProperties } from 'react'
import { Loader2, FileSearch, Check } from 'lucide-react'
import { useAudioStore } from '../../store/audioStore'
import { useAuthStore } from '../../store/authStore'
import { useLibraryStore } from '../../store/libraryStore'
import { useUIStore } from '../../store/uiStore'
import { trackNeedsLocalFile } from '../../utils/trackCloud'
import TrackCloudBadge from '../library/TrackCloudBadge'

const LYRICS_NOTICE_MS = 3500

export default function TrackInfo() {
  const trackInfo = useAudioStore((s) => s.trackInfo)
  const preparing = useAudioStore((s) => s.trackPrepareBusy)
  const sourceFileName = useAudioStore((s) => s.sourceFileName)
  const setLyricsSearchOpen = useUIStore((s) => s.setLyricsSearchOpen)
  const lyricsNotice = useUIStore((s) => s.lyricsNotice)
  const setLyricsNotice = useUIStore((s) => s.setLyricsNotice)
  const title = trackInfo.title || 'Untitled'
  const artist = trackInfo.artist || 'Unknown artist'
  const currentTrackId = useLibraryStore((s) => s.currentTrackId)
  const libraryTrack = useLibraryStore((s) =>
    currentTrackId ? s.tracks.find((t) => t.id === currentTrackId) : undefined,
  )
  const cloudAudioTrackIds = useAuthStore((s) => s.cloudAudioTrackIds)
  const cloudNeedsLocal = libraryTrack ? trackNeedsLocalFile(libraryTrack) : false
  const cloudHasAudio = libraryTrack ? cloudAudioTrackIds.includes(libraryTrack.id) : false

  const lyricsNoticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (lyricsNoticeTimerRef.current != null) {
        clearTimeout(lyricsNoticeTimerRef.current)
        lyricsNoticeTimerRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (!lyricsNotice) return
    if (lyricsNoticeTimerRef.current != null) {
      clearTimeout(lyricsNoticeTimerRef.current)
    }
    lyricsNoticeTimerRef.current = window.setTimeout(() => {
      setLyricsNotice(null)
      lyricsNoticeTimerRef.current = null
    }, LYRICS_NOTICE_MS)
    return () => {
      if (lyricsNoticeTimerRef.current != null) {
        clearTimeout(lyricsNoticeTimerRef.current)
        lyricsNoticeTimerRef.current = null
      }
    }
  }, [lyricsNotice, setLyricsNotice])

  const canSearchLyrics = Boolean(sourceFileName) && !preparing

  const iconBtnStyle = (enabled: boolean): CSSProperties => ({
    flexShrink: 0,
    width: 30,
    height: 30,
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: 'var(--bg-soft)',
    color: enabled ? 'var(--fg-soft)' : 'var(--fg-mute)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: enabled ? 'pointer' : 'not-allowed',
    opacity: sourceFileName ? 1 : 0.35,
  })

  return (
    <div className="flex items-center" style={{ gap: 12 }}>
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 8,
          flexShrink: 0,
          overflow: 'hidden',
          background: trackInfo.cover
            ? 'transparent'
            : 'linear-gradient(135deg, var(--bg-elev) 0%, var(--bg-soft) 100%)',
          border: '1px solid var(--border)',
        }}
      >
        {trackInfo.cover ? (
          <img
            src={trackInfo.cover}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : null}
      </div>
      <div className="flex flex-col min-w-0 flex-1" style={{ gap: 4 }}>
        <div className="flex items-center gap-8 min-w-0">
          {preparing ? (
            <Loader2 size={14} className="animate-spin flex-shrink-0" style={{ color: 'var(--fg-mute)' }} />
          ) : null}
          <div
            className="truncate flex-1 min-w-0"
            style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg)', letterSpacing: '-0.01em' }}
          >
            {title}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              type="button"
              title="найти текст песни (LRCLIB)"
              aria-label="найти текст песни"
              disabled={!canSearchLyrics}
              onClick={() => setLyricsSearchOpen(true)}
              style={iconBtnStyle(canSearchLyrics)}
            >
              <FileSearch size={14} />
            </button>
          </div>
        </div>
        {lyricsNotice?.kind === 'success' ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              fontSize: 10,
              lineHeight: 1.35,
              padding: '5px 8px',
              borderRadius: 6,
              border: '1px solid rgba(74, 222, 128, 0.35)',
              background: 'rgba(74, 222, 128, 0.1)',
              color: '#bbf7d0',
              width: 'fit-content',
              maxWidth: '100%',
            }}
          >
            <Check size={10} style={{ color: '#4ade80', flexShrink: 0 }} aria-hidden />
            <span>{lyricsNotice.text}</span>
          </div>
        ) : null}
        <div
          className="truncate"
          style={{
            fontSize: 12,
            color: 'var(--fg-soft)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            minWidth: 0,
          }}
        >
          <span className="truncate" style={{ minWidth: 0 }}>
            {artist}
          </span>
          {libraryTrack ? (
            <TrackCloudBadge
              needsLocalFile={cloudNeedsLocal}
              hasCloudAudio={cloudHasAudio}
            />
          ) : null}
        </div>
        {preparing ? (
          <div style={{ fontSize: 11, color: 'var(--fg-mute)' }}>метаданные и lrclib…</div>
        ) : null}
      </div>
    </div>
  )
}
