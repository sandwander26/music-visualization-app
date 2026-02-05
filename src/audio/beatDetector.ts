export class BeatDetector {
  private threshold = 1.15
  private history: number[] = []
  private maxHistory = 43
  private holdCounter = 0
  private beatHold = 22

  detect(audioData: Float32Array): boolean {
    if (this.holdCounter > 0) {
      this.holdCounter--
      return false
    }

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

    if (bassEnergy > avg * this.threshold) {
      this.holdCounter = this.beatHold
      return true
    }
    return false
  }

  reset(): void {
    this.history = []
    this.holdCounter = 0
  }
}
