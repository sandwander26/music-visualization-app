import { useEffect, useMemo, useState } from 'react'
import { X, Play, Pause, ArrowLeft } from 'lucide-react'
import Modal from '../Modal'
import {
  MOOD_LABELS,
  MOOD_GRADIENTS,
  getTracksByMood,
  pickVizForMood,
  type MoodId,
} from '../../audio/moodEngine'
import { useLibraryStore, type LibraryTrack } from '../../store/libraryStore'
import { useAudioStore, EMPTY_MOOD_SESSION } from '../../store/audioStore'
import { useUIStore } from '../../store/uiStore'
import { audioEngine } from '../../audio/audioEngine'
import { loadTrack } from '../../library/playback'
import { GALLERY } from '../../gallery/registry'
import { getAllVisualizersInfoSnapshot } from '../../gallery/all'
import { pluralTrack } from '../../utils/plural'
import { formatDuration } from '../../utils/format'
import PlayingIndicator from '../PlayingIndicator'

interface MoodPlaylistModalProps {
  moodId: MoodId
  onClose: () => void
  onBack?: () => void
}

export default function MoodPlaylistModal({ moodId, onClose, onBack }: MoodPlaylistModalProps) {
  const tracks = useLibraryStore((s) => s.tracks)
  const currentTrackId = useLibraryStore((s) => s.currentTrackId)
  const setCurrentTrack = useLibraryStore((s) => s.setCurrentTrack)
  const isPlaying = useAudioStore((s) => s.isPlaying)
  const setPlaylistQueue = useAudioStore((s) => s.setPlaylistQueue)
  const currentPlaylistMood = useAudioStore((s) => s.currentPlaylistMood)
  const openOverlay = useUIStore((s) => s.openOverlay)
  const setSelectedVizId = useUIStore((s) => s.setSelectedVizId)
  const selectedVizId = useUIStore((s) => s.selectedVizId)

  const moodTracks = useMemo(() => getTracksByMood(tracks, moodId), [tracks, moodId])
  const moodTrackIds = useMemo(() => moodTracks.map((t) => t.id), [moodTracks])

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  async function switchToTrack(track: LibraryTrack) {
    setPlaylistQueue(moodTrackIds, moodId)
    setCurrentTrack(track.id)
    try {
      await loadTrack(track)
      audioEngine.play()
    } catch (err) {
      console.warn('[wave] не удалось запустить трек', err)
    }
  }

  function handleTrackRowClick(track: LibraryTrack) {
    if (track.id === currentTrackId) {
      if (isPlaying) audioEngine.pause()
      else audioEngine.play()
      return
    }
    void switchToTrack(track)
  }

  async function handlePlayAll() {
    if (moodTracks.length === 0) return

    const playingInThisMood = currentPlaylistMood === moodId
      && !!currentTrackId
      && moodTrackIds.includes(currentTrackId)

    if (playingInThisMood) {
      const vizId = selectedVizId ?? GALLERY[0].id
      openOverlay(vizId)
      onClose()
      return
    }

    const audio = useAudioStore.getState()
    const savedSession = audio.moodSessions[moodId]
    const savedTrack = savedSession?.currentTrackId
      ? moodTracks.find((t) => t.id === savedSession.currentTrackId)
      : null

    if (savedSession && savedTrack && savedSession.currentVizId) {
      setPlaylistQueue(savedSession.playlistQueue.length > 0 ? savedSession.playlistQueue : moodTrackIds, moodId)
      setSelectedVizId(savedSession.currentVizId)
      setCurrentTrack(savedTrack.id)
      try {
        await loadTrack(savedTrack)
        audioEngine.seek(savedSession.currentTrackPosition)
        audioEngine.play()
      } catch (err) {
        console.warn('[wave] не удалось возобновить сессию', err)
      }
      openOverlay(savedSession.currentVizId)
      onClose()
      return
    }

    const first = moodTracks[0]
    setPlaylistQueue(moodTrackIds, moodId)
    const ctx = {
      avoided: savedSession?.avoidedVizIds ?? EMPTY_MOOD_SESSION.avoidedVizIds,
      lastPickedForTrack: savedSession?.lastPickedForTrack ?? null,
    }
    const pool = getAllVisualizersInfoSnapshot()
    const result = pickVizForMood(moodId, first.id, pool, ctx, { force: true })
    const vizId = result.vizId ?? selectedVizId ?? GALLERY[0].id
    audio.updateMoodSession(moodId, {
      playlistQueue: moodTrackIds,
      currentTrackId: first.id,
      currentTrackPosition: 0,
      currentVizId: vizId,
      avoidedVizIds: result.avoided,
      lastPickedForTrack: result.lastPickedForTrack,
    })
    setSelectedVizId(vizId)
    setCurrentTrack(first.id)
    try {
      await loadTrack(first)
      audioEngine.play()
    } catch (err) {
      console.warn('[wave] не удалось запустить плейлист', err)
    }
    openOverlay(vizId)
    onClose()
  }

  return (
    <Modal onClose={onClose} zIndex={60} cardStyle={{ maxWidth: 680, maxHeight: '82vh' }}>
        <ModalHeader
          moodId={moodId}
          count={moodTracks.length}
          onPlayAll={handlePlayAll}
          onClose={onClose}
          onBack={onBack}
        />

        <div
          style={{
            overflowY: 'auto',
            padding: '8px 12px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
        >
          {moodTracks.length === 0 ? (
            <div
              style={{
                padding: '40px 16px',
                textAlign: 'center',
                color: 'var(--fg-mute)',
                fontSize: 13,
              }}
            >
              В этом плейлисте пока нет треков
            </div>
          ) : (
            moodTracks.map((t) => (
              <PlaylistTrackRow
                key={t.id}
                track={t}
                isCurrent={t.id === currentTrackId}
                isPlaying={isPlaying && t.id === currentTrackId}
                onActivate={() => handleTrackRowClick(t)}
              />
            ))
          )}
        </div>
    </Modal>
  )
}

interface ModalHeaderProps {
  moodId: MoodId
  count: number
  onPlayAll: () => void
  onClose: () => void
  onBack?: () => void
}

function ModalHeader({ moodId, count, onPlayAll, onClose, onBack }: ModalHeaderProps) {
  const empty = count === 0
  return (
    <div
      style={{
        padding: '20px 16px 20px 20px',
        background: empty ? 'var(--bg-soft)' : MOOD_GRADIENTS[moodId],
        color: empty ? 'var(--fg)' : '#0a0a0a',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
      }}
    >
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          aria-label="Другое настроение"
          style={{
            alignSelf: 'flex-start',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px 6px 8px',
            borderRadius: 999,
            border: 'none',
            background: 'rgba(0,0,0,0.18)',
            color: empty ? 'var(--fg-soft)' : '#0a0a0a',
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 500,
            fontFamily: 'inherit',
            letterSpacing: '-0.005em',
            whiteSpace: 'nowrap',
            opacity: 0.85,
            transition: 'background 0.15s, opacity 0.15s',
            flexShrink: 0,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(0,0,0,0.3)'
            e.currentTarget.style.opacity = '1'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(0,0,0,0.18)'
            e.currentTarget.style.opacity = '0.85'
          }}
        >