import { type CSSProperties, type ReactNode } from 'react'
import { X } from 'lucide-react'
import Modal from '../Modal'

interface UserVizDocsModalProps {
  onClose: () => void
}

const MONO_LABEL: CSSProperties = {
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: 10,
  letterSpacing: '0.16em',
  textTransform: 'uppercase',
  color: 'var(--fg-mute)',
}

const UL_STYLE: CSSProperties = {
  paddingLeft: 18,
  marginTop: 6,
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
}

const EXAMPLE_CODE = `import { useEffect, useRef } from 'react'

export default function MyViz({ audioData, beat, energy, currentTime }) {
  const canvasRef = useRef(null)

  const audioRef = useRef({ audioData, beat, energy, currentTime })
  useEffect(() => {
    audioRef.current = { audioData, beat, energy, currentTime }
  })

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    let raf = 0
    const draw = () => {
      const { energy, beat } = audioRef.current
      ctx.fillStyle = 'rgba(0,0,0,0.2)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.fillStyle = beat ? '#fff' : '#7cf'
      const r = 40 + energy * 1200
      ctx.beginPath()
      ctx.arc(canvas.width / 2, canvas.height / 2, r, 0, Math.PI * 2)
      ctx.fill()
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <canvas
      ref={canvasRef}
      width={1920}
      height={1080}
      style={{ width: '100%', height: '100%', display: 'block', background: '#000' }}
    />
  )
}`

export default function UserVizDocsModal({ onClose }: UserVizDocsModalProps) {
  return (
    <Modal onClose={onClose} zIndex={75} cardStyle={{ maxWidth: 720, maxHeight: '86vh' }}>
        <div
          style={{
            padding: '20px 24px 16px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ ...MONO_LABEL, marginBottom: 4 }}>Документация</div>
            <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.015em' }}>
              Как написать свой визуализатор
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            style={{
              width: 30,
              height: 30,
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

        <div
          style={{
            padding: 24,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 18,