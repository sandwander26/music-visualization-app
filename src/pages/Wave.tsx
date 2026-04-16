import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useLibraryStore, type LibraryTrack } from '../store/libraryStore'
import { useAudioStore } from '../store/audioStore'
import { useUIStore } from '../store/uiStore'
import { audioEngine } from '../audio/audioEngine'
import {
  MOOD_ORDER,
  MOOD_LABELS,
  MOOD_GRADIENTS,
  getTracksByMood,
  type MoodId,
} from '../audio/moodEngine'
import MoodPlaylistModal from '../components/wave/MoodPlaylistModal'

type WaveStage = 'select' | 'loading' | 'playlist'

const MOOD_QUESTIONS = [
  'Что слушаем сегодня?',
  'Какой вайб поймать?',
  'Что внутри играет?',
  'На каком ты вайбе?',
  'Как ты?',
]

const LOADING_TEXTS = [
  'Собираю плейлист...',
  'Ищу подходящие треки...',
  'Подбираю вайб...',
  'Слушаю твои треки...',
  'Готовлю настроение...',
]

const LOADING_DURATION_MS = 2000

function pickRandom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function dumpFeatures(tracks: LibraryTrack[]): string {
  if (tracks.length === 0) return '(empty)'
  return tracks.map((t) => {
    const f = t.features
    if (!f) return `${t.name}: ${t.isAnalyzing ? '...' : t.analyzeFailed ? 'failed' : 'pending'}`
    return `${t.name}: rms=${f.rmsMean.toFixed(3)} centroid=${Math.round(f.centroidMean)} flatness=${f.flatnessMean.toFixed(3)} zcr=${f.zcrMean.toFixed(3)} loudness=${f.loudnessMean.toFixed(2)} rolloff=${Math.round(f.rolloffMean)}`
  }).join('\n')
}

export default function Wave() {
  const tracks = useLibraryStore((s) => s.tracks)

  const [question] = useState(() => pickRandom(MOOD_QUESTIONS))
  const [stage, setStage] = useState<WaveStage>('select')
  const [selectedMood, setSelectedMood] = useState<MoodId | null>(null)
  const [loadingText, setLoadingText] = useState<string>('')

  const countsByMood = useMemo(() => {
    const counts: Record<MoodId, number> = {
      energetic: 0, upbeat: 0, calm: 0, sad: 0, melancholic: 0,
    }
    for (const m of MOOD_ORDER) counts[m] = getTracksByMood(tracks, m).length
    return counts
  }, [tracks])

  useEffect(() => {
    if (stage !== 'loading') return
    const t = setTimeout(() => setStage('playlist'), LOADING_DURATION_MS)
    return () => clearTimeout(t)
  }, [stage])

  function handleCardClick(mood: MoodId) {
    if (stage !== 'select') return
    if (countsByMood[mood] === 0) return

    const audio = useAudioStore.getState()
    const lib = useLibraryStore.getState()
    const ui = useUIStore.getState()
    const previousMood = audio.currentPlaylistMood

    if (previousMood && previousMood !== mood) {
      audio.updateMoodSession(previousMood, {
        playlistQueue: audio.playlistQueue,
        currentTrackId: lib.currentTrackId,
        currentTrackPosition: audio.currentTime,
        currentVizId: ui.selectedVizId,
      })
      audioEngine.pause()
      audio.clearPlaylistQueue()
    }

    setSelectedMood(mood)
    setLoadingText(pickRandom(LOADING_TEXTS))
    setStage('loading')
  }

  function handleBack() {
    setStage('select')
    setSelectedMood(null)
  }

  return (
    <main className="mx-auto max-w-[1400px] px-8 pt-16 pb-32 relative z-[2]">
      <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--fg-mute)] mb-4">
        — Твои плейлисты по настроению
      </div>
      <h1 className="text-5xl sm:text-6xl font-semibold tracking-[-0.035em] leading-[1.02] mb-6">
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
          которую чувствуешь.
        </span>
      </h1>
      <p
        style={{
          fontSize: 22,
          fontWeight: 400,
          color: 'var(--fg)',
          letterSpacing: '-0.01em',
          marginBottom: 40,
          fontFamily: "'Instrument Serif', serif",
          fontStyle: 'italic',
        }}
      >
        {question}
      </p>

      <div style={{ position: 'relative', minHeight: 280, marginBottom: 64 }}>
        <AnimatePresence mode="wait">
          {stage === 'select' && (
            <motion.div
              key="cards"
              initial={{ opacity: 1 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: 16,
              }}
            >
              {MOOD_ORDER.map((m, idx) => (
                <motion.div
                  key={m}
                  initial={false}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{
                    opacity: 0,
                    scale: 0.94,