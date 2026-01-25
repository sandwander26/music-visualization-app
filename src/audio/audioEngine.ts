import { useAudioStore } from '../store/audioStore'

class AudioEngine {
  private audioContext: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private source: AudioBufferSourceNode | null = null

  async loadFile(file: File): Promise<void> {
    if (!this.audioContext) {
      this.audioContext = new AudioContext()
      this.analyser = this.audioContext.createAnalyser()
      this.analyser.fftSize = 2048
      this.analyser.connect(this.audioContext.destination)
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
  }

  stop(): void {
    this.source?.stop()
    useAudioStore.getState().setPlaying(false)
  }
}

export const audioEngine = new AudioEngine()
