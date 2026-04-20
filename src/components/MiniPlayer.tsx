import { Maximize2, Music } from 'lucide-react'
import { useAudioStore } from '../store/audioStore'
import { useUIStore } from '../store/uiStore'
import { GALLERY } from '../gallery/registry'
import Transport from './player/Transport'
import Scrubber from './player/Scrubber'
import VolumeControl from './player/VolumeControl'

export default function MiniPlayer() {
  const trackInfo = useAudioStore((s) => s.trackInfo)
  const audioMode = useAudioStore((s) => s.audioMode)
  const overlayOpen = useUIStore((s) => s.overlayOpen)
  const openOverlay = useUIStore((s) => s.openOverlay)
  const selectedVizId = useUIStore((s) => s.selectedVizId)

  const hasTrack = trackInfo.title !== ''

  if (audioMode === 'system' || !hasTrack || overlayOpen) return null

  const displayTitle = trackInfo.title || 'Без названия'
  const displayArtist = trackInfo.artist || 'Неизвестный исполнитель'

  function expand() {
    const vizId = selectedVizId ?? GALLERY[0].id
    openOverlay(vizId)
  }

  return (
    <div
      style={{
        position: 'fixed',
        left: 16,
        right: 16,
        bottom: 16,
        height: 72,
        zIndex: 70,
        borderRadius: 12,
        background: 'color-mix(in srgb, var(--bg-soft) 82%, transparent)',
        backdropFilter: 'blur(18px)',
        WebkitBackdropFilter: 'blur(18px)',
        border: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        gap: 18,
        padding: '0 16px',
        boxShadow: '0 12px 36px rgba(0,0,0,0.4)',
      }}
    >
      <button
        type="button"
        onClick={expand}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          background: 'transparent',
          border: 'none',
          color: 'inherit',
          cursor: 'pointer',
          minWidth: 0,
          flex: '0 0 220px',
          padding: 0,
          fontFamily: 'inherit',
          textAlign: 'left',
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 6,
            overflow: 'hidden',
            background: trackInfo.cover
              ? 'transparent'
              : 'linear-gradient(135deg, var(--bg-elev), var(--bg-hover))',
            border: '1px solid var(--border)',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {trackInfo.cover ? (
            <img
              src={trackInfo.cover}
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          ) : (
            <Music size={18} style={{ color: 'var(--fg-mute)' }} />
          )}
        </div>
        <div className="flex flex-col min-w-0" style={{ gap: 2 }}>
          <div
            className="truncate"
            style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg)', letterSpacing: '-0.005em' }}
          >
            {displayTitle}
          </div>
          <div className="truncate" style={{ fontSize: 11, color: 'var(--fg-soft)' }}>
            {displayArtist}
          </div>
        </div>
      </button>

      <div style={{ flex: '0 0 auto' }}>
        <Transport hasTrack={true} />
      </div>

      <div style={{ flex: '1 1 auto', minWidth: 180 }}>
        <Scrubber hasTrack={true} />
      </div>

      <div style={{ flex: '0 0 130px' }}>
        <VolumeControl />
      </div>

      <button
        type="button"
        onClick={expand}
        title="На весь экран"
        className="t-color-border hov-icon-btn"
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
          flex: '0 0 32px',
        }}
      >
        <Maximize2 size={14} />
      </button>
    </div>
  )
}
