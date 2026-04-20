import { type CSSProperties } from 'react'
import { motion } from 'framer-motion'
import { Play, Pause, X, CloudDownload, CloudUpload } from 'lucide-react'
import type { LibraryTrack } from '../../store/libraryStore'
import TrackCloudBadge from './TrackCloudBadge'

interface TrackGridCardProps {
  track: LibraryTrack
  isActive: boolean
  isPlaying: boolean
  onPlay: () => void
  onRemove: () => void
  needsLocalFile?: boolean
  hasCloudAudio?: boolean
  cloudBusy?: boolean
  onCloudDownload?: () => void
  onCloudUpload?: () => void
}

export default function TrackGridCard({
  track,
  isActive,
  isPlaying,
  onPlay,
  onRemove,
  needsLocalFile = false,
  hasCloudAudio = false,
  cloudBusy = false,
  onCloudDownload,
  onCloudUpload,
}: TrackGridCardProps) {
  const showPause = isActive && isPlaying

  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      className="group"
      onClick={onPlay}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onPlay()
        }
      }}
      style={{ cursor: 'pointer', outline: 'none' }}
    >
      <div
        className="relative"
        style={{
          width: '100%',
          aspectRatio: '1 / 1',
          borderRadius: 12,
          overflow: 'hidden',
          background: track.cover
            ? 'transparent'
            : 'linear-gradient(135deg, var(--bg-elev) 0%, var(--bg-hover) 100%)',
          border: '1px solid var(--border)',
          boxShadow: isActive ? '0 0 0 2px var(--fg) inset' : 'none',
        }}
      >
        {track.cover ? (
          <img
            src={track.cover}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : null}

        <div
          className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(2px)' }}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onPlay()
            }}
            title={showPause ? 'Пауза' : 'Воспроизвести'}
            style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              border: 'none',
              background: '#fff',
              color: '#000',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            {showPause ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
          </button>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          title="Удалить"
          className="absolute opacity-0 group-hover:opacity-100 transition-opacity"
          style={{
            top: 8,
            right: 8,
            width: 26,
            height: 26,
            borderRadius: 6,
            border: '1px solid rgba(255,255,255,0.18)',
            background: 'rgba(0,0,0,0.55)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <X size={12} />
        </button>
      </div>

      <div className="flex flex-col min-w-0" style={{ padding: '10px 4px 0', gap: 2 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <div
            className="truncate"
            style={{ fontSize: 13, fontWeight: 500, color: 'var(--fg)', letterSpacing: '-0.005em', minWidth: 0 }}
          >
            {track.name}
          </div>
          <TrackCloudBadge needsLocalFile={needsLocalFile} hasCloudAudio={hasCloudAudio} size={11} />
        </div>
        <div className="truncate" style={{ fontSize: 12, color: 'var(--fg-soft)' }}>
          {track.artist}
        </div>
        {(onCloudUpload || onCloudDownload) ? (
          <div className="flex gap-1" style={{ marginTop: 4 }} onClick={(e) => e.stopPropagation()}>
            {needsLocalFile && hasCloudAudio && onCloudDownload ? (
              <button
                type="button"
                title="Скачать из облака"
                disabled={cloudBusy}
                onClick={() => onCloudDownload()}
                style={cloudActionStyle}
              >
                <CloudDownload size={12} />
              </button>
            ) : null}
            {!needsLocalFile && onCloudUpload ? (
              <button
                type="button"
                title="Прикрепить к облаку"
                disabled={cloudBusy}
                onClick={() => onCloudUpload()}
                style={cloudActionStyle}
              >
                <CloudUpload size={12} />
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </motion.div>
  )
}

const cloudActionStyle: CSSProperties = {
  width: 26,
  height: 26,
  borderRadius: 6,
  border: '1px solid var(--border)',
  background: 'var(--bg-soft)',
  color: 'var(--fg-mute)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  flexShrink: 0,
}
