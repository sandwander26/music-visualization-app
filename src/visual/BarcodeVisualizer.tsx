import { useEffect, useRef } from 'react'
import { useAudioStore } from '../store/audioStore'
import { useVisualizerParams } from '../presets/useVisualizerParams'

const MAX_BAR_COUNT = 128
const BAR_WIDTH_BASE = 8
const BAR_GAP_BASE = 2
const MAX_BAR_HEIGHT_BASE = 200
const PARTICLE_COUNT = 12
const GRAIN_COUNT = 200

interface BarcodeParams {
  barCount: number
  barHeight: number
  smoothing: number
  hueSpeed: number
}

interface LensParticle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  baseSize: number
  isStar: boolean
  life: number      // 0..1, -1 = постоянная
  maxLife: number
}

interface GlitchSlice {
  y: number
  offset: number
  frames: number
}

function createParticle(w: number, h: number, temporary: boolean, scl: number): LensParticle {
  const base = (Math.random() * 16 + 4) * scl
  return {
    x: Math.random() * w,
    y: Math.random() * h,
    vx: (Math.random() - 0.5) * 0.6 * scl,
    vy: (Math.random() - 0.5) * 0.6 * scl,
    size: base,
    baseSize: base,
    isStar: Math.random() > 0.5,
    life: temporary ? 1.0 : -1,
    maxLife: temporary ? 60 : -1,
  }
}

function createParticles(w: number, h: number, scl: number): LensParticle[] {
  return Array.from({ length: PARTICLE_COUNT }, () => createParticle(w, h, false, scl))
}

