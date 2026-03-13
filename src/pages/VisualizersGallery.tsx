import { useMemo, useState, type ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useUIStore } from '../store/uiStore'
import { useAudioStore } from '../store/audioStore'
import { MOOD_LABELS } from '../audio/moodEngine'
import { GALLERY } from '../gallery/registry'
import type { VizCategory } from '../gallery/types'
import { useUserVizStore } from '../userViz/userVizStore'
import type { UserVisualizerRuntime } from '../userViz/types'
import VisualizerCard from '../components/gallery/VisualizerCard'
import FilterChip from '../components/gallery/FilterChip'
import PreviewImage from '../components/gallery/PreviewImage'
import VisualizerHost from '../components/player/VisualizerHost'
import SystemAudioToggle from '../components/SystemAudioToggle'

type Filter = 'all' | 'user' | VizCategory

export default function VisualizersGallery() {
  const searchQuery = useUIStore((s) => s.searchQuery)
  const selectedVizId = useUIStore((s) => s.selectedVizId)
  const setSelectedVizId = useUIStore((s) => s.setSelectedVizId)
  const openOverlay = useUIStore((s) => s.openOverlay)

  const userVisualizers = useUserVizStore((s) => s.visualizers)

  const [filter, setFilter] = useState<Filter>('all')

  const counts = useMemo(() => {
    const c: Record<Filter, number> = {
      all: GALLERY.length + userVisualizers.length,
      user: userVisualizers.length,
      premium: 0,
      basic: 0,
      effects: 0,
      atmosphere: 0,
    }
    for (const v of GALLERY) c[v.category]++
    return c
  }, [userVisualizers])

  const filters: { key: Filter; label: string; premium?: boolean; hidden?: boolean }[] = [
    { key: 'all', label: 'Все' },
    { key: 'user', label: 'Мои', hidden: userVisualizers.length === 0 },
    { key: 'premium', label: 'Премиум', premium: true },
    { key: 'basic', label: 'Базовые' },
    { key: 'effects', label: 'Эффекты' },
    { key: 'atmosphere', label: 'Атмосфера' },
  ]
  const visibleFilters = filters.filter((f) => !f.hidden)

  const q = searchQuery.trim().toLowerCase()

  const filteredUser = useMemo(() => {
    if (filter !== 'all' && filter !== 'user') return []
    if (!q) return userVisualizers
    return userVisualizers.filter((v) => v.name.toLowerCase().includes(q))
  }, [filter, q, userVisualizers])

  const filteredBuiltin = useMemo(() => {
    if (filter === 'user') return []
    return GALLERY.filter((viz) => {
      if (filter !== 'all' && viz.category !== filter) return false
      if (!q) return true
      return viz.name.toLowerCase().includes(q) || viz.subcategory.toLowerCase().includes(q)
    })
  }, [filter, q])

  function handleSelect(id: string) {
    useAudioStore.getState().clearPlaylistQueue()
    setSelectedVizId(id)
    openOverlay(id)
  }

  const totalShown = filteredUser.length + filteredBuiltin.length

  return (
    <main className="mx-auto max-w-[1400px] px-8 pt-16 pb-32 relative z-[2]">
      <div className="flex items-start justify-between gap-8 mb-10">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--fg-mute)] mb-4">
            — Библиотека визуализаторов
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
              которую видишь.
            </span>
          </h1>
          <p className="text-base text-[var(--fg-soft)] max-w-2xl">
            Визуализаторы, которые реагируют на музыку в реальном времени
          </p>
        </div>

        <SystemAudioToggle />
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-8">
        {visibleFilters.map((f) => (
          <FilterChip
            key={f.key}
            active={filter === f.key}
            premium={f.premium}
            count={counts[f.key]}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </FilterChip>
        ))}
      </div>

      {totalShown === 0 ? (
        <div
          className="flex items-center justify-center"
          style={{ minHeight: 320, color: 'var(--fg-mute)', fontSize: 14 }}
        >
          Ничего не нашлось
        </div>
      ) : (
        <>
          <GridSection
            items={filteredUser}
            marginBottom={filteredBuiltin.length > 0 ? 24 : 0}
            renderCard={(u, i) => (
              <UserGalleryCard
                runtime={u}
                isActive={u.id === selectedVizId}
                index={i}
                onClick={() => handleSelect(u.id)}
              />
            )}
          />

          {filteredUser.length > 0 && filteredBuiltin.length > 0 ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                margin: '24px 0 32px',
              }}
            >
              <div
                style={{
                  flex: 1,
                  height: 1,
                  background: 'var(--border)',
                }}
              />
              <span
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 10,
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  color: 'var(--fg-mute)',
                }}
              >
                Встроенные
              </span>
              <div
                style={{
                  flex: 1,
                  height: 1,
                  background: 'var(--border)',
                }}
              />
            </div>
          ) : null}

          <GridSection
            items={filteredBuiltin}
            renderCard={(viz, i) => (
              <VisualizerCard
                viz={viz}
                isActive={viz.id === selectedVizId}
                index={i}
                onClick={() => handleSelect(viz.id)}
              />
            )}
          />
        </>
      )}
    </main>
  )
}

