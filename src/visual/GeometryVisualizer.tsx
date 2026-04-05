import { useEffect, useRef } from 'react'
import { useAudioStore } from '../store/audioStore'
import { useVisualizerParams } from '../presets/useVisualizerParams'

interface GeometryParams {
  shapeCount: number
  sparkMax: number
  gridDensity: number
  beatPunch: number
  glow: number
}

const LINE_SPACING = 35
const VLINE_SPACING = 60
const LERP_BACK = 0.96
const BEAT_SCALE = 1.5
const SCALE_DECAY = 0.88
const FLASH_ALPHA = 0.12
const SPARK_BANDS = 8

type ShapeKind = 'square' | 'diamond' | 'cross' | 'triangle'

interface Spark {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  hue: number
  life: number
  maxLife: number
}

interface GeoShape {
  baseX: number
  baseY: number
  individualPhase: number
  size: number
  kind: ShapeKind
  nested: boolean
  rotation: number
  rotSpeed: number
  freqIndex: number   // индекс частотной полосы
}

interface SyncState {
  globalOffsetX: number
  globalOffsetY: number
  beatScale: number
  flashAlpha: number
  beatFlash: number   // вспышка на бит
  beatFlashTimer: number
  glitchTimer: number
  lineBrightness: number
  energy: number
  time: number
  cameraScaleBurst: number // зум на бит
}

function createShapes(w: number, h: number, count: number): GeoShape[] {
  const shapes: GeoShape[] = []
  const cols = Math.max(1, Math.ceil(Math.sqrt(count)))
  const rows = Math.max(1, Math.ceil(count / cols))
  const cellW = w / (cols + 1)
  const cellH = h / (rows + 1)

  for (let i = 0; i < count; i++) {
    const col = i % cols
    const row = Math.floor(i / cols) % rows
    const baseX = cellW * (col + 1) + (Math.random() - 0.5) * cellW * 0.6
    const baseY = cellH * (row + 1) + (Math.random() - 0.5) * cellH * 0.6
    const size = Math.random() * 8 + 6
    shapes.push({
      baseX,
      baseY,
      individualPhase: Math.random() * Math.PI * 2,
      size,
      kind: ((): ShapeKind => { const r = Math.random(); return r < 0.3 ? 'square' : r < 0.6 ? 'diamond' : r < 0.8 ? 'cross' : 'triangle' })(),
      nested: Math.random() < 0.4,
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.008,
      freqIndex: (i * 5) % 1024,
    })
  }
  return shapes
}

function strokeSquare(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  rotation: number,
  opacity: number,
  glow: number,
  color = '#ffffff',
) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(rotation)
  ctx.globalAlpha = opacity
  ctx.strokeStyle = color
  ctx.lineWidth = 1
  ctx.shadowBlur = glow
  ctx.shadowColor = '#ffffff'
  const s = size / 2
  ctx.strokeRect(-s, -s, size, size)
  ctx.restore()
}

function strokeCross(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  rotation: number,
  opacity: number,
  glow: number,
  color = '#ffffff',
) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(rotation)
  ctx.globalAlpha = opacity
  ctx.strokeStyle = color
  ctx.lineWidth = 1
  ctx.shadowBlur = glow
  ctx.shadowColor = '#ffffff'
  const half = size / 2
  ctx.strokeRect(-1, -half, 2, size)
  ctx.strokeRect(-half, -1, size, 2)
  ctx.restore()
}

function strokeTriangle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  rotation: number,
  opacity: number,
  glow: number,
  color = '#ffffff',
) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(rotation)
  ctx.globalAlpha = opacity
  ctx.strokeStyle = color
  ctx.lineWidth = 1
  ctx.shadowBlur = glow
  ctx.shadowColor = '#ffffff'
  const h = size / 2
  ctx.beginPath()
  ctx.moveTo(0, -h)
  ctx.lineTo(-h, h)
  ctx.lineTo(h, h)
  ctx.closePath()
  ctx.stroke()
  ctx.restore()
}

function drawShape(
  ctx: CanvasRenderingContext2D,
  kind: ShapeKind,
  x: number,
  y: number,
  size: number,
  rotation: number,
  opacity: number,
  glow: number,
  color = '#ffffff',
) {
  if (kind === 'square') {
    strokeSquare(ctx, x, y, size, rotation, opacity, glow, color)
  } else if (kind === 'diamond') {
    strokeSquare(ctx, x, y, size, rotation + Math.PI / 4, opacity, glow, color)
  } else if (kind === 'cross') {
    strokeCross(ctx, x, y, size, rotation, opacity, glow, color)
  } else {
    strokeTriangle(ctx, x, y, size, rotation, opacity, glow, color)
  }
}

