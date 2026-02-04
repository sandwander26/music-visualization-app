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

    const draw = () => {
      const { audioData, beat } = useAudioStore.getState()
      const w = canvas.width
      const h = canvas.height

      ctx.fillStyle = 'rgba(0, 0, 0, 0.15)'
      ctx.fillRect(0, 0, w, h)

      const cx = w / 2
      const cy = h / 2

      ctx.strokeStyle = '#7cf'
      ctx.lineWidth = 2
      ctx.beginPath()
      for (let i = 0; i < 64; i++) {
        const angle = (i / 64) * Math.PI * 2
        const bin = Math.floor((i / 64) * audioData.length)
        const radius = 120 + audioData[bin] * 200
        const x = cx + Math.cos(angle) * radius
        const y = cy + Math.sin(angle) * radius
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.closePath()
      ctx.stroke()

      if (beat) {
        ctx.fillStyle = 'rgba(124, 207, 255, 0.25)'
        ctx.fillRect(0, 0, w, h)
      }

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
