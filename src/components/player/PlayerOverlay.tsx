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