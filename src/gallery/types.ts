import type { MoodId } from '../audio/moodEngine'

export type VizCategory = 'premium' | 'basic' | 'effects' | 'atmosphere'
export type VizBadge = 'premium' | null

export const CATEGORY_LABELS: Record<string, string> = {
  premium: 'Премиум',
  basic: 'Базовые',
  effects: 'Эффекты',
  atmosphere: 'Атмосфера',
  user: 'Свой',
}

export interface VizPreview {
  id: string
  name: string
  category: VizCategory
  subcategory: string
  badge: VizBadge
  moods: MoodId[]
}
