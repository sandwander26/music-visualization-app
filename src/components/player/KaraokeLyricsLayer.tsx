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
            background: pal.bottomGradient,
          }}
        />
      ) : null}

      <div
        style={{
          position: 'relative',
          zIndex: 1,
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {lrcLines.length === 0 ? (
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: pal?.emptyHintColor ?? 'rgba(255,255,255,0.48)',
              fontSize: isOverlay ? 'clamp(11px, 2vw, 15px)' : 'clamp(14px, 2vw, 18px)',
              textAlign: 'center',
              maxWidth: isOverlay ? 360 : 440,
              lineHeight: 1.55,
              margin: '0 auto',
              padding: '0 8px',
              pointerEvents: 'auto',
              gap: isOverlay ? 10 : 14,
            }}
          >
            {hasTrackMeta ? (
              <>
                <p style={{ margin: 0 }}>
                  Текст для этого трека ещё не загружен. Откройте поиск рядом с названием трека или
                  нажмите кнопку ниже.
                </p>
                {sourceFileName ? (
                  <p
                    style={{
                      margin: 0,
                      fontSize: 12,
                      opacity: 0.62,
                      wordBreak: 'break-word',
                      color: pal?.emptyHintMuted,
                    }}
                  >
                    {trackArtist.trim() || '—'} — {trackTitle.trim()}
                  </p>
                ) : null}
                <button
                  type="button"
                  onClick={() => setLyricsSearchOpen(true)}
                  style={{
                    padding: isOverlay ? '8px 12px' : '10px 16px',
                    borderRadius: 10,
                    border: `1px solid ${pal?.chipBorder ?? 'rgba(255,255,255,0.22)'}`,
                    background: pal?.chipBg ?? 'rgba(255,255,255,0.08)',
                    color: pal?.chipFg ?? '#f2f0ff',
                    fontSize: isOverlay ? 12 : 14,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Найти текст
                </button>
              </>
            ) : (
              <p style={{ margin: 0, pointerEvents: 'none' }}>
                Загрузите трек — затем найдите синхронизированный текст через кнопку рядом с
                названием.
              </p>
            )}
          </div>
        ) : (
          <div
            onScroll={onScrollContainer}
            style={{
              pointerEvents: 'auto',
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
              overflowX: 'hidden',
              WebkitOverflowScrolling: 'touch',
              padding: `${scrollPaddingTop} 0 12px`,
              boxSizing: 'border-box',
              scrollbarWidth: 'thin',
              fontFamily: KARAOKE_LYRICS_FONT,
            }}
          >
            {lrcLines.map((line, globalIdx) => {
              const isActive = globalIdx === idx
              const dist = idx >= 0 ? Math.abs(globalIdx - idx) : 6
              const opacity = isActive ? 1 : Math.max(0.2, 0.55 - dist * 0.07)
              const scale = isActive ? (beat ? 1.05 : 1.02) : 0.96

              return (
                <div
                  key={`${line.time}-${globalIdx}`}
                  ref={(el) => {
                    lineRefs.current[globalIdx] = el
                  }}
                  role="button"
                  tabIndex={0}
                  title="Перейти к этой строке"
                  onClick={() => onLineActivate(line.time)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onLineActivate(line.time)
                    }
                  }}
                  style={{
                    color: isActive ? lyricsPal.activeLineColor : lyricsPal.inactiveLineColor,
                    fontSize: isActive ? KARAOKE_LINE_FS_ACTIVE : KARAOKE_LINE_FS_INACTIVE,
                    fontWeight: isActive ? 700 : 500,
                    opacity,
                    transform: `scale(${scale})`,
                    transition:
                      'opacity 0.38s ease, transform 0.1s ease, color 0.35s ease, font-size 0.35s ease',
                    margin: 'clamp(6px, 1vh, 12px) auto',
                    boxSizing: 'border-box',
                    width: 'fit-content',
                    maxWidth: 'min(96%, 720px)',
                    textAlign: 'center',
                    lineHeight: 1.35,
                    textShadow: isActive ? lyricsPal.activeShadow : lyricsPal.inactiveShadow,
                    cursor: 'pointer',
                    userSelect: 'none',
                    borderRadius: 8,
                    padding: '6px 10px',
                  }}
                >
                  {line.text}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
