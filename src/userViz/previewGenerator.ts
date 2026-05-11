import type { ComponentType } from 'react'
import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import type { UserVizProps } from './types'

const PREVIEW_W = 800
const PREVIEW_H = 450
const WARMUP_FRAMES = 45
const WARMUP_MS = 1000
const PEAK_FRAMES = 20
const PEAK_MS = 300

function buildSpectrum(scale: number): Float32Array {
  const data = new Float32Array(1024)
  for (let i = 0; i < 1024; i++) data[i] = Math.min(1, Math.exp(-i * 0.01) * scale)
  return data
}

function waitForFrames(count: number): Promise<void> {
  return new Promise((resolve) => {
    let frames = 0
    const tick = () => (++frames >= count ? resolve() : requestAnimationFrame(tick))
    requestAnimationFrame(tick)
  })
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

export async function generateUserVizPreview(
  Component: ComponentType<UserVizProps>,
  vizId = 'user-viz',
): Promise<Blob | null> {
  const container = document.createElement('div')
  container.style.cssText = `position:fixed;left:0;top:0;width:${PREVIEW_W}px;height:${PREVIEW_H}px;opacity:0;pointer-events:none;z-index:-1;overflow:hidden;`
  document.body.appendChild(container)

  let root: ReturnType<typeof createRoot> | null = null

  const renderAt = (audioData: Float32Array, beat: boolean, energy: number) => {
    root!.render(createElement(Component, { audioData, beat, energy, currentTime: 0 }))
  }
