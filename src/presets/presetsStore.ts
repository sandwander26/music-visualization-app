import { create } from 'zustand'

export type ParamValue = number | string | boolean

export interface ParamSchema {
  id: string
  label: string
  type: 'range' | 'color' | 'toggle'
  min?: number
  max?: number
  step?: number
  default: ParamValue
}

export type VisualizerParams = Record<string, ParamValue>

export interface Preset {
  id: string
  name: string
  visualizerId: string
  params: VisualizerParams
  createdAt: number
  isBuiltin?: boolean
}

interface PresetsState {
  activeVisualizerId: string
  currentParams: Record<string, VisualizerParams>
  savedPresets: Preset[]
  builtinPresets: Preset[]

  setActiveVisualizerId: (id: string) => void

  setParam: (visualizerId: string, paramId: string, value: ParamValue) => void
  getParams: (visualizerId: string) => VisualizerParams
  resetParams: (visualizerId: string) => void

  savePreset: (name: string, visualizerId: string) => void
  loadPreset: (preset: Preset) => void
  deletePreset: (presetId: string) => void
}

const STORAGE_KEY = 'presets-v1'

interface PersistedShape {
  currentParams: Record<string, VisualizerParams>
  savedPresets: Preset[]
}

function hydrate(): PersistedShape {
  if (typeof localStorage === 'undefined') {
    return { currentParams: {}, savedPresets: [] }
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { currentParams: {}, savedPresets: [] }
    const parsed = JSON.parse(raw) as Partial<PersistedShape>
    return {
      currentParams: parsed.currentParams ?? {},
      savedPresets: Array.isArray(parsed.savedPresets) ? parsed.savedPresets : [],
    }
  } catch (err) {
    console.warn('[presets] не удалось прочитать localStorage:', err)
    return { currentParams: {}, savedPresets: [] }
  }
}

function persist(shape: PersistedShape): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(shape))
  } catch (err) {
    console.warn('[presets] не удалось записать localStorage:', err)
  }
}

function makeId(): string {
  return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
}

const initial = hydrate()

export const usePresetsStore = create<PresetsState>((set, get) => ({
  activeVisualizerId: '',
  currentParams: initial.currentParams,
  savedPresets: initial.savedPresets,
  builtinPresets: [],

  setActiveVisualizerId: (id) => set({ activeVisualizerId: id }),

  setParam: (visualizerId, paramId, value) => {
    const prev = get().currentParams
    const next = {
      ...prev,
      [visualizerId]: { ...(prev[visualizerId] ?? {}), [paramId]: value },
    }
    set({ currentParams: next })
    persist({ currentParams: next, savedPresets: get().savedPresets })
  },

  getParams: (visualizerId) => get().currentParams[visualizerId] ?? {},

  resetParams: (visualizerId) => {
    const prev = get().currentParams
    if (!(visualizerId in prev)) return
    const next = { ...prev }
    delete next[visualizerId]
    set({ currentParams: next })
    persist({ currentParams: next, savedPresets: get().savedPresets })
  },

  savePreset: (name, visualizerId) => {
    const params = get().currentParams[visualizerId] ?? {}
    const preset: Preset = {
      id: makeId(),
      name,
      visualizerId,
      params: { ...params },
      createdAt: Date.now(),
    }
    const nextSaved = [...get().savedPresets, preset]
    set({ savedPresets: nextSaved })
    persist({ currentParams: get().currentParams, savedPresets: nextSaved })
  },

  loadPreset: (preset) => {
    const prev = get().currentParams
    const next = {
      ...prev,
      [preset.visualizerId]: { ...preset.params },
    }
    set({ currentParams: next })
    persist({ currentParams: next, savedPresets: get().savedPresets })
  },

  deletePreset: (presetId) => {
    const target = get().savedPresets.find((p) => p.id === presetId)
    if (!target || target.isBuiltin) return
    const nextSaved = get().savedPresets.filter((p) => p.id !== presetId)
    set({ savedPresets: nextSaved })
    persist({ currentParams: get().currentParams, savedPresets: nextSaved })
  },
}))
