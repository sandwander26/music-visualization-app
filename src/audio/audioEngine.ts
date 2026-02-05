import { useAudioStore } from '../store/audioStore'

class AudioEngine {
  private audioContext: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private source: AudioBufferSourceNode | null = null
  private rafId = 0
  private freqData: Float32Array | null = null

  async loadFile(file: File): Promise<void> {
    if (!this.audioContext) {
      this.audioContext = new AudioContext()
      this.analyser = this.audioContext.createAnalyser()
      this.analyser.fftSize = 2048
      this.analyser.connect(this.audioContext.destination)
      this.freqData = new Float32Array(this.analyser.frequencyBinCount)
    }

    const arrayBuffer = await file.arrayBuffer()
    const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer)

    this.source = this.audioContext.createBufferSource()
    this.source.buffer = audioBuffer
    this.source.connect(this.analyser!)
  }

  play(): void {
    if (!this.source) return
    this.source.start()
    useAudioStore.getState().setPlaying(true)
    this.startLoop()
  }

  private startLoop(): void {
    const tick = () => {
      if (!this.analyser || !this.freqData) return
      this.analyser.getFloatFrequencyData(this.freqData)
      const normalized = new Float32Array(this.freqData.length)
      for (let i = 0; i < this.freqData.length; i++) {
        normalized[i] = Math.max(0, (this.freqData[i] + 100) / 100)
      }
      useAudioStore.getState().setAudioData(normalized)
      this.rafId = requestAnimationFrame(tick)
    }
    this.rafId = requestAnimationFrame(tick)
  }

  stop(): void {
    if (this.rafId) cancelAnimationFrame(this.rafId)
    this.source?.stop()
    useAudioStore.getState().setPlaying(false)
  }
}

export const audioEngine = new AudioEngine()