export function GeometryVisualizer() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef(0)
  const shapesRef = useRef<GeoShape[]>([])
  const sparksRef = useRef<Spark[]>([])

  const params = useVisualizerParams<GeometryParams>('geometry')
  const paramsRef = useRef(params)
  paramsRef.current = params
  const syncRef = useRef<SyncState>({
    globalOffsetX: 0,
    globalOffsetY: 0,
    beatScale: 1,
    flashAlpha: 0,
    beatFlash: 0,
    beatFlashTimer: 0,
    glitchTimer: 0,
    lineBrightness: 0.08,
    energy: 0,
    time: 0,
    cameraScaleBurst: 0,
  })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let activeShapeCount = paramsRef.current.shapeCount

    function resize() {
      if (!canvas) return
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      activeShapeCount = paramsRef.current.shapeCount
      shapesRef.current = createShapes(canvas.width, canvas.height, activeShapeCount)
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

      const { beat, audioData } = useAudioStore.getState()
      const W = canvas.width
      const H = canvas.height
      const sync = syncRef.current
      const sizeScale = Math.min(W, H) / 900
      const pp = paramsRef.current

      if (pp.shapeCount !== activeShapeCount) {
        activeShapeCount = pp.shapeCount
        shapesRef.current = createShapes(W, H, activeShapeCount)
      }

      let energy = 0
      if (audioData.length > 0) {
        for (let i = 0; i < audioData.length; i++) energy += Math.abs(audioData[i])
        energy /= audioData.length
      }
      sync.energy += (energy - sync.energy) * 0.15

      ctx.fillStyle = '#000000'
      ctx.fillRect(0, 0, W, H)

      sync.time += 1

      sync.globalOffsetX += Math.sin(sync.time * 0.02) * 0.3
      sync.globalOffsetY += Math.cos(sync.time * 0.015) * 0.15

      if (beat) {
        sync.globalOffsetX += (Math.random() - 0.5) * 40 * sizeScale
        sync.globalOffsetY += (Math.random() - 0.5) * 20 * sizeScale
        sync.beatScale = 1 + (BEAT_SCALE - 1) * pp.beatPunch
        sync.flashAlpha = FLASH_ALPHA * pp.beatPunch
        sync.beatFlash = 1.0 * pp.beatPunch
        sync.beatFlashTimer = 2
        sync.glitchTimer = 6
        sync.lineBrightness = 0.18
        sync.cameraScaleBurst += 0.1 * pp.beatPunch
      }

      sync.globalOffsetX *= LERP_BACK
      sync.globalOffsetY *= LERP_BACK

      sync.beatScale = 1 + (sync.beatScale - 1) * SCALE_DECAY

      sync.flashAlpha *= 0.92
      sync.beatFlash *= 0.75
      sync.cameraScaleBurst *= 0.92
      if (sync.beatFlashTimer > 0) sync.beatFlashTimer--
      if (sync.glitchTimer > 0) sync.glitchTimer--
      sync.lineBrightness += (0.08 - sync.lineBrightness) * 0.06

      if (audioData.length >= 128) {
        const sparks = sparksRef.current

        const spawnSpark = (): void => {
          if (sparks.length >= pp.sparkMax) return
          const x = Math.random() * W
          const y = Math.random() * H
          const maxLife = Math.floor(Math.random() * 21) + 20
          sparks.push({
            x,
            y,
            vx: (Math.random() - 0.5) * 1.0 * sizeScale,
            vy: (Math.random() - 0.5) * 1.0 * sizeScale,
            size: (Math.random() * 1.5 + 1.5) * sizeScale,
            hue: Math.random() * 360,
            life: maxLife,
            maxLife,
          })
        }

        // требл [232..929]
        const freqPerBand = Math.floor(697 / SPARK_BANDS) // ~87 бинов на полосу
        for (let b = 0; b < SPARK_BANDS; b++) {
          const freqStart = 232 + b * freqPerBand
          const freqEnd = Math.min(929, freqStart + freqPerBand - 1)
          let bandAmp = 0
          for (let f = freqStart; f <= freqEnd; f++) bandAmp += Math.abs(audioData[f])
          bandAmp /= (freqEnd - freqStart + 1)
          if (bandAmp > 0.04) {
            const count = Math.random() < 0.5 ? 1 : 2
            for (let k = 0; k < count; k++) spawnSpark()
          }
        }

        // искры на бит
        if (beat) {
          const beatCount = Math.floor(Math.random() * 3) + 6
          for (let k = 0; k < beatCount; k++) {
            spawnSpark()
          }
        }

        for (let i = sparks.length - 1; i >= 0; i--) {
          const sp = sparks[i]
          sp.x += sp.vx
          sp.y += sp.vy
          sp.life *= 0.88
          if (sp.life < 0.5) sparks.splice(i, 1)
        }
      }

      const cx = W / 2
      const cy = H / 2
      const cameraX = Math.sin(sync.time * 0.015) * (40 + sync.energy * 60) * sizeScale
      const cameraY = Math.cos(sync.time * 0.012) * (25 + sync.energy * 40) * sizeScale
      const cameraScale = 1.0 + Math.sin(sync.time * 0.02) * 0.08 + sync.energy * 0.15 + sync.cameraScaleBurst
      const cameraRotation = Math.sin(sync.time * 0.01) * 0.02
      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate(cameraRotation)
      ctx.scale(cameraScale, cameraScale)
      ctx.translate(-cx + cameraX, -cy + cameraY)

      const lineOffsetY = sync.globalOffsetY * 0.3
      const lineOffsetX = sync.globalOffsetX * 0.3

      ctx.shadowBlur = 0
      ctx.lineWidth = 1
      ctx.strokeStyle = `rgba(255,255,255,${sync.lineBrightness.toFixed(3)})`
      const hSpace = LINE_SPACING / Math.max(0.1, pp.gridDensity)
      for (let y = 0; y < H + hSpace; y += hSpace) {
        const ly = y + (lineOffsetY % hSpace)
        ctx.beginPath()
        ctx.moveTo(0, ly)
        ctx.lineTo(W, ly)
        ctx.stroke()
      }

      ctx.strokeStyle = 'rgba(255,255,255,0.04)'
      const vSpace = VLINE_SPACING / Math.max(0.1, pp.gridDensity)
      for (let x = 0; x < W + vSpace; x += vSpace) {
        const lx = x + (lineOffsetX % vSpace)
        ctx.beginPath()
        ctx.moveTo(lx, 0)
        ctx.lineTo(lx, H)
        ctx.stroke()
      }

      const shapes = shapesRef.current
      const glow = (sync.glitchTimer > 0 ? 30 : 10 + sync.energy * 40) * pp.glow

      if (sync.glitchTimer > 0) {
        for (let i = 0; i < shapes.length; i++) {
          const s = shapes[i]
          const indX = Math.sin(sync.time * 0.05 + s.individualPhase) * 3 * sizeScale
          const indY = Math.cos(sync.time * 0.04 + s.individualPhase + 1) * 2 * sizeScale
          const x = s.baseX + sync.globalOffsetX + indX + 3 * sizeScale
          const y = s.baseY + sync.globalOffsetY + indY
          const drawSize = s.size * sync.beatScale * sizeScale
          drawShape(ctx, s.kind, x, y, drawSize, s.rotation, 0.15, 0, 'rgba(255,255,255,1)')
          if (s.nested && (s.kind === 'square' || s.kind === 'diamond')) {
            drawShape(ctx, s.kind, x, y, drawSize * 0.6, s.rotation, 0.1, 0, 'rgba(255,255,255,1)')
          }
        }
      }

      for (let i = 0; i < shapes.length; i++) {
        const s = shapes[i]

        let freqMult = 1
        if (audioData.length > s.freqIndex) {
          freqMult = 1 + Math.abs(audioData[s.freqIndex]) * 8
        }
        const drawSize = s.size * sync.beatScale * freqMult * sizeScale

        const indX = Math.sin(sync.time * 0.05 + s.individualPhase) * 3 * sizeScale
        const indY = Math.cos(sync.time * 0.04 + s.individualPhase + 1) * 2 * sizeScale
        const x = s.baseX + sync.globalOffsetX + indX
        const y = s.baseY + sync.globalOffsetY + indY

        s.rotation += s.rotSpeed

        drawShape(ctx, s.kind, x, y, drawSize, s.rotation, 0.9, glow)
        if (s.nested && (s.kind === 'square' || s.kind === 'diamond')) {
          drawShape(ctx, s.kind, x, y, drawSize * 0.6, s.rotation, 0.55, glow * 0.6)
        }
      }

      ctx.restore()

      for (const spark of sparksRef.current) {
        const t = spark.life / spark.maxLife
        const opacity = t * 0.7

        const gradient = ctx.createRadialGradient(spark.x, spark.y, 0, spark.x, spark.y, spark.size * 4)
        gradient.addColorStop(0, `hsla(${spark.hue}, 100%, 80%, ${opacity * 0.4})`)
        gradient.addColorStop(1, `hsla(${spark.hue}, 100%, 60%, 0)`)
        ctx.fillStyle = gradient
        ctx.fillRect(spark.x - spark.size * 4, spark.y - spark.size * 4, spark.size * 8, spark.size * 8)

        ctx.beginPath()
        ctx.arc(spark.x, spark.y, spark.size * 1.2, 0, Math.PI * 2)
        ctx.fillStyle = `hsla(${spark.hue}, 100%, 95%, ${opacity})`
        ctx.shadowBlur = spark.size * 6 * pp.glow
        ctx.shadowColor = `hsl(${spark.hue}, 100%, 70%)`
        ctx.fill()
        ctx.shadowBlur = 0
      }

      if (sync.beatFlashTimer > 0) {
        ctx.shadowBlur = 0
        ctx.fillStyle = 'rgba(255,255,255,0.2)'
        ctx.fillRect(0, 0, W, H)
      }
      if (sync.beatFlash > 0.005) {
        const grad = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.6)
        grad.addColorStop(0, `rgba(255,255,255,${(sync.beatFlash * 0.15).toFixed(4)})`)
        grad.addColorStop(1, 'rgba(255,255,255,0)')
        ctx.shadowBlur = 0
        ctx.fillStyle = grad
        ctx.fillRect(0, 0, W, H)
      }
      if (sync.flashAlpha > 0.001) {
        ctx.fillStyle = `rgba(255,255,255,${sync.flashAlpha.toFixed(4)})`
        ctx.fillRect(0, 0, W, H)
      }

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
