import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Maximize2, Minimize2, ChevronLeft, ChevronRight, Library } from 'lucide-react'
import { useUIStore } from '../../store/uiStore'
import { useAudioStore } from '../../store/audioStore'
import { audioEngine } from '../../audio/audioEngine'
import { usePresetsStore } from '../../presets/presetsStore'
import { GALLERY } from '../../gallery/registry'
import { CATEGORY_LABELS } from '../../gallery/types'
import { useAllVisualizersInfo } from '../../gallery/all'
import VisualizerStage from './VisualizerStage'
import TrackInfo from './TrackInfo'
import Transport from './Transport'
import Scrubber from './Scrubber'
import VolumeControl from './VolumeControl'
import ActionButtons from './ActionButtons'
import ParamsPanel from './ParamsPanel'

type PanelView = 'player' | 'params'

export default function PlayerOverlay() {
  const overlayOpen = useUIStore((s) => s.overlayOpen)
  const selectedVizId = useUIStore((s) => s.selectedVizId)
  const isFullscreen = useUIStore((s) => s.isFullscreen)
  const closeOverlay = useUIStore((s) => s.closeOverlay)
  const setFullscreen = useUIStore((s) => s.setFullscreen)
  const cycleVisualizer = useUIStore((s) => s.cycleVisualizer)
  const setTab = useUIStore((s) => s.setTab)

  function goToLibrary() {
    closeOverlay()
    setTab('library')
  }

  const trackTitle = useAudioStore((s) => s.trackInfo.title)
  const hasTrack = trackTitle !== ''

  const setActivePresetVisualizer = usePresetsStore((s) => s.setActiveVisualizerId)

  const [panelView, setPanelView] = useState<PanelView>('player')

  useEffect(() => {
    if (!overlayOpen) setPanelView('player')
  }, [overlayOpen])

  useEffect(() => {
    setPanelView('player')
  }, [selectedVizId])

  const allViz = useAllVisualizersInfo()
  const allIds = useMemo(() => allViz.map((v) => v.id), [allViz])

  const fallbackViz = {
    id: GALLERY[0].id,
    name: GALLERY[0].name,
    category: GALLERY[0].category as string,
    subcategory: GALLERY[0].subcategory,
  }

  const builtinMatch = GALLERY.find((v) => v.id === selectedVizId)
  const userMatch = allViz.find((v) => v.id === selectedVizId && v.isUserViz)

  const viz = builtinMatch
    ? {
        id: builtinMatch.id,
        name: builtinMatch.name,
        category: builtinMatch.category as string,
        subcategory: builtinMatch.subcategory,
      }
    : userMatch
      ? {
          id: userMatch.id,
          name: userMatch.name,
          category: 'user',
          subcategory: 'Свой',
        }
      : fallbackViz

  const vizIndex = Math.max(0, allViz.findIndex((v) => v.id === viz.id))
  const prevViz = allViz[(vizIndex - 1 + allViz.length) % allViz.length] ?? fallbackViz
  const nextViz = allViz[(vizIndex + 1) % allViz.length] ?? fallbackViz

  useEffect(() => {
    if (selectedVizId) setActivePresetVisualizer(selectedVizId)
  }, [selectedVizId, setActivePresetVisualizer])

  const togglePlay = useCallback(() => {
    if (!hasTrack) return
    if (useAudioStore.getState().isPlaying) audioEngine.pause()
    else audioEngine.play()
  }, [hasTrack])

  const toggleMute = useCallback(() => {
    const v = useAudioStore.getState().volume
    audioEngine.setVolume(v === 0 ? 1 : 0)
  }, [])

  useEffect(() => {
    if (!overlayOpen) return
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null
      const tag = target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) return

      if (e.key === 'Escape') {
        e.preventDefault()
        if (useUIStore.getState().isFullscreen) setFullscreen(false)
        else closeOverlay()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        cycleVisualizer('prev', allIds)
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        cycleVisualizer('next', allIds)
      } else if (e.code === 'Space') {
        e.preventDefault()
        togglePlay()
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault()
        setFullscreen(!useUIStore.getState().isFullscreen)
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault()
        toggleMute()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [overlayOpen, allIds, cycleVisualizer, closeOverlay, setFullscreen, togglePlay, toggleMute])

  return (
    <AnimatePresence>
      {overlayOpen ? (
        <motion.div
          key="player-overlay"
          className="fixed inset-0 z-[60] flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <div
            className="absolute inset-0"
            style={{
              background: 'rgba(0,0,0,0.45)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
            }}
            onClick={() => closeOverlay()}
          />

          {isFullscreen ? (
            <FullscreenStage vizId={viz.id} onExit={() => setFullscreen(false)} />
          ) : (
            <motion.div
              className="relative overflow-hidden rounded-2xl"
              style={{
                width: '85vw',
                maxWidth: 1400,
                maxHeight: '85vh',
                background: 'var(--bg)',
                border: '1px solid var(--border-strong)',
                boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
              }}
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                style={{
                  position: 'absolute',
                  top: 12,
                  right: 12,
                  display: 'flex',
                  gap: 8,
                  zIndex: 5,
                }}
              >
                <button
                  type="button"
                  onClick={() => setFullscreen(true)}
                  title="На весь экран (F)"
                  style={{
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
                  <Maximize2 size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => closeOverlay()}
                  title="Закрыть (Esc)"
                  style={{
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
              </div>

              <div className="flex" style={{ height: 'calc(85vh - 0px)', maxHeight: 800 }}>
                <div
                  className="flex-1 flex items-center justify-center"
                  style={{ padding: 24, paddingBottom: 56, minWidth: 0 }}
                >
                  <div style={{ width: '100%' }}>
                    <VisualizerStage vizId={viz.id} isFullscreen={false} />
                  </div>
                </div>

                <aside
                  style={{
                    width: 320,
                    flexShrink: 0,
                    borderLeft: '1px solid var(--border)',
                    background: 'var(--bg)',
                    overflow: 'hidden',
                    position: 'relative',
                    zIndex: 2,
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  <AnimatePresence mode="wait">
                    {panelView === 'player' ? (
                      <motion.div
                        key="player-view"
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -8 }}
                        transition={{ duration: 0.18, ease: 'easeOut' }}
                        style={{
                          padding: 24,
                          paddingBottom: 56,
                          gap: 20,
                          overflowY: 'auto',
                          display: 'flex',
                          flexDirection: 'column',
                          flex: 1,
                        }}
                      >
                        <div className="flex items-start justify-between" style={{ gap: 8 }}>
                          <div style={{ minWidth: 0 }}>
                            <div
                              style={{
                                fontFamily: "'JetBrains Mono', monospace",
                                fontSize: 10,
                                letterSpacing: '0.16em',
                                textTransform: 'uppercase',
                                color: 'var(--fg-mute)',
                                marginBottom: 6,
                              }}
                            >
                              {CATEGORY_LABELS[viz.category] ?? viz.category} · {viz.subcategory}
                            </div>
                            <h2
                              style={{
                                fontSize: 20,
                                fontWeight: 600,
                                letterSpacing: '-0.02em',
                                color: 'var(--fg)',
                              }}
                            >
                              {viz.name}
                            </h2>
                          </div>
                        </div>

                        {hasTrack ? (
                          <TrackInfo />
                        ) : (
                          <button
                            type="button"
                            onClick={goToLibrary}
                            className="hov-icon-btn t-color-border"
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
                              justifyContent: 'center',
                              gap: 8,
                              cursor: 'pointer',
                              fontFamily: 'inherit',
                            }}
                          >
                            <Library size={14} />
                            Выбрать трек из библиотеки
                          </button>
                        )}

                        <div style={{ borderTop: '1px solid var(--border)' }} />

                        <Transport hasTrack={hasTrack} />
                        <Scrubber hasTrack={hasTrack} />
                        <VolumeControl />

                        <div style={{ borderTop: '1px solid var(--border)' }} />

                        <ActionButtons hasTrack={hasTrack} onOpenParams={() => setPanelView('params')} />
                      </motion.div>
                    ) : (
                      <motion.div
                        key="params-view"
                        initial={{ opacity: 0, x: 8 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 8 }}
                        transition={{ duration: 0.18, ease: 'easeOut' }}
                        style={{
                          padding: 24,
                          paddingBottom: 56,
                          gap: 18,
                          overflowY: 'auto',
                          display: 'flex',
                          flexDirection: 'column',
                          flex: 1,
                        }}
                      >
                        <ParamsPanel
                          visualizerId={viz.id}
                          visualizerName={viz.name}
                          onBack={() => setPanelView('player')}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </aside>
              </div>

              <div
                className="absolute inset-x-0 bottom-0 flex items-center justify-center"
                style={{
                  gap: 14,
                  padding: '14px 16px',
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 10,
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  color: 'var(--fg-mute)',
                  borderTop: '1px solid var(--border)',
                  background: 'var(--bg-soft)',
                }}
              >
                <NavBtn onClick={() => cycleVisualizer('prev', allIds)} title="Предыдущий (←)">
                  <ChevronLeft size={12} />
                  <span>{prevViz.name}</span>
                </NavBtn>
                <span style={{ opacity: 0.5 }}>·</span>
                <span>
                  {vizIndex + 1} из {allViz.length}
                </span>
                <span style={{ opacity: 0.5 }}>·</span>
                <NavBtn onClick={() => cycleVisualizer('next', allIds)} title="Следующий (→)">
                  <span>{nextViz.name}</span>
                  <ChevronRight size={12} />
                </NavBtn>
              </div>
            </motion.div>
          )}
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

interface NavBtnProps {
  onClick: () => void
  title: string
  children: React.ReactNode
}

function NavBtn({ onClick, title, children }: NavBtnProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        background: 'transparent',
        border: 'none',
        color: 'inherit',
        font: 'inherit',
        letterSpacing: 'inherit',
        textTransform: 'inherit',
        cursor: 'pointer',
        padding: '4px 6px',
        borderRadius: 4,
      }}
      className="hov-fg t-color-border"
    >
      {children}
    </button>
  )
}

interface FullscreenStageProps {
  vizId: string
  onExit: () => void
}

function FullscreenStage({ vizId, onExit }: FullscreenStageProps) {
  return (
    <>
      <VisualizerStage vizId={vizId} isFullscreen={true} />
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onExit()
        }}
        title="Выйти из фуллскрина (Esc)"
        style={{
          position: 'fixed',
          top: 16,
          right: 16,
          zIndex: 201,
          width: 36,
          height: 36,
          borderRadius: 8,
          border: '1px solid rgba(255,255,255,0.15)',
          background: 'rgba(0,0,0,0.5)',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          backdropFilter: 'blur(10px)',
        }}
      >
        <Minimize2 size={16} />
      </button>
    </>
  )
}
