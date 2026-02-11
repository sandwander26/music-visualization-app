import { useEffect, useRef } from 'react'
import { useAudioStore } from '../store/audioStore'
import { useVisualizerParams } from '../presets/useVisualizerParams'

interface GalaxyParams {
  starCount: number
  speed: number
  hueShift: number
  nebulaIntensity: number
  trailFade: number
}

const MAX_STAR_COUNT = 5000
const MAX_DEPTH = 2000
const FOCAL_LENGTH = 300
const BASE_SPEED = 1.5
const MAX_ENERGY_SPEED = 15
const SHAKE_DECAY = 0.85
const SHAKE_STRENGTH = 5
const NEBULA_CLOUD_COUNT = 5
const NEBULA_GRADIENTS_PER_CLOUD = 3
const WARP_FLASH_DECAY = 0.85
const BEAT_SPEED_BURST = 8
const CLOUD_LAYER_COUNT = 15
const CLOUD_MAX_ACTIVE = 3
const CLOUD_MAX_FRAMES = 35
const CLOUD_DECAY = 0.93
const SHOOTING_STAR_MIN_INTERVAL = 180 // ~3с при 60fps
const SHOOTING_STAR_MAX_INTERVAL = 480 // ~8с
const SHOOTING_STAR_SPEED = 12
const SHOOTING_STAR_TRAIL_LENGTH = 25
const FREQ_BANDS = 8
const HUE_SHIFT_SPEED = 0.05 // полный цикл ~2мин
const enum StarColor { White, WarmYellow, Bright }

interface NebulaGradient {
  offsetX: number
  offsetY: number
  radius: number
  r: number
  g: number
  b: number
  baseAlpha: number
}

interface NebulaCloud {
  x: number
  y: number
  vx: number
  vy: number
  gradients: NebulaGradient[]
}

const NEBULA_PALETTES: Array<[number, number, number, number][]> = [
  [[30, 50, 150, 0.06], [40, 30, 170, 0.05], [20, 60, 130, 0.04]],
  [[80, 20, 120, 0.05], [100, 10, 140, 0.04], [60, 30, 110, 0.05]],
  [[10, 80, 100, 0.04], [20, 70, 120, 0.05], [10, 90, 80, 0.04]],
  [[50, 30, 140, 0.05], [30, 50, 150, 0.06], [80, 20, 120, 0.04]],
  [[10, 80, 100, 0.04], [80, 20, 120, 0.05], [30, 50, 150, 0.05]],
]

function createNebulaCloud(lw: number, lh: number, paletteIdx: number): NebulaCloud {
  const palette = NEBULA_PALETTES[paletteIdx % NEBULA_PALETTES.length]
  const gradients: NebulaGradient[] = []
  for (let i = 0; i < NEBULA_GRADIENTS_PER_CLOUD; i++) {
    const [r, g, b, baseAlpha] = palette[i]
    gradients.push({
      offsetX: (Math.random() - 0.5) * 100,
      offsetY: (Math.random() - 0.5) * 100,
      radius: 200 + Math.random() * 300,
      r, g, b, baseAlpha,
    })
  }
  return {
    x: Math.random() * lw,
    y: Math.random() * lh,
    vx: (Math.random() - 0.5) * 0.04,
    vy: (Math.random() - 0.5) * 0.04,
    gradients,
  }
}

interface CloudLayer {
  ox: number
  oy: number
  z: number
  vx: number
  vy: number
  baseRadius: number
  angle: number
}

interface VolumetricCloud {
  x: number
  y: number
  layers: CloudLayer[]
  opacity: number
  age: number
}

function createVolumetricCloud(x: number, y: number): VolumetricCloud {
  const layers: CloudLayer[] = []
  for (let i = 0; i < CLOUD_LAYER_COUNT; i++) {
    layers.push({
      ox: (Math.random() - 0.5) * 60,
      oy: (Math.random() - 0.5) * 60,
      z: (Math.random() - 0.5) * 100,
      vx: (Math.random() - 0.5),
      vy: (Math.random() - 0.5),
      baseRadius: 40 + Math.random() * 80,
      angle: Math.random() * Math.PI * 2,
    })
  }
  layers.sort((a, b) => a.z - b.z)
  return { x, y, layers, opacity: 0.6, age: 0 }
}

interface ShootingStar {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  trail: Array<{ x: number; y: number }>
}

