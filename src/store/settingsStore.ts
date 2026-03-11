import { create } from 'zustand'
import { audioEngine } from '../audio/audioEngine'
import { useAudioStore } from './audioStore'
import { useUIStore, type LibraryView } from './uiStore'

const STORAGE_KEY = 'mv_app_settings_v1'

export interface AppSettings {
  libraryView: LibraryView
  karaokeOnLyricsLoaded: boolean
  autoSearchLyrics: boolean
  defaultVolume: number
}

const DEFAULTS: AppSettings = {
  libraryView: 'list',
  karaokeOnLyricsLoaded: false,
  autoSearchLyrics: true,
  defaultVolume: 1,
}

function clampVolume(v: number): number {
  if (!Number.isFinite(v)) return DEFAULTS.defaultVolume
  return Math.max(0, Math.min(1, v))
}

function readStoredSettings(): AppSettings {
  if (typeof window === 'undefined') return { ...DEFAULTS }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULTS }
    const o = JSON.parse(raw) as Partial<AppSettings>
    return {
      libraryView: o.libraryView === 'grid' ? 'grid' : 'list',
      karaokeOnLyricsLoaded: Boolean(o.karaokeOnLyricsLoaded),
      autoSearchLyrics: o.autoSearchLyrics !== false,
      defaultVolume: clampVolume(o.defaultVolume ?? DEFAULTS.defaultVolume),
    }
  } catch {
    return { ...DEFAULTS }
  }
}

function persistSettings(state: AppSettings) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    void import('../services/cloudSync').then((m) => m.scheduleCloudPush('settings'))
  } catch {
    
  }
}

function pickAppSettings(s: SettingsStore): AppSettings {
  return {