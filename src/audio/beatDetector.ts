export class BeatDetector {
  private threshold = 1.15

  detect(audioData: Float32Array): boolean {
    let bassEnergy = 0
    for (let i = 0; i < 14; i++) {
      bassEnergy += audioData[i]
    }
    return bassEnergy > this.threshold
  }
}
