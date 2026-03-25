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