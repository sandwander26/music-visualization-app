import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { AfterimagePass } from 'three/examples/jsm/postprocessing/AfterimagePass.js'
import { useAudioStore } from '../store/audioStore'
import { useVisualizerParams } from '../presets/useVisualizerParams'

interface SphereParams {
  subdivisions: number
  starCount: number
  displaceAmount: number
  trailAmount: number
  bloomStrength: number
  resolutionScale: number
}

function buildStarPositions(count: number): Float32Array {
  const arr = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    const r = 15 + Math.random() * 50
    const theta = Math.random() * Math.PI * 2
    const phi = Math.acos(Math.random() * 2 - 1)
    arr[i * 3] = r * Math.sin(phi) * Math.cos(theta)
    arr[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
    arr[i * 3 + 2] = r * Math.cos(phi)
  }
  return arr
}

const VERTEX_SHADER = /* glsl */ `
  varying float vDisplacement;
  varying vec3 vNormal;
  varying vec3 vWorldPosition;
  uniform float uTime;
  uniform float uEnergy;
  uniform float uBeat;
  uniform float uBass;
  uniform float uHigh;
  uniform float uPointScale;
  uniform float uDisplace;

  void main() {
    vec3 pos = position;
    float d1 = sin(pos.x * 3.0 + uTime) * cos(pos.y * 3.0 + uTime * 0.7) * sin(pos.z * 3.0 + uTime * 1.3);
    float d2 = sin(pos.x * 7.0 - uTime * 0.5) * 0.3;
    float displacement = d1 * (0.3 + uEnergy * 3.0 * uDisplace + uBass * 1.0) + d2 * uHigh * 2.0;
    displacement += uBeat * 0.35;
    pos += normal * displacement;

    vDisplacement = displacement;
    vNormal = normal;
    vWorldPosition = pos;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = (0.5 + uEnergy * 3.0 + uHigh * 1.0) * uPointScale * (150.0 / -mvPosition.z);
  }
`

const FRAGMENT_SHADER = /* glsl */ `
  varying float vDisplacement;
  varying vec3 vNormal;
  varying vec3 vWorldPosition;
  uniform float uTime;
  uniform float uBeat;
  uniform float uEnergy;

  void main() {
    float r = length(gl_PointCoord - vec2(0.5));
    if (r > 0.5) discard;

    vec3 colorA = vec3(0.25, 0.0, 0.6);  // фиолет
    vec3 colorB = vec3(0.0, 0.5, 0.7);   // бирюза
    vec3 colorC = vec3(0.7, 0.1, 0.35);  // розовый
    vec3 colorHot = vec3(1.0, 0.8, 0.5); // тёплый блик

    float t = vDisplacement * 2.0 + uTime * 0.2;
    vec3 color = mix(colorA, colorB, sin(t) * 0.5 + 0.5);
    color = mix(color, colorC, uBeat * 0.5);

    vec3 viewDir = normalize(-vWorldPosition);
    float fresnel = pow(1.0 - max(dot(vNormal, viewDir), 0.0), 2.0);
    color += colorHot * fresnel * (0.2 + uEnergy * 0.6);

    color += vec3(0.08, 0.12, 0.2) * uEnergy * 0.6;

    float alpha = 1.0 - r * 2.0;
    gl_FragColor = vec4(color, alpha * 0.6);
  }
`