interface GridSectionProps<T> {
  items: T[]
  renderCard: (item: T, index: number) => ReactNode
  marginBottom?: number
}

function GridSection<T extends { id: string }>({ items, renderCard, marginBottom = 0 }: GridSectionProps<T>) {
  if (items.length === 0) return null
  return (
    <motion.div
      layout
      className="grid gap-4"
      style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', marginBottom }}
    >
      <AnimatePresence mode="popLayout">
        {items.map((item, i) => (
          <motion.div key={item.id} layout exit={{ opacity: 0, scale: 0.92 }} transition={{ duration: 0.3 }}>
            {renderCard(item, i)}
          </motion.div>
        ))}
      </AnimatePresence>
    </motion.div>
  )
}

interface UserGalleryCardProps {
  runtime: UserVisualizerRuntime
  isActive: boolean
  index: number
  onClick: () => void
}

function UserGalleryCard({ runtime, isActive, index, onClick }: UserGalleryCardProps) {
  const [hovered, setHovered] = useState(false)
  const broken = runtime.error !== null
  const canLivePreview = !broken && runtime.component !== null

  return (
    <motion.button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -4 }}
      whileTap={{ y: -2 }}
      className="relative aspect-[4/3] w-full overflow-hidden rounded-[14px] text-left"
      style={{
        background: broken
          ? 'linear-gradient(135deg, rgba(239,68,68,0.18), rgba(0,0,0,0.5))'
          : 'var(--bg-soft)',
        border: `1px solid ${isActive || hovered ? 'var(--border-active)' : 'var(--border)'}`,
        boxShadow: isActive
          ? '0 0 0 1px var(--border-active) inset, 0 18px 40px rgba(0,0,0,0.45)'
          : hovered
            ? '0 18px 40px rgba(0,0,0,0.45)'
            : '0 1px 2px rgba(0,0,0,0.2)',
        transition: 'box-shadow 0.25s, border-color 0.2s',
        cursor: 'pointer',
        padding: 0,
        outline: 'none',
      }}
    >
      <motion.div
        className="absolute inset-0"
        animate={{
          scale: hovered && canLivePreview ? 1.05 : 1,
          opacity: hovered && canLivePreview ? 0 : 1,
        }}
        transition={{
          scale: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
          opacity: { duration: 0.15 },
        }}
      >
        <PreviewImage vizId={runtime.id} name={runtime.name} />
      </motion.div>

      <AnimatePresence>
        {hovered && canLivePreview ? (
          <motion.div
            key="live"
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <VisualizerHost vizId={runtime.id} />
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'var(--card-overlay)' }}
      />

      <div
        style={{
          position: 'absolute',
          top: 14,
          right: 14,
          padding: '4px 8px',
          borderRadius: 6,
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 9,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          fontWeight: 500,
          background: 'var(--bg-elev)',
          border: '1px solid var(--border-strong)',
          color: 'var(--fg)',
          backdropFilter: 'blur(8px)',
        }}
      >
        Свой
      </div>

      <div
        className="absolute inset-x-0 bottom-0"
        style={{ padding: 18 }}
      >
        <div
          className="flex items-center gap-1.5"
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: 'var(--fg-mute)',
            marginBottom: 6,
          }}
        >
          <span>{broken ? 'ошибка' : 'свой'}</span>
          <span className="inline-block w-1 h-1 rounded-full bg-current opacity-60" />
          <span>{runtime.moods.map((m) => MOOD_LABELS[m]).join(', ') || '—'}</span>
        </div>
        <div
          className="truncate"
          style={{
            fontSize: 17,
            fontWeight: 600,
            color: 'var(--fg)',
            letterSpacing: '-0.01em',
          }}
        >
          {runtime.name}
        </div>
      </div>
    </motion.button>
  )
}