export function BarcodeVisualizer() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef(0)
  const beatIntensityRef = useRef(0)
  const hueOffsetRef = useRef(0)
  const particlesRef = useRef<LensParticle[]>([])
  const glitchRef = useRef<GlitchSlice[]>([])
  const smoothedBarsRef = useRef(new Float32Array(MAX_BAR_COUNT))

  const params = useVisualizerParams<BarcodeParams>('barcode')
  const paramsRef = useRef(params)
  paramsRef.current = params
  const flareScaleRef = useRef(1.0)
  const vGlitchFramesRef = useRef(0)
  const vGlitchOffsetRef = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    function resize() {
      if (!canvas) return
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      const scl = Math.min(canvas.width, canvas.height) / 1080
      particlesRef.current = createParticles(canvas.width, canvas.height, scl)
    }
    resize()
    window.addEventListener('resize', resize)

    const FRAME_INTERVAL = 1000 / 60
    let lastFrameTime = 0

    function drawBarcodeLayer(
      ctx: CanvasRenderingContext2D,
      W: number, H: number,
      smoothed: Float32Array,
      hueOffset: number,
      bi: number,
      offsetMain: number,
      tint: string,
      isVertical: boolean,
      barWidth: number,
      barStep: number,
      maxBarH: number,
      barCount: number,
    ) {
      ctx.save()
      ctx.globalCompositeOperation = 'screen'
      ctx.globalAlpha = 0.6

      // длинная ось
      const mainAxisLen = isVertical ? H : W
      const crossCenter = (isVertical ? W : H) / 2
      const totalSpan = barCount * barStep
      const startMain = (mainAxisLen - totalSpan) / 2 + offsetMain

      for (let i = 0; i < barCount; i++) {
        const val = smoothed[i]
        const barH = Math.min(maxBarH, val * maxBarH)
        const brightness = Math.min(1, val * 8 + 0.3)

        const hue = ((i * 6) + hueOffset) % 360
        const lum = bi > 0.5 ? 95 : 70 * brightness
        const sat = bi > 0.5 ? 10 : 80

        ctx.fillStyle = tint === 'r'
          ? `hsla(${hue}, ${sat}%, ${lum}%, 1)`
          : tint === 'g'
            ? `hsla(${hue + 120}, ${sat}%, ${lum}%, 1)`
            : `hsla(${hue + 240}, ${sat}%, ${lum}%, 1)`

        // зеркалим от центра
        if (isVertical) {
          ctx.fillRect(crossCenter - barH / 2, startMain + i * barStep, barH, barWidth)
        } else {
          ctx.fillRect(startMain + i * barStep, crossCenter - barH / 2, barWidth, barH)
        }
      }

      ctx.restore()
    }

    function drawScanlines(ctx: CanvasRenderingContext2D, W: number, H: number, scl: number) {
      ctx.fillStyle = 'rgba(0,0,0,0.15)'
      const step = Math.max(2, Math.round(4 * scl))
      for (let y = 0; y < H; y += step) {
        ctx.fillRect(0, y, W, 1)
      }
    }

    function drawGrain(ctx: CanvasRenderingContext2D, W: number, H: number) {
      ctx.fillStyle = 'rgba(255,255,255,0.03)'
      for (let i = 0; i < GRAIN_COUNT; i++) {
        ctx.fillRect(Math.random() * W, Math.random() * H, 1, 1)
      }
    }

    function drawTrackTitle(
      ctx: CanvasRenderingContext2D,
      W: number, H: number,
      bi: number,
      title: string,
    ) {
      if (!title) return
      const minDim = Math.min(W, H)

      ctx.save()
      ctx.font = `${Math.round(minDim * 0.014)}px monospace`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      const alpha = bi > 0.3 ? 1.0 : 0.6
      ctx.fillStyle = `rgba(255,255,255,${alpha})`
      ctx.letterSpacing = '4px'
      ctx.fillText(title.toUpperCase(), W / 2, H * 0.92)
      ctx.restore()
    }

    function drawParticles(
      ctx: CanvasRenderingContext2D,
      W: number, H: number,
      bi: number,
      flareScale: number,
      scl: number,
    ) {
      const parts = particlesRef.current
      const alive: LensParticle[] = []

      for (const p of parts) {
        if (p.life > 0) {
          p.life -= 1 / p.maxLife
          if (p.life <= 0) continue
        }

        p.x += p.vx
        p.y += p.vy
        if (p.x < 0 || p.x > W) p.vx *= -1
        if (p.y < 0 || p.y > H) p.vy *= -1

        const beatScale = p.life === -1 ? flareScale : 1.0
        const pulseSize = (p.baseSize + bi * 6 * scl) * beatScale
        p.size = pulseSize

        const lifeAlpha = p.life > 0 ? p.life : 1.0

        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size)
        grad.addColorStop(0, `rgba(255,255,220,${(0.5 + bi * 0.3) * lifeAlpha})`)
        grad.addColorStop(0.5, `rgba(255,255,180,${(0.15 + bi * 0.1) * lifeAlpha})`)
        grad.addColorStop(1, 'rgba(255,255,180,0)')

        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fill()

        if (p.isStar) {
          ctx.strokeStyle = `rgba(255,255,220,${(0.25 + bi * 0.2) * lifeAlpha})`
          ctx.lineWidth = 1
          const len = p.size * 1.5
          ctx.beginPath()
          ctx.moveTo(p.x - len, p.y)
          ctx.lineTo(p.x + len, p.y)
          ctx.moveTo(p.x, p.y - len)
          ctx.lineTo(p.x, p.y + len)
          ctx.stroke()
        }

        alive.push(p)
      }

      particlesRef.current = alive
    }

    function draw() {
      if (!canvas || !ctx) return

      const now = performance.now()
      const elapsed = now - lastFrameTime
      if (elapsed < FRAME_INTERVAL) {
        rafRef.current = requestAnimationFrame(draw)
        return
      }
      lastFrameTime = now - (elapsed % FRAME_INTERVAL)

      const { audioData, beat, energy, trackInfo } = useAudioStore.getState()

      const W = canvas.width
      const H = canvas.height
      const isVertical = H > W * 1.2
      const scl = Math.min(W, H) / 1080

      const pp = paramsRef.current
      const barCount = Math.max(20, Math.min(MAX_BAR_COUNT, Math.floor(pp.barCount)))
      const barHeightMul = Math.max(0, pp.barHeight)
      const smoothParam = Math.max(0, Math.min(0.95, pp.smoothing))
      const hueSpeedMul = Math.max(0, pp.hueSpeed)

      const barWidth = BAR_WIDTH_BASE * scl
      const barStep = (BAR_WIDTH_BASE + BAR_GAP_BASE) * scl
      const maxBarH = MAX_BAR_HEIGHT_BASE * scl * barHeightMul

      if (beat) {
        beatIntensityRef.current = 1.0
        flareScaleRef.current = 2.0
        particlesRef.current.push(createParticle(W, H, true, scl))
      } else {
        beatIntensityRef.current *= 0.85
        flareScaleRef.current += (1.0 - flareScaleRef.current) * 0.15
      }
      const bi = beatIntensityRef.current

      const smoothed = smoothedBarsRef.current
      for (let i = 0; i < barCount; i++) {
        const idx = (i * 2) % 128
        const raw = audioData[idx] ?? 0
        smoothed[i] = smoothed[i] * smoothParam + raw * (1 - smoothParam)
      }

      hueOffsetRef.current += 0.5 * hueSpeedMul

      const zoom = 1.0 + bi * 0.03
      ctx.setTransform(zoom, 0, 0, zoom, W * (1 - zoom) / 2, H * (1 - zoom) / 2)

      ctx.fillStyle = '#000000'
      ctx.fillRect(0, 0, W, H)

      const chroma = 2 * scl
      if (energy > 0.06) {
        drawBarcodeLayer(ctx, W, H, smoothed, hueOffsetRef.current, bi, -chroma, 'r', isVertical, barWidth, barStep, maxBarH, barCount)
        drawBarcodeLayer(ctx, W, H, smoothed, hueOffsetRef.current, bi, 0, 'g', isVertical, barWidth, barStep, maxBarH, barCount)
        drawBarcodeLayer(ctx, W, H, smoothed, hueOffsetRef.current, bi, chroma, 'b', isVertical, barWidth, barStep, maxBarH, barCount)
      } else {
        drawBarcodeLayer(ctx, W, H, smoothed, hueOffsetRef.current, bi, 0, 'r', isVertical, barWidth, barStep, maxBarH, barCount)
        drawBarcodeLayer(ctx, W, H, smoothed, hueOffsetRef.current, bi, 0, 'g', isVertical, barWidth, barStep, maxBarH, barCount)
        drawBarcodeLayer(ctx, W, H, smoothed, hueOffsetRef.current, bi, 0, 'b', isVertical, barWidth, barStep, maxBarH, barCount)
      }

      const glitchShift = 60 * scl
      const sliceH = Math.max(6, Math.round(10 * scl))
      if (beat) {
        glitchRef.current = Array.from({ length: 5 }, () => ({
          y: Math.random() * H,
          offset: (Math.random() - 0.5) * glitchShift,
          frames: 3,
        }))

        vGlitchFramesRef.current = 3
        vGlitchOffsetRef.current = (Math.random() - 0.5) * 6 * scl
      }

      const activeGlitches: GlitchSlice[] = []
      for (const g of glitchRef.current) {
        if (g.frames > 0) {
          const safeY = Math.max(0, Math.min(H - sliceH, Math.floor(g.y)))
          const imgData = ctx.getImageData(0, safeY, W, sliceH)
          ctx.putImageData(imgData, Math.floor(g.offset), safeY)
          g.frames--
          activeGlitches.push(g)
        }
      }
      glitchRef.current = activeGlitches

      if (vGlitchFramesRef.current > 0) {
        const halfW = Math.floor(W / 2)
        const imgData = ctx.getImageData(halfW, 0, halfW, H)
        ctx.putImageData(imgData, halfW, Math.floor(vGlitchOffsetRef.current))
        vGlitchFramesRef.current--
      }

      drawScanlines(ctx, W, H, scl)

      drawTrackTitle(ctx, W, H, bi, trackInfo.title)

      drawParticles(ctx, W, H, bi, flareScaleRef.current, scl)

      drawGrain(ctx, W, H)

      ctx.setTransform(1, 0, 0, 1, 0, 0)

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
