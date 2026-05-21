export const TEMPLATE_CANVAS2D = `import { useEffect, useRef } from 'react'

interface VizProps {
  audioData: Float32Array
  beat: boolean
  energy: number
  currentTime: number
}

export default function MyCanvasViz({ audioData, beat, energy, currentTime }: VizProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // храним свежий снимок аудио в ref, чтобы RAF-цикл всегда видел актуальные значения
  const audioRef = useRef({ audioData, beat, energy, currentTime })
  useEffect(() => {
    audioRef.current = { audioData, beat, energy, currentTime }
  })

  // setup RAF один раз — иначе мы будем пересоздавать петлю на каждом обновлении звука
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let raf = 0
    let beatPulse = 0

    const draw = () => {
      const { beat, energy } = audioRef.current
      const w = canvas.width
      const h = canvas.height

      ctx.fillStyle = 'rgba(0, 0, 0, 0.18)'
      ctx.fillRect(0, 0, w, h)

      if (beat) beatPulse = 1
      beatPulse *= 0.92

      const cx = w / 2
      const cy = h / 2
      const baseR = Math.min(w, h) * 0.15
      const r = baseR + energy * 2400 + beatPulse * 80

      const hue = (Date.now() * 0.05) % 360
      ctx.fillStyle = \`hsl(\${hue}, 80%, \${55 + energy * 200}%)\`
      ctx.shadowColor = \`hsla(\${hue}, 80%, 70%, 0.7)\`
      ctx.shadowBlur = 40
      ctx.beginPath()
      ctx.arc(cx, cy, Math.max(10, r), 0, Math.PI * 2)
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
}
`

export function downloadTemplate(): void {
  const blob = new Blob([TEMPLATE_CANVAS2D], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'loomi-template.tsx'
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