export function ShaderSphereVisualizer() {
  const containerRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef(0)

  const beatRef = useRef(false)
  const energyRef = useRef(0)
  const audioDataRef = useRef<Float32Array>(new Float32Array(128))
  const isPlayingRef = useRef(false)
  const titleRef = useRef('')
  const artistRef = useRef('')

  const params = useVisualizerParams<SphereParams>('sphere')
  const paramsRef = useRef(params)
  paramsRef.current = params

  const beat = useAudioStore((s) => s.beat)
  const energy = useAudioStore((s) => s.energy)
  const audioData = useAudioStore((s) => s.audioData)
  const isPlaying = useAudioStore((s) => s.isPlaying)
  const title = useAudioStore((s) => s.trackInfo.title)
  const artist = useAudioStore((s) => s.trackInfo.artist)

  beatRef.current = beat
  energyRef.current = energy
  audioDataRef.current = audioData
  isPlayingRef.current = isPlaying
  titleRef.current = title
  artistRef.current = artist

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x02030a)
    scene.fog = new THREE.FogExp2(0x04061a, 0.05)

    const camera = new THREE.PerspectiveCamera(
        70,
        window.innerWidth / window.innerHeight,
        0.1,
        100,
    )
    camera.position.set(0, 0, 5.5)
    camera.lookAt(0, 0, 0)

    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
    renderer.setSize(window.innerWidth, window.innerHeight)
    const deviceCap = window.devicePixelRatio || 1
    const resolveDpr = (scale: number) => Math.min(Math.max(0.5, scale), 2, deviceCap)
    let dpr = resolveDpr(paramsRef.current.resolutionScale)
    renderer.setPixelRatio(dpr)
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 0.7
    container.appendChild(renderer.domElement)

    let currentSubdivisions = paramsRef.current.subdivisions
    let geometry = new THREE.IcosahedronGeometry(1, currentSubdivisions)
    const material = new THREE.ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      uniforms: {
        uTime: { value: 0 },
        uEnergy: { value: 0 },
        uBeat: { value: 0 },
        uBass: { value: 0 },
        uHigh: { value: 0 },
        uPointScale: { value: 1.0 },
        uDisplace: { value: 1.0 },
      },
      transparent: true,
      depthWrite: false,
    })
    const points = new THREE.Points(geometry, material)
    scene.add(points)

    let starGeo = new THREE.BufferGeometry()
    let currentStarCount = paramsRef.current.starCount
    starGeo.setAttribute('position', new THREE.BufferAttribute(buildStarPositions(currentStarCount), 3))
    const starMat = new THREE.PointsMaterial({
      color: 0x8899ff,
      size: 0.05,
      transparent: true,
      opacity: 0.6,
      sizeAttenuation: true,
    })
    const stars = new THREE.Points(starGeo, starMat)
    scene.add(stars)

    const composer = new EffectComposer(renderer)
    composer.addPass(new RenderPass(scene, camera))
    const afterimagePass = new AfterimagePass(paramsRef.current.trailAmount)
    composer.addPass(afterimagePass)
    const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        0.35,
        0.4,
        0.55,
    )
    composer.addPass(bloomPass)

    const shake = { x: 0, y: 0, vx: 0, vy: 0, rot: 0, vr: 0, trauma: 0 }
    const drift = { x: 0, y: 0, rot: 0 }
    let kickX = 0
    let kickY = 0
    let beatScale = 1.0
    let prevBeat = false
    let beatIntensity = 0
    let trackOpacity = 0
    let lastTitle = ''
    let frozenTime = 0

    const clock = new THREE.Clock()
    const baseCamPos = new THREE.Vector3(0, 0, 5.5)

    const FRAME_INTERVAL = 1000 / 60
    let lastFrameTime = 0

    function onResize() {
      camera.aspect = window.innerWidth / window.innerHeight
      camera.updateProjectionMatrix()
      renderer.setSize(window.innerWidth, window.innerHeight)
      composer.setSize(window.innerWidth, window.innerHeight)
      bloomPass.setSize(window.innerWidth, window.innerHeight)
    }
    window.addEventListener('resize', onResize)

    function animate() {
      const now = performance.now()
      const sinceLast = now - lastFrameTime
      if (sinceLast < FRAME_INTERVAL) {
        rafRef.current = requestAnimationFrame(animate)
        return
      }
      lastFrameTime = now - (sinceLast % FRAME_INTERVAL)

      const elapsed = clock.getElapsedTime()
      const curBeat = beatRef.current
      const curEnergy = energyRef.current
      const curAudioData = audioDataRef.current
      const pp = paramsRef.current

      if (pp.subdivisions !== currentSubdivisions) {
        currentSubdivisions = pp.subdivisions
        const oldGeom = geometry
        geometry = new THREE.IcosahedronGeometry(1, currentSubdivisions)
        points.geometry = geometry
        oldGeom.dispose()