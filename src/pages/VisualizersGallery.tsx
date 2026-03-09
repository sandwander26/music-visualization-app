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