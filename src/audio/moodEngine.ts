import type { TrackFeatures } from './meydaAnalyzer'
import type { LibraryTrack } from '../store/libraryStore'

export type MoodId = 'energetic' | 'upbeat' | 'calm' | 'sad' | 'melancholic'

export type MoodWeights = Record<MoodId, number>

export const MOOD_ORDER: MoodId[] = ['energetic', 'upbeat', 'calm', 'sad', 'melancholic']

export const MOOD_LABELS: Record<MoodId, string> = {
  energetic: 'Энергично',
  upbeat: 'Бодро',
  calm: 'Спокойно',
  sad: 'Грустно',
  melancholic: 'Меланхолично',
}

export const MOOD_GRADIENTS: Record<MoodId, string> = {
  energetic:   'linear-gradient(135deg, #ff6b35, #f7931e)',
  upbeat:      'linear-gradient(135deg, #ff5e8a, #ff8c42)',
  calm:        'linear-gradient(135deg, #6dd5ed, #a8e6cf)',
  sad:         'linear-gradient(135deg, #364f6b, #5d7b9e)',
  melancholic: 'linear-gradient(135deg, #6a4c93, #8e7cc3)',
}

// сглаживаем переход по порогу
const smoothAbove = (v: number, t: number, w: number): number => {
  if (v <= t - w) return 0
  if (v >= t + w) return 1
  return (v - (t - w)) / (w * 2)
}
const smoothBelow = (v: number, t: number, w: number): number =>
  1 - smoothAbove(v, t, w)

const weighted = (parts: Array<{ score: number; weight: number }>): number => {
  const sum = parts.reduce((s, p) => s + p.weight, 0)
  if (sum === 0) return 0
  const acc = parts.reduce((s, p) => s + p.score * p.weight, 0)
  return Math.max(0, Math.min(1, acc / sum))
}

export function computeMoodWeights(f: TrackFeatures): MoodWeights {
  const energetic = weighted([
    { score: smoothAbove(f.rmsMean, 0.15, 0.05),       weight: 1.0 },
    { score: smoothAbove(f.centroidMean, 3500, 800),   weight: 1.0 },
    { score: smoothAbove(f.flatnessMean, 0.10, 0.05),  weight: 0.8 },
    { score: smoothAbove(f.zcrMean, 0.07, 0.03),       weight: 0.8 },
  ])

  const upbeat = weighted([
    { score: smoothAbove(f.rmsMean, 0.13, 0.04), weight: 1.0 },
    {
      score: smoothAbove(f.centroidMean, 2200, 500) * smoothBelow(f.centroidMean, 3700, 500),
      weight: 1.0,
    },
    { score: smoothAbove(f.flatnessMean, 0.04, 0.02), weight: 0.6 },
    // верхняя граница по шуму
    { score: smoothBelow(f.flatnessMean, 0.20, 0.05), weight: 0.4 },