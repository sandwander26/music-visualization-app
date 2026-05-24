import { Canvas, extend, useFrame, useThree } from '@react-three/fiber'
import { shaderMaterial } from '@react-three/drei'
import {
  EffectComposer,
  Bloom,
  ChromaticAberration,
  Vignette,
} from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'
import { useRef } from 'react'
import * as THREE from 'three'
import { useAudioStore } from '../store/audioStore'
import { useVisualizerParams } from '../presets/useVisualizerParams'
import { AudioInvalidator } from './_AudioInvalidator'

interface CosmicParams {
  quality: number
  bassReactivity: number
  rotationSpeed: number
  bloomIntensity: number
  paletteIndex: number
  resolutionScale: number
}

const CAMERA = { position: [0, 0, 5] as [number, number, number], fov: 45 }
const BG_COLOR = '#000000'
const CHROMATIC_OFFSET: [number, number] = [0.0015, 0.0015]
const PLANE_SIZE = 2

const PALETTE_COUNT = 6

const VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`

const FRAGMENT_SHADER = /* glsl */ `
  varying vec2 vUv;
  uniform vec2 iResolution;
  uniform float iTime;
  uniform float iAudioBass;
  uniform float iAudioBeatPulse;
  uniform float iAudioTreble;
  uniform float iAudioRMS;
  uniform float iRotationStep;
  uniform float iPaletteIndex;
  uniform float iQuality;
  uniform float iBassReactivity;

  vec3 getPalette(float idx) {
    if (idx < 0.5) return vec3(6.0, 1.0, 2.0);
    if (idx < 1.5) return vec3(1.0, 0.5, 0.0);
    if (idx < 2.5) return vec3(3.0, 2.0, 1.0);
    if (idx < 3.5) return vec3(0.5, 1.5, 3.0);
    if (idx < 4.5) return vec3(2.0, 4.0, 5.0);
    return vec3(4.0, 0.5, 2.5);
  }

  void main() {
    vec2 fragCoord = vUv * iResolution;
    vec4 O = vec4(0.0);

    float blackHoleRadius = 4.0 + iAudioBass * 6.0 * iBassReactivity + iAudioBeatPulse * 2.0;

    float z = 0.0;
    for (float i = 0.0; i < 14.0; i++) {
      if (i >= iQuality) break;
      vec3 p = z * normalize(
        vec3(fragCoord + fragCoord, 0.0)
          - vec3(iResolution.x, iResolution.y, iResolution.x)
      ) + 0.1;

      float angle = atan(p.y / 0.2, p.x) * 2.0 + iRotationStep;

      float c = cos(iRotationStep);
      float s = sin(iRotationStep);
      vec2 rotatedXY = vec2(
        p.x * c - p.y * s,
        p.x * s + p.y * c
      );
      float rawAngle = atan(rotatedXY.y, rotatedXY.x);

      p = vec3(
        angle,
        p.z / 3.0,
        length(p.xy) - blackHoleRadius - z * 0.2
      );

      float d = 0.0;
      for (float j = 0.0; j < 5.0; j++) {
        d += 1.0;
        p += sin(p.yzx * d + iTime + 0.3 * i) / d;
      }

      d = length(vec4(0.4 * cos(p) - 0.4, p.z));
      z += d;

      float angularBoost = pow(abs(cos(rawAngle)), 8.0);

      vec3 palette = getPalette(iPaletteIndex);
      vec4 phases = vec4(palette, 0.0);
      vec4 baseColor = (1.0 + cos(p.x + i * 0.4 + z + phases + iAudioTreble * 3.0)) / d;

      vec4 hotBoost = vec4(1.5, 0.6, 0.2, 1.0) * angularBoost * iAudioBass * 2.5;

      O += baseColor + hotBoost;
    }

    O *= (1.0 + iAudioRMS * 0.5);

    // тонмаппинг
    O = tanh(O * O / 400.0);

    gl_FragColor = vec4(O.rgb, 1.0);
  }
