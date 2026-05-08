import { useCallback, useEffect, useRef, useState } from 'react'
import { audioEngine } from '../../audio/audioEngine'
import { useAudioStore } from '../../store/audioStore'
import { useUIStore } from '../../store/uiStore'
import { findActiveLrcIndex } from '../../utils/lrcParser'
import type { KaraokePalette } from '../../visual/karaokeVizPalette'
import { karaokeOverlayFallbackPalette } from '../../visual/karaokeVizPalette'

const IDLE_MS = 2000

const KARAOKE_LINE_FS_ACTIVE = 'clamp(15px, 2.8vw, 28px)'
const KARAOKE_LINE_FS_INACTIVE = 'clamp(12px, 2.2vw, 18px)'

const KARAOKE_LYRICS_FONT = "'Inter Tight', system-ui, sans-serif"

export type KaraokeLyricsLayerVariant = 'overlay' | 'standalone'

interface KaraokeLyricsLayerProps {
  variant: KaraokeLyricsLayerVariant
  palette?: KaraokePalette | null
}

export function KaraokeLyricsLayer({ variant, palette = null }: KaraokeLyricsLayerProps) {
  const lrcLines = useAudioStore((s) => s.lrcLines)
  const currentTime = useAudioStore((s) => s.currentTime)
  const beat = useAudioStore((s) => s.beat)
  const isPlayingStore = useAudioStore((s) => s.isPlaying)
  const trackTitle = useAudioStore((s) => s.trackInfo.title)
  const trackArtist = useAudioStore((s) => s.trackInfo.artist)
  const sourceFileName = useAudioStore((s) => s.sourceFileName)
  const setLyricsSearchOpen = useUIStore((s) => s.setLyricsSearchOpen)

  const lineRefs = useRef<(HTMLDivElement | null)[]>([])
  const ignoreProgrammaticScroll = useRef(false)
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [manualScroll, setManualScroll] = useState(false)
  const hasTrackMeta = trackTitle.trim().length > 0

  const clearIdleTimer = useCallback(() => {
    if (idleTimerRef.current !== null) {
      clearTimeout(idleTimerRef.current)
      idleTimerRef.current = null
    }
  }, [])

  const scheduleSnapBack = useCallback(() => {
    clearIdleTimer()
    idleTimerRef.current = window.setTimeout(() => {
      idleTimerRef.current = null
      setManualScroll(false)
    }, IDLE_MS)
  }, [clearIdleTimer])

  const lastLineClickRef = useRef<number | null>(null)

  useEffect(() => {
    if (!isPlayingStore) lastLineClickRef.current = null
  }, [isPlayingStore])

  const onLineActivate = useCallback(
    (lineTime: number) => {
      const playing = useAudioStore.getState().isPlaying
      if (lastLineClickRef.current === lineTime && playing) {
        audioEngine.pause()
        lastLineClickRef.current = null
        return
      }

      lastLineClickRef.current = lineTime
      clearIdleTimer()
      setManualScroll(false)
      audioEngine.seek(lineTime)
      if (!useAudioStore.getState().isPlaying) {
        audioEngine.play()
      }
    },
    [clearIdleTimer],
  )

  useEffect(() => () => clearIdleTimer(), [clearIdleTimer])

  const idx = findActiveLrcIndex(lrcLines, currentTime)

  useEffect(() => {
    setManualScroll(false)
    clearIdleTimer()
  }, [lrcLines, clearIdleTimer])

  useEffect(() => {
    if (manualScroll || lrcLines.length === 0 || idx < 0) return
    const el = lineRefs.current[idx]
    if (!el) return
    ignoreProgrammaticScroll.current = true
    el.scrollIntoView({ block: 'center', behavior: 'smooth' })
    const t = window.setTimeout(() => {
      ignoreProgrammaticScroll.current = false
    }, 450)
    return () => clearTimeout(t)
  }, [idx, manualScroll, lrcLines.length])

  const onScrollContainer = useCallback(() => {
    if (ignoreProgrammaticScroll.current) return
    setManualScroll(true)
    scheduleSnapBack()
  }, [scheduleSnapBack])

  const isOverlay = variant === 'overlay'
  const pal = isOverlay ? palette ?? karaokeOverlayFallbackPalette : null
  
  const lyricsPal = pal ?? karaokeOverlayFallbackPalette

  const scrollPaddingTop = isOverlay ? 'min(22%, 140px)' : '28vh'

  const outerStyle =
    variant === 'standalone'
      ? {
          position: 'absolute' as const,
          inset: 0,
          pointerEvents: 'none' as const,
          display: 'flex',
          flexDirection: 'column' as const,
          padding: 'min(5vh, 40px) min(6vw, 32px) 0',
          boxSizing: 'border-box' as const,
        }
      : {
          position: 'absolute' as const,
          inset: 0,
          zIndex: 25,
          pointerEvents: 'none' as const,
          display: 'flex',
          flexDirection: 'column' as const,
          padding: '10px 12px 12px',
          boxSizing: 'border-box' as const,
          overflow: 'hidden',
        }

  return (
    <div style={outerStyle}>
      {isOverlay && pal ? (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 0,
            pointerEvents: 'none',