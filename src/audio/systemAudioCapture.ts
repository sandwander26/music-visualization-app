interface SystemCaptureInfo {
  sampleRate: number
  channels: number
}

const FFT_SIZE = 2048
const BIN_COUNT = 1024

let stream: MediaStream | null = null
let audioContext: AudioContext | null = null
let analyser: AnalyserNode | null = null
let lastAudioData = new Float32Array(BIN_COUNT)
let lastEnergy = 0

export async function startSystemCapture(): Promise<SystemCaptureInfo> {
  if (stream) await stopSystemCapture()

  stream = await navigator.mediaDevices.getDisplayMedia({
    audio: {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    },
    video: true,
  })

  for (const track of stream.getVideoTracks()) track.stop()

  const audioTracks = stream.getAudioTracks()
  if (audioTracks.length === 0) {
    await stopSystemCapture()
    throw new Error('NO_AUDIO_TRACK: пользователь не разрешил захват звука')
  }

  audioContext = new AudioContext()
  const source = audioContext.createMediaStreamSource(stream)
  analyser = audioContext.createAnalyser()
  analyser.fftSize = FFT_SIZE
  source.connect(analyser)

  return {
    sampleRate: audioContext.sampleRate,
    channels: audioTracks[0].getSettings().channelCount ?? 2,
  }
}

export async function stopSystemCapture(): Promise<void> {
  if (stream) {
    for (const track of stream.getTracks()) track.stop()
    stream = null
  }
  if (audioContext) {
    try { await audioContext.close() } catch {}
    audioContext = null
  }
  analyser = null
  lastAudioData = new Float32Array(BIN_COUNT)
  lastEnergy = 0
}

export function processSystemAudioFrame(): { audioData: Float32Array; energy: number } {
  if (!analyser) return { audioData: lastAudioData, energy: lastEnergy }

  const raw = new Float32Array(analyser.frequencyBinCount)
  analyser.getFloatFrequencyData(raw)

  const out = new Float32Array(BIN_COUNT)
  let sum = 0
  for (let i = 0; i < BIN_COUNT; i++) {
    const db = raw[i] ?? -100
    const v = Math.max(0, (db + 100) / 100)
    out[i] = v
    sum += v
  }

  lastAudioData = out
  lastEnergy = sum / BIN_COUNT
  return { audioData: out, energy: lastEnergy }
}
