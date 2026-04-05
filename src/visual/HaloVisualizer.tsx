import { Canvas, useFrame } from '@react-three/fiber'
import { Float } from '@react-three/drei'
import {
  EffectComposer,
  Bloom,
  ChromaticAberration,
  Noise,
  Vignette,
} from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'
import { LayerMaterial, Fresnel, Displace } from 'lamina'
import { useRef } from 'react'
import * as THREE from 'three'
import { useAudioStore } from '../store/audioStore'
import { useVisualizerParams } from '../presets/useVisualizerParams'
import { AudioInvalidator } from './_AudioInvalidator'

interface HaloParams {
  subdivisions: number
  displaceAmount: number
  floatIntensity: number
  bloomIntensity: number
  fresnelColor: string
  resolutionScale: number
}

const CAMERA_CONFIG = { position: [0, 0, 5] as [number, number, number], fov: 45 }
const BG_COLOR = '#000000'
const BG_COLOR_ARGS: [string] = [BG_COLOR]

const BLOB_BASE_COLOR = '#000000'
const FRESNEL_POWER = 2.5
const FRESNEL_INTENSITY = 2.2
const FRESNEL_ALPHA = 1

const DISPLACE_STRENGTH = 0.25
const DISPLACE_SCALE = 1.2
const DISPLACE_OFFSET_INIT: [number, number, number] = [0, 0, 0]

const FLOATING_RANGE: [number, number] = [-0.4, 0.4]

const CHROMATIC_OFFSET: [number, number] = [0.002, 0.002]

function Blob() {
  const displaceRef = useRef<any>(null)
  const meshRef = useRef<THREE.Mesh>(null)
  const tRef = useRef(0)
  const smoothedBassRef = useRef(0)
  const beatPulseRef = useRef(0)

  const params = useVisualizerParams<HaloParams>('halo')
  const paramsRef = useRef(params)
  paramsRef.current = params

  const accumulatorRef = useRef(0)
  const FRAME_INTERVAL = 1 / 60

  useFrame((_, delta) => {
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

    // сглаживание без привязки к fps
    const bassK = 1 - Math.pow(0.0001, delta)
    smoothedBassRef.current =
      smoothedBassRef.current + (bassRaw - smoothedBassRef.current) * bassK

    if (beat) beatPulseRef.current = 1
    const decayK = Math.pow(0.01, delta)
    beatPulseRef.current *= decayK

    tRef.current += delta * 0.3
    if (displaceRef.current) {
      displaceRef.current.offset.x = tRef.current
      displaceRef.current.offset.y = tRef.current * 0.7
      displaceRef.current.offset.z = tRef.current * 0.5

      const da = paramsRef.current.displaceAmount
      displaceRef.current.strength =
        (DISPLACE_STRENGTH + smoothedBassRef.current * 0.5 + beatPulseRef.current * 0.4) * da
    }

    // раздувание на бите
    if (meshRef.current) {
      const scaleTarget =
        1 + beatPulseRef.current * 0.15 + smoothedBassRef.current * 0.08
      const scaleK = 1 - Math.pow(0.001, delta)
      const currentScale = meshRef.current.scale.x
      meshRef.current.scale.setScalar(
        currentScale + (scaleTarget - currentScale) * scaleK
      )

      const driftT = tRef.current * 0.4
      meshRef.current.position.x = Math.sin(driftT) * 0.5
    }
  })

  return (
    <mesh ref={meshRef}>
      <icosahedronGeometry args={[1, params.subdivisions]} />
      {/* @ts-ignore */}
      <LayerMaterial lighting="standard" color={BLOB_BASE_COLOR}>
        {/* @ts-ignore */}
        <Displace
          ref={displaceRef}
          strength={DISPLACE_STRENGTH}
          scale={DISPLACE_SCALE}
          type="perlin"
          offset={DISPLACE_OFFSET_INIT}
        />
        {/* @ts-ignore */}
        <Fresnel
          mode="add"
          color={params.fresnelColor}
          alpha={FRESNEL_ALPHA}
          power={FRESNEL_POWER}
          intensity={FRESNEL_INTENSITY}
        />
      </LayerMaterial>
    </mesh>
  )
}

export function HaloVisualizer() {
  const composerRef = useRef<{ render: (d?: number) => void } | null>(null)
  const params = useVisualizerParams<HaloParams>('halo')
  const dprCap = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
  const dpr = Math.min(Math.max(0.5, params.resolutionScale), 2, dprCap)
  return (
    <div style={{ width: '100%', height: '100%', background: BG_COLOR }}>
      <Canvas camera={CAMERA_CONFIG} dpr={dpr} gl={{ preserveDrawingBuffer: true }}>
        <AudioInvalidator composerRef={composerRef} />
        <color attach="background" args={BG_COLOR_ARGS} />
        <ambientLight intensity={1} />

        <Float
          speed={1.2 * params.floatIntensity}
          rotationIntensity={0}
          floatIntensity={2.5 * params.floatIntensity}
          floatingRange={FLOATING_RANGE}
        >
          <Blob />
        </Float>

        <EffectComposer ref={composerRef as any}>
          <Bloom
            intensity={2.5 * params.bloomIntensity}
            luminanceThreshold={0.1}
            luminanceSmoothing={0.9}
            mipmapBlur
          />
          <ChromaticAberration
            offset={CHROMATIC_OFFSET}
            blendFunction={BlendFunction.NORMAL}
            radialModulation={false}
            modulationOffset={0}
          />
          <Noise
            premultiply
            blendFunction={BlendFunction.ADD}
            opacity={0.05}
          />
          <Vignette darkness={0.7} offset={0.1} />
        </EffectComposer>
      </Canvas>
    </div>
  )
}
