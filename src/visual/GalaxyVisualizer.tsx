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
    for (let i = 0; i < NEBULA_CLOUD_COUNT; i++) {
      nebulaClouds.push(createNebulaCloud(lw, lh, i))
    }

    let prevBeat = false
    let driftTime = 0
    let shakeX = 0
    let shakeY = 0
    let beatFlash = 0
    let warpFlash = 0
    let currentSpeed = 0
    let rafId = 0
    const smokeClouds: VolumetricCloud[] = []
    const shootingStars: ShootingStar[] = []
    let nextShootingStarIn = SHOOTING_STAR_MIN_INTERVAL + Math.floor(Math.random() * (SHOOTING_STAR_MAX_INTERVAL - SHOOTING_STAR_MIN_INTERVAL))
    let globalHue = 0
    let camOffsetX = 0
    let camOffsetY = 0

    const FRAME_INTERVAL = 1000 / 60
    let lastFrameTime = 0

    function animate(): void {
      const now = performance.now()
      const elapsed = now - lastFrameTime
      if (elapsed < FRAME_INTERVAL) {
        rafId = requestAnimationFrame(animate)
        return
      }
      lastFrameTime = now - (elapsed % FRAME_INTERVAL)

      ctx!.clearRect(0, 0, lw, lh)
      const energy = energyRef.current
      const beat = beatRef.current
      const minDim = Math.min(lw, lh)
      const scl = minDim / 1080
      const shakeScl = minDim / 900

      const pp = paramsRef.current
      const desiredStarCount = Math.max(500, Math.min(MAX_STAR_COUNT, Math.floor(pp.starCount)))
      const speedMult = Math.max(0, pp.speed)
      const userHueShift = pp.hueShift
      const nebulaMult = Math.max(0, pp.nebulaIntensity)
      const trailFadeBase = Math.max(0, pp.trailFade)

      while (stars.length < desiredStarCount) stars.push(createStar(true, lw, lh))
      if (stars.length > desiredStarCount) stars.length = desiredStarCount
      const activeStars = stars.length

      const beatFront = beat && !prevBeat
      prevBeat = beat

      const targetSpeed = (BASE_SPEED + energy * MAX_ENERGY_SPEED) * speedMult
      currentSpeed += (targetSpeed - currentSpeed) * 0.08

      if (beatFront) {
        shakeX = (Math.random() - 0.5) * 2 * SHAKE_STRENGTH * shakeScl
        shakeY = (Math.random() - 0.5) * 2 * SHAKE_STRENGTH * shakeScl
        beatFlash = 1
        warpFlash = 1
        currentSpeed += BEAT_SPEED_BURST
        if (smokeClouds.length >= CLOUD_MAX_ACTIVE) smokeClouds.shift()
        smokeClouds.push(createVolumetricCloud(Math.random() * lw, Math.random() * lh))
      }
      shakeX *= SHAKE_DECAY
      shakeY *= SHAKE_DECAY
      beatFlash *= 0.9
      warpFlash *= WARP_FLASH_DECAY

      nextShootingStarIn--
      if (nextShootingStarIn <= 0) {
        shootingStars.push(createShootingStar(lw, lh))
        nextShootingStarIn = SHOOTING_STAR_MIN_INTERVAL + Math.floor(Math.random() * (SHOOTING_STAR_MAX_INTERVAL - SHOOTING_STAR_MIN_INTERVAL))
      }
      if (beatFront && Math.random() < 0.5) {
        shootingStars.push(createShootingStar(lw, lh))
        if (Math.random() < 0.3) shootingStars.push(createShootingStar(lw, lh))
      }

      globalHue = (globalHue + HUE_SHIFT_SPEED) % 360

      const audioData = audioDataRef.current
      const bandEnergies = new Float32Array(FREQ_BANDS)
      if (audioData.length > 0) {
        const bandSize = Math.floor(audioData.length / FREQ_BANDS)
        for (let b = 0; b < FREQ_BANDS; b++) {
          let sum = 0
          const start = b * bandSize
          for (let j = start; j < start + bandSize && j < audioData.length; j++) {
            sum += Math.abs(audioData[j])
          }
          bandEnergies[b] = sum / bandSize
        }
      }

      driftTime++
      camOffsetX = Math.sin(driftTime * 0.08) * 12 * shakeScl
      camOffsetY = Math.cos(driftTime * 0.06) * 8 * shakeScl
      const cx = lw / 2 + shakeX + camOffsetX
      const cy = lh / 2 + shakeY + camOffsetY

      const trailAlpha = Math.min(0.35, trailFadeBase + currentSpeed * 0.015)
      ctx!.fillStyle = `rgba(0, 0, 0, ${trailAlpha})`
      ctx!.fillRect(0, 0, lw, lh)

      for (let ni = 0; ni < NEBULA_CLOUD_COUNT; ni++) {
        const cloud = nebulaClouds[ni]
        cloud.x += cloud.vx
        cloud.y += cloud.vy
        const maxR = 500
        if (cloud.x > lw + maxR) cloud.x = -maxR
        if (cloud.x < -maxR) cloud.x = lw + maxR
        if (cloud.y > lh + maxR) cloud.y = -maxR
        if (cloud.y < -maxR) cloud.y = lh + maxR

        for (let gi = 0; gi < cloud.gradients.length; gi++) {
          const g = cloud.gradients[gi]
          const gx = cloud.x + g.offsetX
          const gy = cloud.y + g.offsetY
          const alpha = Math.min(0.08, g.baseAlpha + energy * 0.1) * nebulaMult
          if (alpha <= 0) continue
          const hRad = ((globalHue + userHueShift) % 360) * Math.PI / 180
          const cosH = Math.cos(hRad), sinH = Math.sin(hRad)
          const nr = Math.max(0, Math.min(255, Math.round(g.r * cosH - g.b * sinH * 0.3 + g.g * sinH * 0.3)))
          const ng = Math.max(0, Math.min(255, Math.round(g.g * cosH - g.r * sinH * 0.3 + g.b * sinH * 0.3)))
          const nb = Math.max(0, Math.min(255, Math.round(g.b * cosH - g.g * sinH * 0.3 + g.r * sinH * 0.3)))
          const gr = g.radius * scl
          const grad = ctx!.createRadialGradient(gx, gy, 0, gx, gy, gr)
          grad.addColorStop(0, `rgba(${nr},${ng},${nb},${alpha})`)
          grad.addColorStop(1, `rgba(${nr},${ng},${nb},0)`)
          ctx!.fillStyle = grad
          ctx!.fillRect(gx - gr, gy - gr, gr * 2, gr * 2)
        }
      }

      const starScreenX = new Float32Array(activeStars)
      const starScreenY = new Float32Array(activeStars)
      const starVisible = new Uint8Array(activeStars)

      for (let i = 0; i < activeStars; i++) {
        const star = stars[i]

        const prevSX = star.prevScreenX
        const prevSY = star.prevScreenY

        star.z -= currentSpeed

        if (star.z < 1) {
          stars[i] = createStar(false, lw, lh)
          continue
        }

        const normalX = (star.x - lw / 2) * (FOCAL_LENGTH / star.z) + cx
        const normalY = (star.y - lh / 2) * (FOCAL_LENGTH / star.z) + cy

        const screenX = normalX
        const screenY = normalY

        let size = Math.max(0.5, FOCAL_LENGTH / star.z * 2) * scl

        if (warpFlash > 0.01) {
          size *= 1 + warpFlash * 0.5
        }

        star.prevScreenX = screenX
        star.prevScreenY = screenY
        starScreenX[i] = screenX
        starScreenY[i] = screenY
        starVisible[i] = 1

        const depthBrightness = Math.pow(1 - star.z / MAX_DEPTH, 1.5)

        // цвет зависит от скорости
        const speedFactor = currentSpeed / (BASE_SPEED + MAX_ENERGY_SPEED)
        const depthFactor = 1 - star.z / MAX_DEPTH

        let r: number, g: number, b: number

        if (star.colorType === StarColor.Bright) {
          const hRad = star.hue * Math.PI / 180
          r = Math.max(0, Math.cos(hRad)) * 0.5 + 0.5
          g = Math.max(0, Math.cos(hRad - 2.094)) * 0.5 + 0.5
          b = Math.max(0, Math.cos(hRad + 2.094)) * 0.5 + 0.5
        } else {
          const t = depthFactor * speedFactor
          r = star.baseR * (0.667 + t * 0.333)
          g = star.baseG * (0.8 + t * 0.133)
          b = star.baseB * (1.0 - t * 0.2)
        }

        if (beatFlash > 0.01) {
          r = r + (1 - r) * beatFlash
          g = g + (1 - g) * beatFlash
          b = b + (1 - b) * beatFlash
        }

        star.twinklePhase += star.twinkleSpeed
        const twinkle = 0.7 + Math.sin(star.twinklePhase) * 0.3

        const bandIdx = Math.min(FREQ_BANDS - 1, Math.floor((screenX / lw) * FREQ_BANDS))
        const freqBoost = bandIdx >= 0 && bandIdx < FREQ_BANDS ? bandEnergies[bandIdx] * 2 : 0

        const alpha = Math.min(1, (depthBrightness * 1.5 + 0.1) * twinkle + freqBoost)

        const cr = Math.floor(r * 255)
        const cg = Math.floor(g * 255)
        const cb = Math.floor(b * 255)
        const color = `rgba(${cr},${cg},${cb},${alpha})`

        const dx = screenX - prevSX
        const dy = screenY - prevSY
        const trailLen = Math.sqrt(dx * dx + dy * dy)
        const TAIL_DOTS = 5

        if (trailLen > 1.5 && currentSpeed > 0.5) {
          for (let d = 0; d < TAIL_DOTS; d++) {
            const t = d / TAIL_DOTS
            const dotX = prevSX + dx * t
            const dotY = prevSY + dy * t
            const dotSize = size * (0.2 + t * 0.6)
            const dotAlpha = alpha * (0.1 + t * 0.8)
            ctx!.beginPath()
            ctx!.arc(dotX, dotY, dotSize, 0, Math.PI * 2)
            ctx!.fillStyle = `rgba(${cr},${cg},${cb},${dotAlpha})`
            ctx!.fill()
          }
        }

        if (star.z < 200) {
          ctx!.shadowBlur = size * 4
          ctx!.shadowColor = `rgb(${cr},${cg},${cb})`
        }

        ctx!.beginPath()
        ctx!.arc(screenX, screenY, size, 0, Math.PI * 2)
        ctx!.fillStyle = color
        ctx!.fill()

        if (star.z < 200) {
          ctx!.shadowBlur = 0
        }
      }

      const lineAlpha = beatFlash > 0.01 ? 0.08 : 0.025
      ctx!.strokeStyle = `rgba(180,200,255,${lineAlpha})`
      ctx!.lineWidth = 0.4
      ctx!.beginPath()
      const constMax = 80 * scl
      const constMaxSq = constMax * constMax
      for (let i = 0; i < activeStars; i++) {
        if (!starVisible[i]) continue
        const sx = starScreenX[i]
        const sy = starScreenY[i]
        if (sx < -50 || sx > lw + 50 || sy < -50 || sy > lh + 50) continue
        let links = 0
        for (let j = i + 1; j < activeStars; j++) {
          if (!starVisible[j] || links >= 2) break
          const dx = starScreenX[j] - sx
          const dy = starScreenY[j] - sy
          if (Math.abs(dx) > constMax || Math.abs(dy) > constMax) continue
          if (dx * dx + dy * dy > constMaxSq) continue
          ctx!.moveTo(sx, sy)
          ctx!.lineTo(starScreenX[j], starScreenY[j])
          links++
        }
      }
      ctx!.stroke()

      if (smokeClouds.length > 0) {
        ctx!.globalCompositeOperation = 'screen'
        ctx!.filter = 'blur(8px)'

        for (let si = smokeClouds.length - 1; si >= 0; si--) {
          const cloud = smokeClouds[si]
          cloud.age++
          cloud.opacity *= CLOUD_DECAY

          if (cloud.age > CLOUD_MAX_FRAMES) {
            smokeClouds.splice(si, 1)
            continue
          }

          for (let li = 0; li < cloud.layers.length; li++) {
            const layer = cloud.layers[li]
            layer.ox += layer.vx * 0.3
            layer.oy += layer.vy * 0.3
            layer.angle += 0.02

            const layerSize = layer.baseRadius * (0.5 + layer.z / 100 + 0.5) * scl
            const layerOpacity = cloud.opacity * Math.max(0, 0.5 - Math.abs(layer.z) / 120)
            if (layerOpacity <= 0) continue

            const px = cloud.x + layer.ox + Math.cos(layer.angle) * 3
            const py = cloud.y + layer.oy + Math.sin(layer.angle) * 3

            const grad = ctx!.createRadialGradient(px, py, 0, px, py, layerSize)
            grad.addColorStop(0, `rgba(255,255,255,${layerOpacity})`)
            grad.addColorStop(1, 'rgba(200,220,255,0)')
            ctx!.fillStyle = grad
            ctx!.fillRect(px - layerSize, py - layerSize, layerSize * 2, layerSize * 2)
          }
        }

        ctx!.filter = 'none'
        ctx!.globalCompositeOperation = 'source-over'
      }

      for (let si = shootingStars.length - 1; si >= 0; si--) {
        const ss = shootingStars[si]
        ss.x += ss.vx
        ss.y += ss.vy
        ss.life++
        ss.trail.push({ x: ss.x, y: ss.y })
        if (ss.trail.length > SHOOTING_STAR_TRAIL_LENGTH) ss.trail.shift()

        if (ss.life > ss.maxLife || ss.x < -50 || ss.x > lw + 50 || ss.y < -50 || ss.y > lh + 50) {
          shootingStars.splice(si, 1)
          continue
        }

        for (let ti = 0; ti < ss.trail.length; ti++) {
          const t = ti / ss.trail.length
          const trailAlpha = t * (1 - ss.life / ss.maxLife)
          const trailSize = (1.5 * t + 0.5) * scl
          ctx!.beginPath()
          ctx!.arc(ss.trail[ti].x, ss.trail[ti].y, trailSize, 0, Math.PI * 2)
          ctx!.fillStyle = `rgba(220,230,255,${trailAlpha})`
          ctx!.fill()
        }
        const headAlpha = 1 - ss.life / ss.maxLife
        ctx!.beginPath()
        ctx!.arc(ss.x, ss.y, 2.5 * scl, 0, Math.PI * 2)
        ctx!.fillStyle = `rgba(255,255,255,${headAlpha})`
        ctx!.fill()
        ctx!.shadowBlur = 8 * scl
        ctx!.shadowColor = `rgba(200,220,255,${headAlpha * 0.6})`
        ctx!.beginPath()
        ctx!.arc(ss.x, ss.y, 2 * scl, 0, Math.PI * 2)
        ctx!.fill()
        ctx!.shadowBlur = 0
      }

      const vignetteRadius = Math.max(lw, lh) * 0.75
      const vigGrad = ctx!.createRadialGradient(lw / 2, lh / 2, vignetteRadius * 0.4, lw / 2, lh / 2, vignetteRadius)
      vigGrad.addColorStop(0, 'rgba(0,0,0,0)')
      vigGrad.addColorStop(1, 'rgba(0,0,5,0.8)')
      ctx!.fillStyle = vigGrad
      ctx!.fillRect(0, 0, lw, lh)

      rafId = requestAnimationFrame(animate)
    }

    animate()

    function onResize(): void {
      lw = window.innerWidth
      lh = window.innerHeight
      w = lw * dpr
      h = lh * dpr
      canvas!.width = w
      canvas!.height = h
      canvas!.style.width = lw + 'px'
      canvas!.style.height = lh + 'px'
      ctx!.scale(dpr, dpr)
    }
    window.addEventListener('resize', onResize)

    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  return (
    <canvas
      ref={mountRef}
      style={{ position: 'fixed', inset: 0, zIndex: 0, background: '#000' }}
    />
  )
}
