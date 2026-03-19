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
