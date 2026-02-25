import { useEffect, useRef } from 'react'
import { useAudioStore } from '../store/audioStore'
import { audioEngine } from '../audio/audioEngine'
import { useVisualizerParams } from '../presets/useVisualizerParams'

interface TunnelBarsParams {
  barHeight: number
  ringSize: number
  rotationSpeed: number
  smoothing: number
  tilt: number
}

interface EdgeParticle {
  pos: number
  speed: number
  size: number
  opacity: number
}

function createEdgeParticles(count: number): EdgeParticle[] {
  return Array.from({ length: count }, () => ({
    pos: Math.random(),
    speed: (Math.random() * 0.0004 + 0.0002) * (Math.random() > 0.5 ? 1 : -1),
    size: Math.random() * 2 + 2,
    opacity: Math.random() * 0.6 + 0.4,
  }))
}

function generateTearPoints(count: number): number[] {
  return Array.from({ length: count }, () => (Math.random() - 0.5) * 16)
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

const TEAR_POINTS = 120
const PARTICLE_COUNT = 20
const CIRCLE_BARS = 64
const BASE_RADIUS = 80

export function TunnelBarsVisualizer() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef(0)

  const smoothTopRef = useRef(0)
  const smoothBottomRef = useRef(0)
  const smoothTopLeftRef = useRef(0)
  const smoothTopRightRef = useRef(0)
  const smoothBottomLeftRef = useRef(0)
  const smoothBottomRightRef = useRef(0)

  const beatFlashRef = useRef(0)
  const beatExpandRef = useRef(0)

  const tearTopRef = useRef(generateTearPoints(TEAR_POINTS))
  const tearBottomRef = useRef(generateTearPoints(TEAR_POINTS))
  const tearFrameRef = useRef(0)

  const topParticlesRef = useRef(createEdgeParticles(PARTICLE_COUNT))
  const bottomParticlesRef = useRef(createEdgeParticles(PARTICLE_COUNT))

  const shakeXRef = useRef(0)
  const shakeYRef = useRef(0)

  const chromaFramesRef = useRef(0)

  const timeRef = useRef(0)

  const rotationRef = useRef(0)
  const radiusPulseRef = useRef(BASE_RADIUS)
  const smoothedCircleRef = useRef(new Float32Array(CIRCLE_BARS))

  const coverImgRef = useRef<HTMLImageElement | null>(null)
  const coverUrlRef = useRef('')

  const params = useVisualizerParams<TunnelBarsParams>('tunnelbars')
  const paramsRef = useRef(params)
  paramsRef.current = params

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    function resize() {
      if (!canvas) return
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const FRAME_INTERVAL = 1000 / 60
    let lastFrameTime = 0

    function draw() {
      if (!canvas || !ctx) return

      const now = performance.now()
      const elapsed = now - lastFrameTime
      if (elapsed < FRAME_INTERVAL) {
        rafRef.current = requestAnimationFrame(draw)
        return
      }
      lastFrameTime = now - (elapsed % FRAME_INTERVAL)

      const { audioData, beat, isPlaying, trackInfo, currentTime } = useAudioStore.getState()
      const pp = paramsRef.current
      const smooth = pp.smoothing
      const W = canvas.width
      const H = canvas.height

      timeRef.current++
      const time = timeRef.current

      const coverUrl = trackInfo.cover
      if (coverUrl && coverUrl !== coverUrlRef.current) {
        coverUrlRef.current = coverUrl
        const img = new Image()
        img.src = coverUrl
        img.onload = () => { coverImgRef.current = img }
      } else if (!coverUrl) {
        coverImgRef.current = null
        coverUrlRef.current = ''
      }

      if (coverImgRef.current) {
        const img = coverImgRef.current
        const scale = Math.max(W / img.width, H / img.height)
        const iw = img.width * scale
        const ih = img.height * scale
        ctx.filter = 'blur(20px) brightness(0.7)'
        ctx.drawImage(img, (W - iw) / 2, (H - ih) / 2, iw, ih)
        ctx.filter = 'none'
      } else {
        const grad = ctx.createLinearGradient(0, 0, 0, H)
        grad.addColorStop(0, '#0a0a0a')
        grad.addColorStop(0.5, '#111')
        grad.addColorStop(1, '#0a0a0a')
        ctx.fillStyle = grad
        ctx.fillRect(0, 0, W, H)
      }

      const a10 = isPlaying && audioData.length > 10 ? audioData[10] : 0
      const a20 = isPlaying && audioData.length > 20 ? audioData[20] : 0

      const baseHeight = H * 0.15 * pp.barHeight

      if (beat && isPlaying) {
        beatFlashRef.current = 2
        beatExpandRef.current = H * 0.08
        shakeXRef.current = (Math.random() - 0.5) * 8
        shakeYRef.current = (Math.random() - 0.5) * 6
        chromaFramesRef.current = 3
      }
      if (beatFlashRef.current > 0) beatFlashRef.current--
      beatExpandRef.current *= 0.7

      shakeXRef.current *= 0.8
      shakeYRef.current *= 0.8
      const shakeX = shakeXRef.current
      const shakeY = shakeYRef.current

      if (chromaFramesRef.current > 0) chromaFramesRef.current--
      const chromaActive = chromaFramesRef.current > 0

      const beatExpand = beatExpandRef.current
      const flash = beatFlashRef.current > 0

      const targetTop = baseHeight + a10 * H * 0.2 + beatExpand
      const targetBottom = baseHeight + a20 * H * 0.2 + beatExpand

      if (isPlaying) {
        smoothTopRef.current = smoothTopRef.current * smooth + targetTop * (1 - smooth)
        smoothBottomRef.current = smoothBottomRef.current * smooth + targetBottom * (1 - smooth)
      } else {
        smoothTopRef.current = baseHeight + (smoothTopRef.current - baseHeight) * 0.95
        smoothBottomRef.current = baseHeight + (smoothBottomRef.current - baseHeight) * 0.95
      }

      const topH = smoothTopRef.current
      const bottomH = smoothBottomRef.current

      const tiltTop = (Math.sin(time * 0.05) * 25 + Math.sin(time * 0.13) * 10) * pp.tilt
      const tiltBottom = (Math.cos(time * 0.07) * 20 + Math.sin(time * 0.11) * 8) * pp.tilt

      const targetTopLeft = topH + tiltTop
      const targetTopRight = topH - tiltTop
      const targetBottomLeft = bottomH + tiltBottom
      const targetBottomRight = bottomH - tiltBottom

      if (isPlaying) {
        smoothTopLeftRef.current = smoothTopLeftRef.current * smooth + targetTopLeft * (1 - smooth)
        smoothTopRightRef.current = smoothTopRightRef.current * smooth + targetTopRight * (1 - smooth)
        smoothBottomLeftRef.current = smoothBottomLeftRef.current * smooth + targetBottomLeft * (1 - smooth)
        smoothBottomRightRef.current = smoothBottomRightRef.current * smooth + targetBottomRight * (1 - smooth)
      } else {
        const baseTL = baseHeight + tiltTop
        const baseTR = baseHeight - tiltTop
        const baseBL = baseHeight + tiltBottom
        const baseBR = baseHeight - tiltBottom
        smoothTopLeftRef.current = baseTL + (smoothTopLeftRef.current - baseTL) * 0.95
        smoothTopRightRef.current = baseTR + (smoothTopRightRef.current - baseTR) * 0.95
        smoothBottomLeftRef.current = baseBL + (smoothBottomLeftRef.current - baseBL) * 0.95
        smoothBottomRightRef.current = baseBR + (smoothBottomRightRef.current - baseBR) * 0.95
      }

      const tl = smoothTopLeftRef.current
      const tr = smoothTopRightRef.current
      const bl = smoothBottomLeftRef.current
      const br = smoothBottomRightRef.current

      ctx.save()
      ctx.translate(shakeX, shakeY)

      ctx.fillStyle = '#000000'
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.lineTo(W, 0)
      ctx.lineTo(W, tr)
      ctx.lineTo(0, tl)
      ctx.closePath()
      ctx.fill()

      ctx.beginPath()
      ctx.moveTo(0, H)
      ctx.lineTo(W, H)
      ctx.lineTo(W, H - br)
      ctx.lineTo(0, H - bl)
      ctx.closePath()
      ctx.fill()

      tearFrameRef.current++
      if (tearFrameRef.current >= 3) {
        tearFrameRef.current = 0
        tearTopRef.current = generateTearPoints(TEAR_POINTS)
        tearBottomRef.current = generateTearPoints(TEAR_POINTS)
      }

      const xOffset = Math.sin(time * 0.1) * 0.3

      ctx.save()
      ctx.shadowBlur = 12
      ctx.shadowColor = 'rgba(255,255,255,0.8)'
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'
      ctx.lineWidth = 1.5

      const tearTop = tearTopRef.current
      ctx.beginPath()
      for (let i = 0; i < TEAR_POINTS; i++) {
        const t = i / (TEAR_POINTS - 1)
        const x = t * W + xOffset
        const baseY = tl + (tr - tl) * t
        const y = baseY + tearTop[i]
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()

      const tearBottom = tearBottomRef.current
      ctx.beginPath()
      for (let i = 0; i < TEAR_POINTS; i++) {
        const t = i / (TEAR_POINTS - 1)
        const x = t * W + xOffset
        const baseY = H - bl - (br - bl) * t
        const y = baseY + tearBottom[i]
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
      ctx.restore()

      const topParts = topParticlesRef.current
      const bottomParts = bottomParticlesRef.current

      ctx.save()
      ctx.shadowBlur = 6
      ctx.shadowColor = 'rgba(255,255,255,0.7)'

      for (const p of topParts) {
        p.pos += p.speed
        if (p.pos > 1) p.pos -= 1
        if (p.pos < 0) p.pos += 1
        const x = p.pos * W
        const baseY = tl + (tr - tl) * p.pos
        ctx.fillStyle = `rgba(255,255,255,${p.opacity})`
        ctx.beginPath()
        ctx.arc(x, baseY, p.size, 0, Math.PI * 2)
        ctx.fill()
      }

      for (const p of bottomParts) {
        p.pos += p.speed
        if (p.pos > 1) p.pos -= 1
        if (p.pos < 0) p.pos += 1
        const x = p.pos * W
        const baseY = H - bl - (br - bl) * p.pos
        ctx.fillStyle = `rgba(255,255,255,${p.opacity})`
        ctx.beginPath()
        ctx.arc(x, baseY, p.size, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.restore()

      if (flash) {
        ctx.fillStyle = 'rgba(255,255,255,0.15)'
        ctx.fillRect(0, 0, W, H)
      }

      const topEdge = (tl + tr) / 2
      const bottomEdge = H - (bl + br) / 2
      const centerY = (topEdge + bottomEdge) / 2
      const centerX = W / 2

      if (isPlaying) rotationRef.current += 0.005 * pp.rotationSpeed
      const targetRadius = (beat && isPlaying ? 110 : BASE_RADIUS) * pp.ringSize
      radiusPulseRef.current = radiusPulseRef.current * 0.9 + targetRadius * 0.1
      const radius = radiusPulseRef.current
      const rotation = rotationRef.current
      const smoothedCircle = smoothedCircleRef.current

      ctx.save()
      ctx.shadowBlur = 8
      ctx.shadowColor = 'rgba(255,255,255,0.6)'
      ctx.strokeStyle = 'rgba(255,255,255,0.7)'
      ctx.lineWidth = 2
      ctx.lineCap = 'round'

      for (let i = 0; i < CIRCLE_BARS; i++) {
        const angle = (i / CIRCLE_BARS) * Math.PI * 2 + rotation
        const dataIdx = (i * 2) % (audioData.length || 128)
        const raw = isPlaying && audioData.length > dataIdx ? audioData[dataIdx] : 0

        if (isPlaying) {
          smoothedCircle[i] = smoothedCircle[i] * smooth + raw * (1 - smooth)
        } else {
          smoothedCircle[i] *= 0.95
        }
        const barLen = smoothedCircle[i] * 80

        const x1 = centerX + Math.cos(angle) * radius
        const y1 = centerY + Math.sin(angle) * radius
        const x2 = centerX + Math.cos(angle) * (radius + barLen)
        const y2 = centerY + Math.sin(angle) * (radius + barLen)

        ctx.beginPath()
        ctx.moveTo(x1, y1)
        ctx.lineTo(x2, y2)
        ctx.stroke()
      }
      ctx.restore()

      if (trackInfo.artist) {
        ctx.save()
        ctx.fillStyle = 'rgba(255,255,255,0.5)'
        ctx.font = '11px monospace'
        ctx.textBaseline = 'middle'
        ctx.textAlign = 'center'
        ctx.letterSpacing = '3px'
        ctx.fillText(trackInfo.artist.toUpperCase(), centerX, centerY - 30)
        ctx.restore()
      }

      if (trackInfo.title) {
        ctx.save()
        ctx.fillStyle = 'rgba(255,255,255,1)'
        ctx.font = '500 15px monospace'
        ctx.textBaseline = 'middle'
        ctx.textAlign = 'center'
        ctx.fillText(trackInfo.title, centerX, centerY + 110)
        ctx.restore()
      }

      const duration = audioEngine.getDuration()
      if (duration > 0) {
        ctx.save()
        ctx.fillStyle = 'rgba(255,255,255,0.7)'
        ctx.font = '12px monospace'
        ctx.textBaseline = 'middle'
        ctx.textAlign = 'right'
        ctx.fillText(
          `${formatTime(currentTime)} / ${formatTime(duration)}`,
          W - 20,
          centerY + 110
        )
        ctx.restore()
      }

      ctx.restore()

      if (chromaActive) {
        ctx.save()
        ctx.lineWidth = 1.5
        ctx.strokeStyle = 'rgba(255,100,100,0.3)'
        ctx.beginPath()
        for (let i = 0; i < TEAR_POINTS; i++) {
          const t = i / (TEAR_POINTS - 1)
          const x = t * W + 3
          const baseY = tl + (tr - tl) * t
          if (i === 0) ctx.moveTo(x, baseY)
          else ctx.lineTo(x, baseY)
        }
        ctx.stroke()
        ctx.strokeStyle = 'rgba(100,100,255,0.3)'
        ctx.beginPath()
        for (let i = 0; i < TEAR_POINTS; i++) {
          const t = i / (TEAR_POINTS - 1)
          const x = t * W - 3
          const baseY = tl + (tr - tl) * t
          if (i === 0) ctx.moveTo(x, baseY)
          else ctx.lineTo(x, baseY)
        }
        ctx.stroke()
        ctx.strokeStyle = 'rgba(255,100,100,0.3)'
        ctx.beginPath()
        for (let i = 0; i < TEAR_POINTS; i++) {
          const t = i / (TEAR_POINTS - 1)
          const x = t * W + 3
          const baseY = H - bl - (br - bl) * t
          if (i === 0) ctx.moveTo(x, baseY)
          else ctx.lineTo(x, baseY)
        }
        ctx.stroke()
        ctx.strokeStyle = 'rgba(100,100,255,0.3)'
        ctx.beginPath()
        for (let i = 0; i < TEAR_POINTS; i++) {
          const t = i / (TEAR_POINTS - 1)
          const x = t * W - 3
          const baseY = H - bl - (br - bl) * t
          if (i === 0) ctx.moveTo(x, baseY)
          else ctx.lineTo(x, baseY)
        }
        ctx.stroke()
        ctx.restore()
      }

      ctx.save()
      ctx.fillStyle = 'rgba(255,255,255,0.025)'
      for (let i = 0; i < 300; i++) {
        const gx = Math.random() * W
        const gy = Math.random() * H
        ctx.fillRect(gx, gy, 1, 1)
      }
      ctx.restore()

      const vignette = ctx.createRadialGradient(
        W / 2, H / 2, Math.min(W, H) * 0.3,
        W / 2, H / 2, Math.max(W, H) * 0.7
      )
      vignette.addColorStop(0, 'rgba(0,0,0,0)')
      vignette.addColorStop(1, 'rgba(0,0,0,0.5)')
      ctx.fillStyle = vignette
      ctx.fillRect(0, 0, W, H)

      rafRef.current = requestAnimationFrame(draw)
    }

    rafRef.current = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        display: 'block',
        zIndex: 0,
      }}
    />
  )
}
