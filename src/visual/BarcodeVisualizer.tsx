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