import type { Preset, VisualizerParams } from './presetsStore'

export const PRESETS_STORAGE_KEY = 'presets-v1'

export interface PresetsCloudPayload {
  currentParams: Record<string, VisualizerParams>
  savedPresets: Preset[]
}

export function readPresetsFromLocalStorage(): PresetsCloudPayload {
  if (typeof localStorage === 'undefined') {
    return { currentParams: {}, savedPresets: [] }
  }
  try {
    const raw = localStorage.getItem(PRESETS_STORAGE_KEY)
    if (!raw) return { currentParams: {}, savedPresets: [] }
    const parsed = JSON.parse(raw) as Partial<PresetsCloudPayload>
    return {
      currentParams: parsed.currentParams ?? {},
      savedPresets: Array.isArray(parsed.savedPresets) ? parsed.savedPresets : [],
    }
  } catch {
    return { currentParams: {}, savedPresets: [] }
  }
}

export function writePresetsToLocalStorage(data: PresetsCloudPayload): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(data))
  } catch (err) {
    console.warn('[presets] cloud pull write failed:', err)
  }
}
