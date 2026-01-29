export class BeatDetector {
  private threshold = 1.15
  private history: number[] = []
  private maxHistory = 43

  detect(audioData: Float32Array): boolean {
    let bassEnergy = 0
    for (let i = 0; i < 14; i++) {
      bassEnergy += audioData[i]
    }

    this.history.push(bassEnergy)
    if (this.history.length > this.maxHistory) {
      this.history.shift()
    }

    if (this.history.length < this.maxHistory) {
      return false
    }

    const avg = this.history.reduce((sum, v) => sum + v, 0) / this.history.length
    return bassEnergy > avg * this.threshold
  }
}
