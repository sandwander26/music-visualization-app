import { useEffect, useRef } from 'react'
import { useAudioStore } from '../store/audioStore'
import { useVisualizerParams } from '../presets/useVisualizerParams'

const POINTS = 128
const TWO_PI = Math.PI * 2

interface CircularParams {
  ringSize: number
  displace: number
  rotationSpeed: number
  sparkRate: number
  glow: number
}

const RING_CONFIGS = [
  { base: 70, displace: 40, lineW: 3, rotSpeed: 0.004, band: 'bass' as const },
  { base: 110, displace: 75, lineW: 2, rotSpeed: -0.003, band: 'mid' as const },
  { base: 150, displace: 55, lineW: 1.5, rotSpeed: 0.006, band: 'high' as const },
]

interface Spark {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  life: number
  maxLife: number
}

export function CircularVisualizer() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef(0)

  const params = useVisualizerParams<CircularParams>('circular')
  const paramsRef = useRef(params)
  paramsRef.current = params

  const beat = useAudioStore((s) => s.beat)
  const audioData = useAudioStore((s) => s.audioData)
  const energy = useAudioStore((s) => s.energy)
  const isPlaying = useAudioStore((s) => s.isPlaying)
  const trackInfo = useAudioStore((s) => s.trackInfo)

  const beatRef = useRef(beat)
  const audioDataRef = useRef(audioData)
  const energyRef = useRef(energy)
  const isPlayingRef = useRef(isPlaying)
  const trackInfoRef = useRef(trackInfo)
  beatRef.current = beat
  audioDataRef.current = audioData
  energyRef.current = energy
  isPlayingRef.current = isPlaying
  trackInfoRef.current = trackInfo

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const smoothed = RING_CONFIGS.map(() => new Float32Array(POINTS))
    const rotations = RING_CONFIGS.map(() => 0)

    const sparks: Spark[] = []

    const shake = { x: 0, y: 0, vx: 0, vy: 0, rot: 0, vr: 0, trauma: 0 }
    let kickX = 0
    let kickY = 0

    const drift = { x: 0, y: 0, rot: 0 }
    let timeFrame = 0

    let beatScale = 1.0
    let prevBeat = false

    let trackOpacity = 0
    let lastTitle = ''

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

      const W = canvas.width
      const H = canvas.height
      const cx = W / 2
      const cy = H / 2
      const minDim = Math.min(W, H)
      const sizeScale = minDim / 1080
      const shakeScale = minDim / 900
      const data = audioDataRef.current
      const curBeat = beatRef.current
      const curEnergy = energyRef.current

      timeFrame++

      const pp = paramsRef.current
      const ringSizeMul = Math.max(0, pp.ringSize)
      const displaceMul = Math.max(0, pp.displace)
      const rotSpeedMul = Math.max(0, pp.rotationSpeed)
      const sparkRateMul = Math.max(0, pp.sparkRate)
      const glowMul = Math.max(0, pp.glow)

      ctx.fillStyle = 'rgba(4,8,6,0.22)'
      ctx.fillRect(0, 0, W, H)

      const beatHit = curBeat && !prevBeat
      prevBeat = curBeat
      if (beatHit) {
        shake.trauma = Math.min(1, shake.trauma + (curEnergy > 0.05 ? 1.2 : 0.7))
        const kickAngle = Math.random() * TWO_PI
        const kickPower = (curEnergy > 0.05 ? 18 : 10) * shakeScale
        kickX = Math.cos(kickAngle) * kickPower
        kickY = Math.sin(kickAngle) * kickPower
        beatScale = curEnergy > 0.05 ? 1.08 : 1.04
      }
      beatScale += (1 - beatScale) * 0.12
      kickX *= 0.7
      kickY *= 0.7

      shake.trauma *= 0.88
      const tPow = shake.trauma * shake.trauma
      const pt = performance.now() * 0.015
      const tX = (Math.sin(pt * 2.1) + Math.sin(pt * 3.7)) * 0.5 * tPow * 14 * shakeScale
      const tY = (Math.sin(pt * 1.9) + Math.sin(pt * 3.3)) * 0.5 * tPow * 11 * shakeScale
      const tR = Math.sin(pt * 2.5) * tPow * 0.025
      shake.vx += (tX - shake.x) * 0.4; shake.vx *= 0.55; shake.x += shake.vx
      shake.vy += (tY - shake.y) * 0.4; shake.vy *= 0.55; shake.y += shake.vy
      shake.vr += (tR - shake.rot) * 0.4; shake.vr *= 0.55; shake.rot += shake.vr

      const tt = timeFrame
      drift.x += (Math.sin(tt * 0.011) * 18 * shakeScale + Math.sin(tt * 0.027) * 7 * shakeScale - drift.x) * 0.06
      drift.y += (Math.cos(tt * 0.009) * 14 * shakeScale + Math.sin(tt * 0.023) * 5 * shakeScale - drift.y) * 0.06
      drift.rot += (Math.sin(tt * 0.007) * 0.015 - drift.rot) * 0.06

      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate(drift.rot + shake.rot)
      ctx.scale(beatScale, beatScale)
      ctx.translate(-cx + drift.x + shake.x + kickX, -cy + drift.y + shake.y + kickY)

      const atmGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, minDim * (400 / 1080))
      atmGrad.addColorStop(0, 'rgba(0,255,120,0.08)')
      atmGrad.addColorStop(0.5, 'rgba(0,180,80,0.04)')
      atmGrad.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = atmGrad
      ctx.fillRect(0, 0, W, H)

      for (let r = 0; r < RING_CONFIGS.length; r++) {
        const cfg = RING_CONFIGS[r]
        const smArr = smoothed[r]

        let start = 0, end = 128, mult = 1
        if (cfg.band === 'bass') { start = 0; end = 32; mult = 1.2 }
        if (cfg.band === 'mid') { start = 32; end = 80; mult = 1 }
        if (cfg.band === 'high') { start = 80; end = 128; mult = 0.9 }

        for (let i = 0; i < POINTS; i++) {
          const dataIdx = start + Math.floor((i / POINTS) * (end - start))
          const raw = (data[dataIdx] ?? 0) * mult
          smArr[i] = smArr[i] * 0.5 + raw * 0.5
        }

        rotations[r] += cfg.rotSpeed * rotSpeedMul
        const rot = rotations[r]

        const pts: { x: number; y: number; amp: number }[] = []
        for (let i = 0; i < POINTS; i++) {
          const angle = (i / POINTS) * TWO_PI + rot
          const amp = smArr[i]
          const radius = (cfg.base * ringSizeMul + amp * cfg.displace * displaceMul) * sizeScale
          pts.push({
            x: cx + Math.cos(angle) * radius,
            y: cy + Math.sin(angle) * radius,
            amp,
          })
        }

        let ringColor: string
        if (cfg.band === 'bass') ringColor = `rgba(0,255,100,1)`
        else if (cfg.band === 'mid') ringColor = `rgba(80,255,160,1)`
        else ringColor = `rgba(180,255,220,1)`

        ctx.save()
        ctx.shadowBlur = 25 * glowMul
        ctx.shadowColor = ringColor
        ctx.strokeStyle = ringColor
        ctx.lineWidth = cfg.lineW >= 3 ? cfg.lineW * sizeScale : cfg.lineW
        ctx.beginPath()
        for (let i = 0; i <= POINTS; i++) {
          const p = pts[i % POINTS]
          if (i === 0) ctx.moveTo(p.x, p.y)
          else ctx.lineTo(p.x, p.y)
        }
        ctx.closePath()
        ctx.stroke()
        ctx.restore()

        // искры на пиках деформации
        for (let i = 0; i < POINTS; i += 4) {
          if (pts[i].amp > 0.25 && Math.random() < 0.15 * sparkRateMul) {
            const angle = (i / POINTS) * TWO_PI + rot
            sparks.push({
              x: pts[i].x,
              y: pts[i].y,
              vx: Math.cos(angle) * (1 + Math.random() * 2),
              vy: Math.sin(angle) * (1 + Math.random() * 2),
              size: 1 + Math.random() * 1.5,
              life: 20 + Math.random() * 15,
              maxLife: 35,
            })
          }
        }
      }

      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i]
        s.x += s.vx
        s.y += s.vy
        s.vx *= 0.95
        s.vy *= 0.95
        s.life--
        if (s.life <= 0) { sparks.splice(i, 1); continue }
        const a = s.life / s.maxLife
        const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.size * 5)
        g.addColorStop(0, `rgba(120,255,160,${a * 0.6})`)
        g.addColorStop(1, 'rgba(0,255,100,0)')
        ctx.fillStyle = g
        ctx.fillRect(s.x - s.size * 5, s.y - s.size * 5, s.size * 10, s.size * 10)
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.size * a, 0, TWO_PI)
        ctx.fillStyle = `rgba(220,255,230,${a})`
        ctx.fill()
      }

      ctx.fillStyle = 'rgba(0,255,100,0.02)'
      for (let i = 0; i < 180; i++) {
        ctx.fillRect(Math.random() * W, Math.random() * H, 1, 1)
      }

      const vign = ctx.createRadialGradient(cx, cy, Math.min(W, H) * 0.3, cx, cy, Math.max(W, H) * 0.7)
      vign.addColorStop(0, 'rgba(0,0,0,0)')
      vign.addColorStop(1, 'rgba(0,0,0,0.55)')
      ctx.fillStyle = vign
      ctx.fillRect(0, 0, W, H)

      ctx.restore()

      const hasTrack = trackInfoRef.current.title.length > 0
      if (hasTrack && lastTitle !== trackInfoRef.current.title) {
        trackOpacity = 0
        lastTitle = trackInfoRef.current.title
      }
      if (hasTrack) trackOpacity = Math.min(1, trackOpacity + 0.02)
      else trackOpacity = Math.max(0, trackOpacity - 0.02)

      if (trackOpacity > 0.01) {
        ctx.textAlign = 'center'
        if (trackInfoRef.current.artist) {
          ctx.font = `600 ${Math.round(minDim * 0.014)}px monospace`
          ctx.letterSpacing = '3px'
          ctx.fillStyle = `rgba(150,255,180,${0.6 * trackOpacity})`
          ctx.fillText(trackInfoRef.current.artist.toUpperCase(), cx, H * 0.88)
        }
        ctx.font = `600 ${Math.round(minDim * 0.02)}px monospace`
        ctx.letterSpacing = '0px'
        ctx.fillStyle = `rgba(220,255,230,${trackOpacity})`
        ctx.fillText(trackInfoRef.current.title, cx, H * 0.92)
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
            background: '#040806',
          }}
      />
  )
}