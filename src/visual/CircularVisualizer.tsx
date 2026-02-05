import { useEffect, useRef } from 'react'
import { useAudioStore } from '../store/audioStore'

export function CircularVisualizer() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let rafId = 0
    let kickPulse = 0

    const draw = () => {
      const { audioData, beat } = useAudioStore.getState()
      const w = canvas.width
      const h = canvas.height

      ctx.fillStyle = 'rgba(0, 0, 0, 0.18)'
      ctx.fillRect(0, 0, w, h)

      const cx = w / 2
      const cy = h / 2

      if (beat) kickPulse = 1
      kickPulse *= 0.9

      ctx.strokeStyle = '#7cf'
      ctx.lineWidth = 2 + kickPulse * 3
      ctx.shadowColor = '#7cf'
      ctx.shadowBlur = 8 + kickPulse * 20
      ctx.beginPath()
      for (let i = 0; i < 64; i++) {
        const angle = (i / 64) * Math.PI * 2
        const bin = Math.floor((i / 64) * audioData.length)
        const radius = 120 + audioData[bin] * 220 + kickPulse * 30
        const x = cx + Math.cos(angle) * radius
        const y = cy + Math.sin(angle) * radius
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.closePath()
      ctx.stroke()
      ctx.shadowBlur = 0

      rafId = requestAnimationFrame(draw)
    }
    rafId = requestAnimationFrame(draw)

    return () => {
      if (rafId) cancelAnimationFrame(rafId)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      width={1920}
      height={1080}
      style={{ width: '100%', height: '100%', display: 'block' }}
    />
  )
}
