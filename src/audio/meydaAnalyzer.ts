import Meyda, { type MeydaAudioFeature } from 'meyda'

export interface TrackFeatures {
  rmsMean: number
  rmsStd: number
  centroidMean: number
  centroidStd: number
  flatnessMean: number
  flatnessStd: number
  zcrMean: number
  zcrStd: number
  loudnessMean: number
  loudnessStd: number
  rolloffMean: number
  rolloffStd: number
  frameCount: number
  durationSec: number
}

const BUFFER_SIZE = 2048
const HOP_SIZE = 1024

const FEATURES = [
  'rms',
  'spectralCentroid',
  'spectralFlatness',
  'zcr',
  'loudness',
  'spectralRolloff',
] as const

interface LoudnessShape {
  total: number
  specific?: Float32Array
}

interface MeydaFrameOutput {
  rms?: number
  spectralCentroid?: number
  spectralFlatness?: number
  zcr?: number
  loudness?: LoudnessShape
  spectralRolloff?: number
}

function mixToMono(audioBuffer: AudioBuffer): Float32Array {
  const channels = audioBuffer.numberOfChannels
  const length = audioBuffer.length
  if (channels === 1) {
    const out = new Float32Array(length)
    out.set(audioBuffer.getChannelData(0))
    return out
  }
  const out = new Float32Array(length)
  for (let ch = 0; ch < channels; ch++) {
    const data = audioBuffer.getChannelData(ch)
    for (let i = 0; i < length; i++) out[i] += data[i]
  }
  const inv = 1 / channels
  for (let i = 0; i < length; i++) out[i] *= inv
  return out
}

function meanStd(values: number[]): { mean: number; std: number } {
  const n = values.length
  if (n === 0) return { mean: 0, std: 0 }
  let sum = 0
  for (let i = 0; i < n; i++) sum += values[i]
  const mean = sum / n
  let varSum = 0
  for (let i = 0; i < n; i++) {
    const d = values[i] - mean
    varSum += d * d
  }
  return { mean, std: Math.sqrt(varSum / n) }
}

export async function analyzeMeyda(audioBuffer: AudioBuffer): Promise<TrackFeatures> {
  const mono = mixToMono(audioBuffer)
  const sampleRate = audioBuffer.sampleRate

  // sampleRate до extract
  Meyda.sampleRate = sampleRate
  Meyda.bufferSize = BUFFER_SIZE

  const rms: number[] = []
  const centroid: number[] = []
  const flatness: number[] = []
  const zcr: number[] = []
  const loudness: number[] = []
  const rolloff: number[] = []

  const frame = new Float32Array(BUFFER_SIZE)
  let frameCount = 0
  const lastStart = mono.length - BUFFER_SIZE

  // centroid в Гц
  const binToHz = sampleRate / BUFFER_SIZE

  for (let offset = 0; offset <= lastStart; offset += HOP_SIZE) {
    frame.set(mono.subarray(offset, offset + BUFFER_SIZE))
    const out = Meyda.extract(FEATURES as unknown as MeydaAudioFeature[], frame) as MeydaFrameOutput | null
    if (!out) continue

    if (Number.isFinite(out.rms)) rms.push(out.rms as number)
    if (Number.isFinite(out.spectralCentroid)) centroid.push((out.spectralCentroid as number) * binToHz)
    if (Number.isFinite(out.spectralFlatness)) flatness.push(out.spectralFlatness as number)
    if (Number.isFinite(out.zcr)) zcr.push((out.zcr as number) / BUFFER_SIZE)
    if (out.loudness && Number.isFinite(out.loudness.total)) loudness.push(out.loudness.total)
    if (Number.isFinite(out.spectralRolloff)) rolloff.push(out.spectralRolloff as number)

    frameCount++
    // отдаём ui время каждые 50 кадров
    if (frameCount % 50 === 0) await new Promise<void>((r) => setTimeout(r, 0))
  }

  const r = meanStd(rms)
  const c = meanStd(centroid)
  const f = meanStd(flatness)
  const z = meanStd(zcr)
  const l = meanStd(loudness)
  const ro = meanStd(rolloff)

  return {
    rmsMean: r.mean, rmsStd: r.std,
    centroidMean: c.mean, centroidStd: c.std,
    flatnessMean: f.mean, flatnessStd: f.std,
    zcrMean: z.mean, zcrStd: z.std,
    loudnessMean: l.mean, loudnessStd: l.std,
    rolloffMean: ro.mean, rolloffStd: ro.std,
    frameCount,
    durationSec: audioBuffer.duration,
  }
}
