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
          const dy = a.y - ps[j].y
          const distSq = dx * dx + dy * dy
          if (distSq < connectionDistSq) {
            const dist = Math.sqrt(distSq)
            const lineAlpha = (1 - dist / connectionDist) * 0.35
            ctx.beginPath()
            ctx.moveTo(a.x, a.y)
            ctx.lineTo(ps[j].x, ps[j].y)
            ctx.strokeStyle = isFlash
              ? `rgba(255,255,255,${lineAlpha})`
              : `rgba(140,90,255,${lineAlpha})`
            ctx.lineWidth = 0.5
            ctx.globalAlpha = 1
            ctx.stroke()
            connCount[i]++
            connCount[j]++
          }
        }
      }

      for (let i = ps.length - 1; i >= 0; i--) {
        const p = ps[i]

        const orbitAngle = (0.005 + energy * 0.5) * p.orbitDir
        const cosA = Math.cos(orbitAngle)
        const sinA = Math.sin(orbitAngle)
        const rotVx = p.vx * cosA - p.vy * sinA
        const rotVy = p.vx * sinA + p.vy * cosA
        p.vx = rotVx
        p.vy = rotVy

        if (trailLenParam > 0) {
          p.trail.push({ x: p.x, y: p.y })
          while (p.trail.length > trailLenParam) p.trail.shift()
        } else if (p.trail.length > 0) {
          p.trail.length = 0
        }

        const speedMul = (energy * 50 + 1) * speedMultParam
        p.x += p.vx * speedMul
        p.y += p.vy * speedMul
        p.vx *= 0.97
        p.vy *= 0.97

        p.hue = (p.hue + 0.5) % 360

        p.life -= p.lifeSpeed
        if (p.life <= 0) {
          ps[i] = spawnParticle(W, H)
          continue
        }

        const binIndex = Math.min(
          Math.max(0, Math.floor((p.x / W) * audioData.length)),
          audioData.length - 1,
        )
        const freqVal = audioData[binIndex] ?? 0
        const radius = Math.max(0.5,
          (p.size * (energy * 20 + 1) * pulseSizeRef.current + freqVal * 4) * sizeScale,
        )

        const alpha = p.opacity * p.life
        const renderHue = (p.hue + hueShiftParam) % 360
        const color = isFlash ? '255,255,255' : hslToRgbString(renderHue, 75, 62)

        for (let t = 0; t < p.trail.length; t++) {
          const ratio = (t + 1) / p.trail.length
          const trailAlpha = alpha * ratio * 0.35
          const trailRadius = Math.max(0.3, radius * ratio * 0.55)
          ctx.beginPath()
          ctx.arc(p.trail[t].x, p.trail[t].y, trailRadius, 0, Math.PI * 2)
          ctx.fillStyle = `rgb(${color})`
          ctx.globalAlpha = trailAlpha
          ctx.fill()
        }

        ctx.beginPath()
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2)
        ctx.fillStyle = `rgb(${color})`
        ctx.globalAlpha = alpha
        ctx.fill()
      }

      ctx.globalAlpha = 1
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
        background: '#000000',
      }}
    />
  )
}

function hslToRgbString(h: number, s: number, l: number): string {
  const sn = s / 100
  const ln = l / 100
  const k = (n: number) => (n + h / 30) % 12
  const a = sn * Math.min(ln, 1 - ln)
  const f = (n: number) => ln - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return `${Math.round(f(0) * 255)},${Math.round(f(8) * 255)},${Math.round(f(4) * 255)}`
}
