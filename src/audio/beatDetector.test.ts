import { describe, it, expect } from 'vitest'
import { BeatDetector } from './beatDetector'

function makeFrame(bassLevel: number): Float32Array {
  const f = new Float32Array(1024)
  for (let i = 0; i < 14; i++) f[i] = bassLevel
  return f
}

describe('BeatDetector', () => {
  it('не детектит бит во время прогрева истории', () => {
    const det = new BeatDetector({ historySize: 43, beatHold: 22 })
    const loud = makeFrame(0.9)
    let anyBeat = false
    for (let i = 0; i < 42; i++) {
      if (det.detect(loud)) anyBeat = true
    }
    expect(anyBeat).toBe(false)
  })

  it('детектит бит когда басовая энергия превышает порог', () => {
    const det = new BeatDetector({ historySize: 43, beatHold: 22 })
    const quiet = makeFrame(0.1)
    for (let i = 0; i < 43; i++) det.detect(quiet)
    const loud = makeFrame(0.9)
    expect(det.detect(loud)).toBe(true)
  })

  it('держит флаг бита beatHold кадров после срабатывания', () => {
    const det = new BeatDetector({ historySize: 43, beatHold: 5 })
    const quiet = makeFrame(0.1)
    for (let i = 0; i < 43; i++) det.detect(quiet)
    const loud = makeFrame(0.9)
    det.detect(loud)
    let heldFrames = 0
    for (let i = 0; i < 10; i++) {
      if (det.detect(quiet)) heldFrames++
      else break
    }
    expect(heldFrames).toBeGreaterThanOrEqual(3)
    expect(heldFrames).toBeLessThanOrEqual(5)
  })

  it('reset очищает историю и счётчик', () => {
    const det = new BeatDetector()
    for (let i = 0; i < 50; i++) det.detect(makeFrame(0.5))
    det.reset()
    expect(det.energyHistory.length).toBe(0)
  })
})
