import { useEffect, useRef } from 'react'
import { useAudioStore } from '../store/audioStore'
import { useVisualizerParams } from '../presets/useVisualizerParams'

interface ParticlesParams {
  particleCount: number
  speed: number
  trailLength: number
  connectionDist: number
  hueShift: number
}

const PARTICLE_COUNT = 200
const MAX_CONNECTIONS = 3
const PULSE_FRAMES = 20

interface TrailPoint {
  x: number
  y: number
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  opacity: number
  hue: number          // 0-360
  orbitDir: 1 | -1    // направление вращения
  life: number
  lifeSpeed: number
  trail: TrailPoint[]
}

function spawnParticle(W: number, H: number, cx?: number, cy?: number): Particle {
  return {
    x: cx ?? Math.random() * W,
    y: cy ?? Math.random() * H,
    vx: (Math.random() - 0.5) * 1.5,
    vy: (Math.random() - 0.5) * 1.5,
    size: 1 + Math.random() * 3,
    opacity: 0.6 + Math.random() * 0.4,
    hue: Math.random() * 360,
    orbitDir: Math.random() > 0.5 ? 1 : -1,
    life: 0.6 + Math.random() * 0.4,
    lifeSpeed: 0.003 + Math.random() * 0.005,
    trail: [],
  }
}

export function ParticlesVisualizer() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)
  const particlesRef = useRef<Particle[]>([])
  const prevBeatRef = useRef<boolean>(false)
  const pulseSizeRef = useRef<number>(1)
  const flashFramesRef = useRef<number>(0)

  const params = useVisualizerParams<ParticlesParams>('particles')
  const paramsRef = useRef(params)
  paramsRef.current = params

  const { beat, audioData, energy } = useAudioStore()

  const beatRef = useRef(beat)
  const audioDataRef = useRef(audioData)
  const energyRef = useRef(energy)
  beatRef.current = beat
  audioDataRef.current = audioData
  energyRef.current = energy

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    function resize() {
      if (!canvas) return
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      particlesRef.current = Array.from({ length: PARTICLE_COUNT }, () =>
        spawnParticle(canvas.width, canvas.height),
      )
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

      const beat = beatRef.current
      const audioData = audioDataRef.current
      const energy = energyRef.current

      const W = canvas.width
      const H = canvas.height
      const cx = W / 2
      const cy = H / 2
      const minDim = Math.min(W, H)
      const sizeScale = minDim / 1080
      const shakeScale = minDim / 900

      const pp = paramsRef.current
      const desiredCount = Math.max(50, Math.min(1000, Math.floor(pp.particleCount)))
      const speedMultParam = Math.max(0, pp.speed)
      const trailLenParam = Math.max(0, Math.min(20, Math.floor(pp.trailLength)))
      const connectionDistParam = Math.max(0, pp.connectionDist)
      const hueShiftParam = pp.hueShift

      while (particlesRef.current.length < desiredCount) {
        particlesRef.current.push(spawnParticle(W, H))
      }

      const connectionDist = connectionDistParam * sizeScale
      const connectionDistSq = connectionDist * connectionDist

      ctx.fillStyle = 'rgba(0,0,0,0.15)'
      ctx.fillRect(0, 0, W, H)

      const beatFront = beat && !prevBeatRef.current
      prevBeatRef.current = beat

      if (beatFront) {
        for (const p of particlesRef.current) {
          p.vx = (Math.random() - 0.5) * 20 * shakeScale
          p.vy = (Math.random() - 0.5) * 20 * shakeScale
        }
        for (let i = 0; i < 30; i++) {
          particlesRef.current.push(spawnParticle(W, H, cx, cy))
        }
        pulseSizeRef.current = 3
        flashFramesRef.current = 2
        for (const p of particlesRef.current) {
          if (Math.random() < 0.3) {
            p.orbitDir = p.orbitDir === 1 ? -1 : 1
          }
        }
      }

      if (pulseSizeRef.current > 1) {
        pulseSizeRef.current = Math.max(1, pulseSizeRef.current - (2 / PULSE_FRAMES))
      }

      const maxAllowed = desiredCount + 30
      if (particlesRef.current.length > maxAllowed) {
        particlesRef.current.splice(0, particlesRef.current.length - maxAllowed)
      }

      const isFlash = flashFramesRef.current > 0
      if (flashFramesRef.current > 0) flashFramesRef.current--

      const connCount = new Int32Array(particlesRef.current.length)
      const ps = particlesRef.current

      for (let i = 0; i < ps.length; i++) {
        if (connCount[i] >= MAX_CONNECTIONS) continue
        const a = ps[i]
        for (let j = i + 1; j < ps.length; j++) {
          if (connCount[i] >= MAX_CONNECTIONS) break
          if (connCount[j] >= MAX_CONNECTIONS) continue
          const dx = a.x - ps[j].x