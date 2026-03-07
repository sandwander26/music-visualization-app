import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowUpRight } from 'lucide-react'
import { CATEGORY_LABELS, type VizPreview } from '../../gallery/types'
import PreviewImage from './PreviewImage'
import VisualizerHost from '../player/VisualizerHost'

interface VisualizerCardProps {
  viz: VizPreview
  isActive: boolean
  index: number
  onClick: () => void
}

export default function VisualizerCard({ viz, isActive, index, onClick }: VisualizerCardProps) {
  const [hovered, setHovered] = useState(false)

  return (
    <motion.button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -4 }}
      whileTap={{ y: -2 }}
      className="group relative aspect-[4/3] w-full overflow-hidden rounded-[14px] text-left"
      style={{
        background: 'var(--bg-soft)',
        border: `1px solid ${isActive ? 'var(--border-active)' : hovered ? 'var(--border-active)' : 'var(--border)'}`,
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
        animate={{ scale: hovered ? 1.05 : 1, opacity: hovered ? 0 : 1 }}
        transition={{
          scale: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
          opacity: { duration: 0.15 },
        }}
      >
        <PreviewImage vizId={viz.id} name={viz.name} />
      </motion.div>

      <AnimatePresence>
        {hovered ? (
          <motion.div
            key="live"
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <VisualizerHost vizId={viz.id} />
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'var(--card-overlay)' }}
      />

      {viz.badge ? <Badge /> : null}

      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3" style={{ padding: 18 }}>
        <div className="flex flex-col gap-1.5 min-w-0">
          <div
            className="flex items-center gap-1.5"
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 10,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: 'var(--fg-mute)',
            }}
          >
            <span>{CATEGORY_LABELS[viz.category]}</span>
            <span className="inline-block w-1 h-1 rounded-full bg-current opacity-60" />
            <span>{viz.subcategory}</span>
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
            {viz.name}
          </div>
        </div>

        <motion.div
          animate={{ opacity: hovered ? 1 : 0, scale: hovered ? 1 : 0.85 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: 'var(--fg)',
            color: 'var(--bg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <ArrowUpRight size={16} strokeWidth={2.2} />
        </motion.div>
      </div>
    </motion.button>
  )
}

function Badge() {
  return (
    <div
      className="absolute"
      style={{
        top: 14,
        right: 14,
        padding: '4px 8px',
        borderRadius: 6,
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 9,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        fontWeight: 500,
        background: 'var(--premium-bg)',
        border: '1px solid var(--premium-border)',
        color: 'var(--premium)',
        backdropFilter: 'blur(8px)',
      }}
    >
      премиум
    </div>
  )
}
