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