`

const CosmicMaterial = shaderMaterial(
  {
    iResolution: new THREE.Vector2(1920, 1080),
    iTime: 0,
    iAudioBass: 0,
    iAudioBeatPulse: 0,
    iAudioTreble: 0,
    iAudioRMS: 0,
    iRotationStep: 0,
    iPaletteIndex: 0,
    iQuality: 14,
    iBassReactivity: 1,
  },
  VERTEX_SHADER,
  FRAGMENT_SHADER,
)

extend({ CosmicMaterial })

declare module '@react-three/fiber' {
  interface ThreeElements {
    cosmicMaterial: any
  }
}

function CosmicScene() {
  const matRef = useRef<any>(null)
  const smoothedBassRef = useRef(0)
  const beatPulseRef = useRef(0)
  const smoothedTrebleRef = useRef(0)
  const smoothedRMSRef = useRef(0)
  const rotationStepRef = useRef(0)
  const lastBeatRef = useRef(false)
  const paletteIndexRef = useRef(0)

  const params = useVisualizerParams<CosmicParams>('cosmic')
  const paramsRef = useRef(params)
  paramsRef.current = params

  const { size } = useThree()
  const accumulatorRef = useRef(0)
  const FRAME_INTERVAL = 1 / 60

  useFrame((_, delta) => {
    if (!matRef.current) return

    accumulatorRef.current += delta
    if (accumulatorRef.current < FRAME_INTERVAL) return
    accumulatorRef.current = accumulatorRef.current % FRAME_INTERVAL

    const state = useAudioStore.getState()
    const audioData = state.audioData
    const beat = state.beat

    let bassRaw = 0
    if (audioData && audioData.length > 0) {
      for (let i = 0; i < 20; i++) bassRaw += audioData[i] ?? 0
      bassRaw /= 20
    }

    let trebleRaw = 0
    if (audioData && audioData.length > 100) {
      const end = Math.min(200, audioData.length)
      for (let i = 100; i < end; i++) trebleRaw += audioData[i] ?? 0
      trebleRaw /= end - 100
    }

    let rmsRaw = 0
    if (audioData && audioData.length > 0) {
      for (let i = 0; i < audioData.length; i++) rmsRaw += audioData[i] ?? 0
      rmsRaw /= audioData.length
    }

    // сглаживание без привязки к fps
    const smoothK = 1 - Math.pow(0.0001, delta)
    smoothedBassRef.current += (bassRaw - smoothedBassRef.current) * smoothK
    smoothedTrebleRef.current += (trebleRaw - smoothedTrebleRef.current) * smoothK
    smoothedRMSRef.current += (rmsRaw - smoothedRMSRef.current) * smoothK

    const pp = paramsRef.current
    rotationStepRef.current += delta * 0.15 * pp.rotationSpeed

    if (beat && !lastBeatRef.current) {
      rotationStepRef.current += Math.PI / 12
      if (pp.paletteIndex < 0) {
        paletteIndexRef.current = (paletteIndexRef.current + 1) % PALETTE_COUNT
      }
    }
    lastBeatRef.current = beat

    if (beat) beatPulseRef.current = 1
    const decayK = Math.pow(0.01, delta)
    beatPulseRef.current *= decayK

    matRef.current.iTime += delta
    matRef.current.iResolution.set(size.width, size.height)
    matRef.current.iAudioBass = smoothedBassRef.current
    matRef.current.iAudioBeatPulse = beatPulseRef.current
    matRef.current.iAudioTreble = smoothedTrebleRef.current
    matRef.current.iAudioRMS = smoothedRMSRef.current
    matRef.current.iRotationStep = rotationStepRef.current
    matRef.current.iPaletteIndex = pp.paletteIndex >= 0 ? pp.paletteIndex : paletteIndexRef.current
    matRef.current.iQuality = pp.quality
    matRef.current.iBassReactivity = pp.bassReactivity
  })

  return (
    <mesh>
      <planeGeometry args={[PLANE_SIZE, PLANE_SIZE]} />
      {/* @ts-ignore */}
      <cosmicMaterial ref={matRef} />
    </mesh>
  )
}

export function CosmicVisualizer() {
  const composerRef = useRef<{ render: (d?: number) => void } | null>(null)
  const params = useVisualizerParams<CosmicParams>('cosmic')
  const dprCap = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
  const dpr = Math.min(Math.max(0.5, params.resolutionScale), 2, dprCap)
  return (
    <div style={{ width: '100%', height: '100%', background: BG_COLOR }}>
      <Canvas camera={CAMERA} dpr={dpr} gl={{ preserveDrawingBuffer: true }}>
        <AudioInvalidator composerRef={composerRef} />
        <color attach="background" args={[BG_COLOR]} />
        <CosmicScene />
        <EffectComposer ref={composerRef as any}>
          <Bloom
            intensity={1.2 * params.bloomIntensity}
            luminanceThreshold={0.4}
            luminanceSmoothing={0.9}
            mipmapBlur
          />
          <ChromaticAberration
            offset={CHROMATIC_OFFSET}
            blendFunction={BlendFunction.NORMAL}
            radialModulation={false}
            modulationOffset={0}
          />
          <Vignette darkness={0.4} offset={0.15} />
        </EffectComposer>
      </Canvas>
    </div>
  )
}
