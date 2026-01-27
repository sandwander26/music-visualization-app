export class BeatDetector {
  private threshold = 1.2

  detect(audioData: Float32Array): boolean {
    let bassEnergy = 0
    for (let i = 0; i < 10; i++) {
      bassEnergy += audioData[i]
    }
    return bassEnergy > this.threshold
  }
}