function createShootingStar(lw: number, lh: number): ShootingStar {
  const edge = Math.floor(Math.random() * 4)
  let x: number, y: number, vx: number, vy: number
  const speed = SHOOTING_STAR_SPEED * (0.8 + Math.random() * 0.4)
  const angle = (Math.random() * 0.6 + 0.2) * Math.PI // диагональ

  if (edge === 0) {
    x = Math.random() * lw; y = -10
    vx = Math.cos(angle) * speed * (Math.random() > 0.5 ? 1 : -1)
    vy = Math.abs(Math.sin(angle)) * speed
  } else if (edge === 1) {
    x = lw + 10; y = Math.random() * lh
    vx = -Math.abs(Math.cos(angle)) * speed
    vy = Math.sin(angle) * speed * (Math.random() > 0.5 ? 1 : -1)
  } else if (edge === 2) {
    x = Math.random() * lw; y = lh + 10
    vx = Math.cos(angle) * speed * (Math.random() > 0.5 ? 1 : -1)
    vy = -Math.abs(Math.sin(angle)) * speed
  } else {
    x = -10; y = Math.random() * lh
    vx = Math.abs(Math.cos(angle)) * speed
    vy = Math.sin(angle) * speed * (Math.random() > 0.5 ? 1 : -1)
  }

  return { x, y, vx, vy, life: 0, maxLife: 60 + Math.floor(Math.random() * 40), trail: [] }
}

interface Star {
  x: number
  y: number
  z: number
  prevScreenX: number
  prevScreenY: number
  colorType: StarColor
  hue: number
  baseR: number
  baseG: number
  baseB: number
  twinklePhase: number
  twinkleSpeed: number
}

function createStar(spreadZ: boolean, w: number, h: number): Star {
  const x = (Math.random() - 0.5) * w * 2.5
  const y = (Math.random() - 0.5) * h * 2.5
  const z = spreadZ ? Math.random() * MAX_DEPTH + 1 : MAX_DEPTH

  const roll = Math.random()
  let colorType: StarColor
  let hue = 0
  let baseR = 1, baseG = 1, baseB = 1

  if (roll < 0.80) {
    colorType = StarColor.White
    const blue = Math.random() > 0.5
    baseR = blue ? 0.75 : 1.0
    baseG = blue ? 0.85 : 1.0
    baseB = 1.0
  } else if (roll < 0.95) {
    colorType = StarColor.WarmYellow
    baseR = 1.0
    baseG = 0.85
    baseB = 0.5
  } else {
    colorType = StarColor.Bright
    hue = Math.random() * 360
    baseR = 1
    baseG = 1
    baseB = 1
  }

  const screenX = (x - w / 2) * (FOCAL_LENGTH / z) + w / 2
  const screenY = (y - h / 2) * (FOCAL_LENGTH / z) + h / 2

  return {
    x, y, z, prevScreenX: screenX, prevScreenY: screenY,
    colorType, hue, baseR, baseG, baseB,
    twinklePhase: Math.random() * Math.PI * 2,
    twinkleSpeed: 0.02 + Math.random() * 0.06,
  }
}

export function StarfieldVisualizer() {
  const mountRef = useRef<HTMLCanvasElement>(null)
  const params = useVisualizerParams<GalaxyParams>('galaxy')
  const paramsRef = useRef(params)
  paramsRef.current = params

  const { beat, audioData, energy, isPlaying } = useAudioStore()

  const beatRef = useRef(beat)
  const audioDataRef = useRef(audioData)
  const energyRef = useRef(energy)
  const isPlayingRef = useRef(isPlaying)
  beatRef.current = beat
  audioDataRef.current = audioData
  energyRef.current = energy
  isPlayingRef.current = isPlaying

  useEffect(() => {
    const canvas = mountRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    let w = window.innerWidth * dpr
    let h = window.innerHeight * dpr
    canvas.width = w
    canvas.height = h
    canvas.style.width = window.innerWidth + 'px'
    canvas.style.height = window.innerHeight + 'px'
    ctx.scale(dpr, dpr)
    let lw = window.innerWidth
    let lh = window.innerHeight

    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, lw, lh)

    const stars: Star[] = []
    const initialCount = Math.max(500, Math.min(MAX_STAR_COUNT, Math.floor(paramsRef.current.starCount)))
    for (let i = 0; i < initialCount; i++) {
      stars.push(createStar(true, lw, lh))
    }

    const nebulaClouds: NebulaCloud[] = []